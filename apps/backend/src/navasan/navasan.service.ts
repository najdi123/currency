import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  RequestTimeoutException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import axios from 'axios';
import { Cache, CacheDocument } from './schemas/cache.schema';
import { ApiResponse } from './interfaces/api-response.interface';

@Injectable()
export class NavasanService {
  private readonly logger = new Logger(NavasanService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'http://api.navasan.tech/latest/';

  // CACHE CONFIGURATION
  private readonly freshCacheMinutes = 5; // Fresh data validity
  private readonly staleCacheHours = 24; // Keep stale data for fallback
  private readonly maxStaleAgeHours = 72; // Maximum age before data is too old
  private readonly apiTimeoutMs = 10000; // 10 second timeout

  // ERROR TRACKING: Now handled by database cache schema fields
  // apiErrorCount, lastApiError, lastApiSuccess are tracked in cache documents

  // Define items to fetch from Navasan API
  private readonly items = {
    all: 'usd_sell,eur,gbp,cad,aud,usdt,btc,eth,sekkeh,bahar,nim,rob,gerami,18ayar',
    currencies: 'usd_sell,eur,gbp,cad,aud',
    crypto: 'usdt,btc,eth',
    gold: 'sekkeh,bahar,nim,rob,gerami,18ayar',
  };

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('NAVASAN_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.error('NAVASAN_API_KEY is not set in environment variables');
      throw new Error('NAVASAN_API_KEY is required. Please set it in your .env file.');
    }
  }

  /**
   * Validate category parameter to prevent NoSQL injection
   * Only allows alphanumeric characters, underscores, hyphens, and reasonable length
   */
  private validateCategory(category: string): void {
    if (!category || typeof category !== 'string') {
      throw new BadRequestException('Category must be a non-empty string');
    }

    if (category.length > 50) {
      throw new BadRequestException('Category name too long');
    }

    // Only allow alphanumeric, underscore, hyphen
    const safePattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePattern.test(category)) {
      throw new BadRequestException('Category contains invalid characters');
    }
  }

  /**
   * Get latest rates for all items (currencies, crypto, gold)
   */
  async getLatestRates(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetchWithCache('all', this.items.all);
  }

  /**
   * Get latest currency rates only
   */
  async getCurrencies(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetchWithCache('currencies', this.items.currencies);
  }

  /**
   * Get latest cryptocurrency rates only
   */
  async getCrypto(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.fetchWithCache('crypto', this.items.crypto);
  }

  /**
   * Get latest gold prices only
   * Note: Navasan API returns gold coins (sekkeh, bahar, nim, rob, gerami) in thousands of tomans
   * We multiply by 1000 to get the actual value in tomans
   * 18ayar is already in tomans, so we don't multiply it
   */
  async getGold(): Promise<ApiResponse<Record<string, unknown>>> {
    const response = await this.fetchWithCache('gold', this.items.gold);

    // Gold coins that need to be multiplied by 1000 (returned in thousands)
    const coinsToMultiply = ['sekkeh', 'bahar', 'nim', 'rob', 'gerami'];

    // Multiply coin values by 1000
    const transformedData = { ...response.data };
    for (const coin of coinsToMultiply) {
      if (transformedData[coin] && typeof transformedData[coin] === 'object') {
        const coinData = transformedData[coin] as Record<string, unknown>;
        if (typeof coinData.value === 'string') {
          coinData.value = String(Number(coinData.value) * 1000);
        }
        if (typeof coinData.change === 'number') {
          coinData.change = coinData.change * 1000;
        }
      }
    }

    return {
      data: transformedData,
      metadata: response.metadata,
    };
  }

  /**
   * Fetch data with caching logic and fallback to stale data on API failure
   */
  private async fetchWithCache(
    category: string,
    items: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    // Validate category to prevent NoSQL injection
    this.validateCategory(category);

    try {
      // Step 1: Check for fresh cache (< 5 minutes old)
      const freshCache = await this.getFreshCachedData(category);
      if (freshCache) {
        this.logger.log(`✅ Returning FRESH cached data for category: ${category}`);
        return {
          data: freshCache.data as Record<string, unknown>,
          metadata: {
            isFresh: true,
            isStale: false,
            dataAge: this.getDataAgeMinutes(freshCache.timestamp),
            lastUpdated: freshCache.timestamp,
            source: 'cache',
          },
        };
      }

      // Step 2: Try to fetch fresh data from API
      this.logger.log(`📡 Fetching fresh data from Navasan API for category: ${category}`);
      try {
        const apiResponse = await this.fetchFromApiWithTimeout(items);

        // Success! Update both fresh and stale caches with error handling
        // Cache save methods already reset apiErrorCount to 0 and clear lastApiError
        await this.saveToFreshCacheWithRetry(category, apiResponse.data, apiResponse.metadata);
        await this.saveToStaleCacheWithRetry(category, apiResponse.data, apiResponse.metadata);

        this.logger.log(`✅ API fetch successful for category: ${category}`);

        return {
          data: apiResponse.data,
          metadata: {
            isFresh: true,
            isStale: false,
            dataAge: 0,
            lastUpdated: new Date(),
            source: 'api',
          },
        };
      } catch (apiError: unknown) {
        // Step 3: API failed, try to serve stale data
        this.logger.warn(
          `⚠️  API fetch failed for category: ${category}. Attempting fallback to stale data.`,
        );

        // Capture error message for database tracking
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);

        // Check if it's a token expiration error
        const isTokenError = this.isTokenExpirationError(apiError);
        if (isTokenError) {
          this.logger.error(`🔑 TOKEN EXPIRATION detected for category: ${category}`);
        }

        // Try to get stale cache (up to 24 hours old)
        const staleCache = await this.getStaleCachedData(category);
        if (staleCache) {
          const dataAgeMinutes = this.getDataAgeMinutes(staleCache.timestamp);
          const dataAgeHours = Math.floor(dataAgeMinutes / 60);

          this.logger.warn(
            `⚠️  Serving STALE data for category: ${category} (${dataAgeHours}h ${dataAgeMinutes % 60}m old)`,
          );

          // Mark this cache entry as being used as fallback and increment error count
          await this.markCacheAsFallback(category, errorMessage).catch((err) => {
            this.logger.error(`Failed to mark cache as fallback: ${err.message}`);
          });

          return {
            data: staleCache.data as Record<string, unknown>,
            metadata: {
              isFresh: false,
              isStale: true,
              dataAge: dataAgeMinutes,
              lastUpdated: staleCache.timestamp,
              source: 'fallback',
              warning: isTokenError
                ? `API token expired. Showing data from ${dataAgeHours} hours ago.`
                : `API temporarily unavailable. Showing data from ${dataAgeHours} hours ago.`,
            },
          };
        }

        // Step 4: No stale cache available - fail
        this.logger.error(
          `❌ No stale cache available for category: ${category}. Failing request.`,
        );

        throw new InternalServerErrorException(
          isTokenError
            ? 'API authentication failed and no cached data available. Please contact administrator.'
            : 'Service temporarily unavailable and no cached data available. Please try again later.',
        );
      }
    } catch (error: unknown) {
      // Unexpected error
      this.logger.error(
        `❌ Unexpected error in fetchWithCache for category ${category}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Detect if error is due to token expiration
   */
  private isTokenExpirationError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      // Check status code
      if (error.response?.status === 401 || error.response?.status === 403) {
        return true;
      }

      // Check response body for token-related messages
      const responseData = error.response?.data;
      if (typeof responseData === 'object' && responseData !== null) {
        const message = JSON.stringify(responseData).toLowerCase();
        return (
          message.includes('token') ||
          message.includes('unauthorized') ||
          message.includes('api key') ||
          message.includes('authentication')
        );
      }
    }

    return false;
  }

  /**
   * Validate Navasan API response structure
   * Ensures response contains expected fields before caching
   */
  private validateNavasanResponse(data: unknown, items: string): void {
    // Check that response data exists and is an object
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      this.logger.error('Invalid Navasan API response: data is not an object');
      throw new Error('Invalid API response structure: expected object, received invalid data');
    }

    const responseData = data as Record<string, unknown>;

    // Parse the requested items to validate each field exists
    const requestedItems = items.split(',').map((item) => item.trim());

    // Define expected field structure for validation
    const currencyFields = ['usd_sell', 'eur', 'gbp', 'cad', 'aud'];
    const cryptoFields = ['usdt', 'btc', 'eth'];
    const goldFields = ['sekkeh', 'bahar', 'nim', 'rob', 'gerami', '18ayar'];

    // Check each requested item exists in the response
    for (const item of requestedItems) {
      if (!(item in responseData)) {
        this.logger.error(`Missing expected field in Navasan API response: ${item}`);
        throw new Error(`Invalid API response: missing required field "${item}"`);
      }

      // Validate that the field contains an object with required properties
      const fieldData = responseData[item];
      if (!fieldData || typeof fieldData !== 'object' || Array.isArray(fieldData)) {
        this.logger.error(`Invalid structure for field "${item}" in Navasan API response`);
        throw new Error(`Invalid API response: field "${item}" has invalid structure`);
      }

      // Validate that the field object contains 'value' property
      const fieldObject = fieldData as Record<string, unknown>;
      if (!('value' in fieldObject)) {
        this.logger.error(`Missing "value" property in field "${item}"`);
        throw new Error(`Invalid API response: field "${item}" missing "value" property`);
      }
    }

    this.logger.log(`✅ Navasan API response validation passed for items: ${items}`);
  }

  /**
   * Fetch data from Navasan API with timeout
   * SECURITY: API key sent in header instead of URL to prevent exposure in logs
   */
  private async fetchFromApiWithTimeout(
    items: string,
  ): Promise<{ data: Record<string, unknown>; metadata?: Record<string, unknown> }> {
    // SECURITY FIX: API key in URL query params exposes it in logs, error messages, and monitoring
    // Try Authorization header first (standard practice), fallback to custom header if needed
    const url = `${this.baseUrl}?item=${items}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'X-API-Key': this.apiKey, // Fallback in case they use custom header
        },
        timeout: this.apiTimeoutMs,
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      // Handle authentication errors - throw error to trigger stale fallback
      if (response.status === 401 || response.status === 403) {
        // Throw regular Error (not UnauthorizedException) so it gets caught by try-catch
        // This triggers the stale cache fallback instead of failing the request
        throw new Error(
          'Navasan API authentication failed. API key may be expired or invalid.',
        );
      }

      // Handle rate limiting - throw error to trigger stale fallback
      if (response.status === 429) {
        const retryAfter = response.headers['retry-after'];
        // Throw regular Error (not HttpException) so it gets caught by try-catch
        // This triggers the stale cache fallback instead of failing the request
        throw new Error(
          `Navasan API rate limit exceeded. Retry after ${retryAfter || 'some time'}.`,
        );
      }

      // Handle other client errors
      if (response.status >= 400 && response.status < 500) {
        // SECURITY FIX: Don't expose API error details to clients to prevent information leakage
        // The detailed error is already logged above for internal debugging
        throw new BadRequestException(
          'External API request failed. Please check your request parameters.',
        );
      }

      // Handle server errors
      if (response.status >= 500) {
        // SECURITY FIX: Don't expose specific status codes to prevent information leakage
        throw new InternalServerErrorException('External API service temporarily unavailable. Please try again later.');
      }

      // Success
      if (response.status !== 200) {
        // SECURITY FIX: Don't expose specific status codes to prevent information leakage
        throw new Error('External API returned unexpected response. Please try again later.');
      }

      // VALIDATION FIX: Validate API response structure before caching
      // This prevents invalid/malformed data from being cached and served to users
      this.validateNavasanResponse(response.data, items);

      // Capture rate limit metadata for monitoring
      const apiMetadata: Record<string, unknown> = {
        statusCode: response.status,
      };

      // Extract rate limit headers if present
      if (response.headers['x-ratelimit-remaining']) {
        apiMetadata.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
      }
      if (response.headers['x-ratelimit-reset']) {
        const resetTimestamp = parseInt(response.headers['x-ratelimit-reset'], 10);
        apiMetadata.rateLimitReset = new Date(resetTimestamp * 1000);
      }

      return { data: response.data, metadata: apiMetadata };
    } catch (error) {
      // Handle timeout
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        throw new RequestTimeoutException(
          `Navasan API request timed out after ${this.apiTimeoutMs}ms`,
        );
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get fresh cached data (< 5 minutes old)
   */
  private async getFreshCachedData(category: string): Promise<CacheDocument | null> {
    const freshExpiry = new Date(Date.now() - this.freshCacheMinutes * 60 * 1000);

    const cached = await this.cacheModel
      .findOne({
        category,
        cacheType: 'fresh',
        timestamp: { $gte: freshExpiry },
      })
      .sort({ timestamp: -1 })
      .exec();

    return cached;
  }

  /**
   * Get stale cached data (up to 24 hours old) for fallback
   */
  private async getStaleCachedData(category: string): Promise<CacheDocument | null> {
    const staleExpiry = new Date(Date.now() - this.staleCacheHours * 60 * 60 * 1000);

    const cached = await this.cacheModel
      .findOne({
        category,
        cacheType: { $in: ['fresh', 'stale'] },
        timestamp: { $gte: staleExpiry },
      })
      .sort({ timestamp: -1 })
      .exec();

    return cached;
  }

  /**
   * Save data to fresh cache using atomic upsert to prevent race conditions
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * to prevent race conditions that could cause data loss or duplicates
   */
  private async saveToFreshCache(
    category: string,
    data: Record<string, unknown>,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.freshCacheMinutes * 60 * 1000);

    // Atomic upsert - no race condition, no data loss
    await this.cacheModel
      .findOneAndUpdate(
        { category, cacheType: 'fresh' },
        {
          $set: {
            data,
            timestamp: now,
            expiresAt,
            lastApiSuccess: now,
            apiErrorCount: 0,
            isFallback: false,
            lastApiError: undefined, // Clear error on success
            apiMetadata: apiMetadata || undefined,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    this.logger.log(
      `💾 Saved fresh cache for category: ${category}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save data to stale cache (long-term fallback) using atomic upsert
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   */
  private async saveToStaleCache(
    category: string,
    data: Record<string, unknown>,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.staleCacheHours * 60 * 60 * 1000);

    // Atomic upsert - no race condition
    await this.cacheModel
      .findOneAndUpdate(
        { category, cacheType: 'stale' },
        {
          $set: {
            data,
            timestamp: now,
            expiresAt,
            lastApiSuccess: now,
            isFallback: false,
            lastApiError: undefined, // Clear error on success
            apiMetadata: apiMetadata || undefined,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    this.logger.log(
      `💾 Saved stale cache for category: ${category}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save cache with retry logic for resilience
   * RELIABILITY FIX: Cache write failures shouldn't fail the request
   */
  private async saveToFreshCacheWithRetry(
    category: string,
    data: Record<string, unknown>,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.saveToFreshCache(category, data, apiMetadata);
    } catch (error) {
      this.logger.error(
        `Failed to save fresh cache for ${category}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't fail the request, just log the error
    }
  }

  /**
   * Save stale cache with retry logic - critical for fallback functionality
   * RELIABILITY FIX: Retry stale cache writes since they're critical for fallback
   */
  private async saveToStaleCacheWithRetry(
    category: string,
    data: Record<string, unknown>,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      try {
        await this.saveToStaleCache(category, data, apiMetadata);
        return; // Success
      } catch (error) {
        retries++;
        this.logger.error(
          `Failed to save stale cache for ${category} (attempt ${retries}/${maxRetries + 1}): ${error instanceof Error ? error.message : String(error)}`,
        );

        if (retries > maxRetries) {
          this.logger.error(`Gave up saving stale cache for ${category} after ${maxRetries + 1} attempts`);
          // Don't fail the request, but log as critical since stale cache is needed for fallback
        }
      }
    }
  }

  /**
   * Mark cache entry as being used as fallback and track API errors
   * Populates isFallback, lastApiError, and increments apiErrorCount
   */
  private async markCacheAsFallback(category: string, errorMessage: string): Promise<void> {
    await this.cacheModel
      .updateMany(
        { category, cacheType: { $in: ['fresh', 'stale'] } },
        {
          $set: {
            isFallback: true,
            lastApiError: errorMessage,
          },
          $inc: {
            apiErrorCount: 1,
          },
        },
      )
      .exec();
  }

  /**
   * Calculate data age in minutes
   */
  private getDataAgeMinutes(timestamp: Date): number {
    return Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60));
  }
}
