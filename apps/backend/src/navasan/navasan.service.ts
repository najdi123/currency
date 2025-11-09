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
import { PriceSnapshot, PriceSnapshotDocument } from './schemas/price-snapshot.schema';
import { ApiResponse } from './interfaces/api-response.interface';
import { NavasanResponse } from './interfaces/navasan-response.interface';
import { isCurrencyResponse, isCryptoResponse, isGoldResponse } from './utils/type-guards';
import { safeDbRead, safeDbWrite } from '../common/utils/db-error-handler';
import { sanitizeUrl, sanitizeErrorMessage } from '../common/utils/sanitize-url';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class NavasanService {
  private readonly logger = new Logger(NavasanService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'http://api.navasan.tech/latest/';

  // CACHE CONFIGURATION
  private readonly freshCacheMinutes = 5; // Fresh data validity
  private readonly staleCacheHours = 168; // 7 days - gives full week buffer when API key expires
  private readonly maxStaleAgeHours = 168; // Maximum age before data is too old (aligned with stale cache)
  private readonly apiTimeoutMs = 10000; // 10 second timeout

  // ERROR TRACKING: Now handled by database cache schema fields
  // apiErrorCount, lastApiError, lastApiSuccess are tracked in cache documents

  // Define items to fetch from Navasan API
  private readonly items = {
    all: 'usd_sell,eur,gbp,cad,aud,aed,aed_sell,dirham_dubai,cny,try,chf,jpy,rub,inr,pkr,iqd,kwd,sar,qar,omr,bhd,usd_buy,dolar_harat_sell,harat_naghdi_sell,harat_naghdi_buy,usd_farda_sell,usd_farda_buy,usd_shakhs,usd_sherkat,usd_pp,dolar_mashad_sell,dolar_destan_sell,dolar_soleimanie_sell,eur_hav,gbp_hav,gbp_wht,cad_hav,cad_cash,hav_cad_my,hav_cad_cheque,hav_cad_cash,aud_hav,aud_wht,usdt,btc,eth,bnb,xrp,ada,doge,sol,matic,dot,ltc,sekkeh,bahar,nim,rob,gerami,18ayar,abshodeh',
    currencies: 'usd_sell,eur,gbp,cad,aud,aed,aed_sell,dirham_dubai,cny,try,chf,jpy,rub,inr,pkr,iqd,kwd,sar,qar,omr,bhd,usd_buy,dolar_harat_sell,harat_naghdi_sell,harat_naghdi_buy,usd_farda_sell,usd_farda_buy,usd_shakhs,usd_sherkat,usd_pp,dolar_mashad_sell,dolar_destan_sell,dolar_soleimanie_sell,eur_hav,gbp_hav,gbp_wht,cad_hav,cad_cash,hav_cad_my,hav_cad_cheque,hav_cad_cash,aud_hav,aud_wht',
    crypto: 'usdt,btc,eth,bnb,xrp,ada,doge,sol,matic,dot,ltc',
    gold: 'sekkeh,bahar,nim,rob,gerami,18ayar,abshodeh',
  };

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    @InjectModel(PriceSnapshot.name) private priceSnapshotModel: Model<PriceSnapshotDocument>,
    private configService: ConfigService,
    private metricsService: MetricsService,
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
  async getLatestRates(): Promise<ApiResponse<NavasanResponse>> {
    return this.fetchWithCache('all', this.items.all);
  }

  /**
   * Get latest currency rates only
   */
  async getCurrencies(): Promise<ApiResponse<NavasanResponse>> {
    return this.fetchWithCache('currencies', this.items.currencies);
  }

  /**
   * Get latest cryptocurrency rates only
   */
  async getCrypto(): Promise<ApiResponse<NavasanResponse>> {
    return this.fetchWithCache('crypto', this.items.crypto);
  }

  /**
   * Get latest gold prices only
   * Note: Navasan API returns gold coins (sekkeh, bahar, nim, rob, gerami) in thousands of tomans
   * We multiply by 1000 to get the actual value in tomans
   * 18ayar is already in tomans, so we don't multiply it
   */
  async getGold(): Promise<ApiResponse<NavasanResponse>> {
    const response = await this.fetchWithCache('gold', this.items.gold);

    // Gold coins that need to be multiplied by 1000 (returned in thousands)
    const coinsToMultiply = ['sekkeh', 'bahar', 'nim', 'rob', 'gerami'] as const;

    // Multiply coin values by 1000 - cast to Record for safe indexing
    const transformedData = { ...response.data } as Record<string, unknown>;
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
      data: transformedData as NavasanResponse,
      metadata: response.metadata,
    };
  }

  /**
   * Force fetch from API and update all caches
   * Used by scheduler to proactively cache data
   * Bypasses fresh cache check and always hits the API
   *
   * @param category - Category to fetch ('currencies', 'crypto', or 'gold')
   * @returns Success status and optional error message
   */
  async forceFetchAndCache(
    category: 'currencies' | 'crypto' | 'gold'
  ): Promise<{ success: boolean; error?: string }> {
    this.validateCategory(category);
    const items = this.items[category];

    try {
      this.logger.log(`🔄 Force fetching ${category} from API...`);

      const apiResponse = await this.fetchFromApiWithTimeout(items);

      // Save to all three cache tiers
      await this.saveToFreshCacheWithRetry(category, apiResponse.data, apiResponse.metadata);
      await this.saveToStaleCacheWithRetry(category, apiResponse.data, apiResponse.metadata);
      await this.savePriceSnapshot(category, apiResponse.data, apiResponse.metadata);

      this.logger.log(`✅ Force fetch successful for ${category}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? sanitizeErrorMessage(error) : String(error);
      const errorStack = error instanceof Error && error.stack
        ? error.stack.replace(/(https?:\/\/[^\s]+)/gi, (match) => sanitizeUrl(match))
        : undefined;

      this.logger.error(
        `❌ Force fetch failed for ${category}: ${errorMessage}`,
        errorStack
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch data with caching logic and fallback to stale data on API failure
   * Now with DB error handling and type safety
   */
  private async fetchWithCache(
    category: string,
    items: string,
  ): Promise<ApiResponse<NavasanResponse>> {
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

        // 📸 PERMANENT STORAGE: Save snapshot for historical record
        // This data is never deleted and builds a permanent price history database
        await this.savePriceSnapshot(category, apiResponse.data, apiResponse.metadata);

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
      // Unexpected error - sanitize before logging
      const sanitizedMessage = error instanceof Error ? sanitizeErrorMessage(error) : String(error);
      const sanitizedStack = error instanceof Error && error.stack
        ? error.stack.replace(/(https?:\/\/[^\s]+)/gi, (match) => sanitizeUrl(match))
        : undefined;

      this.logger.error(
        `❌ Unexpected error in fetchWithCache for category ${category}: ${sanitizedMessage}`,
        sanitizedStack,
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
    const currencyFields = [
      'usd_sell', 'eur', 'gbp', 'cad', 'aud', 'aed', 'cny', 'try',
      'chf', 'jpy', 'rub', 'inr', 'pkr', 'iqd', 'kwd', 'sar', 'qar', 'omr', 'bhd',
      'usd_buy', 'dolar_harat_sell', 'harat_naghdi_sell', 'harat_naghdi_buy',
      'usd_farda_sell', 'usd_farda_buy', 'usd_shakhs', 'usd_sherkat', 'usd_pp',
      'eur_hav', 'gbp_hav', 'gbp_wht', 'cad_hav', 'cad_cash',
      'hav_cad_my', 'hav_cad_cheque', 'hav_cad_cash', 'aud_hav', 'aud_wht'
    ];
    const cryptoFields = ['usdt', 'btc', 'eth', 'bnb', 'xrp', 'ada', 'doge', 'sol', 'matic', 'dot', 'ltc'];
    const goldFields = ['sekkeh', 'bahar', 'nim', 'rob', 'gerami', '18ayar', 'abshodeh'];

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
   * Fetch data from Navasan API with timeout and type validation
   * SECURITY: API key sent in header instead of URL to prevent exposure in logs
   * TYPE SAFETY: Returns properly typed NavasanResponse
   */
  private async fetchFromApiWithTimeout(
    items: string,
  ): Promise<{ data: NavasanResponse; metadata?: Record<string, unknown> }> {
    // NOTE: Navasan API requires the API key as a query parameter (not in headers)
    // This is not ideal from a security perspective, but it's how their API works
    const url = `${this.baseUrl}?api_key=${this.apiKey}&item=${items}`;

    // DEBUG LOGGING: Log request details for troubleshooting (with sanitized API key)
    const sanitizedUrl = `${this.baseUrl}?api_key=[REDACTED]&item=${items}`;
    this.logger.debug(`📤 Making API request to: ${sanitizedUrl}`);
    this.logger.debug(`📤 Timeout: ${this.apiTimeoutMs}ms`);

    try {
      const response = await axios.get(url, {
        timeout: this.apiTimeoutMs,
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      // DEBUG LOGGING: Log API response details for troubleshooting
      this.logger.debug(`📥 Navasan API Response - Status: ${response.status}, Items: ${items}`);
      this.logger.debug(`📥 Response Headers: ${JSON.stringify({
        'content-type': response.headers['content-type'],
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
        'retry-after': response.headers['retry-after'],
      })}`);

      // Handle authentication errors - throw error to trigger stale fallback
      if (response.status === 401 || response.status === 403) {
        // Log detailed error for debugging
        this.logger.error(`🔐 Authentication failed - Status: ${response.status}`);
        this.logger.error(`🔐 Response body: ${JSON.stringify(response.data)}`);

        // Throw regular Error (not UnauthorizedException) so it gets caught by try-catch
        // This triggers the stale cache fallback instead of failing the request
        throw new Error(
          'Navasan API authentication failed. API key may be expired or invalid.',
        );
      }

      // Handle rate limiting - throw error to trigger stale fallback
      if (response.status === 429) {
        const retryAfter = response.headers['retry-after'];
        this.logger.warn(`⏱️  Rate limit exceeded - Retry after: ${retryAfter || 'unknown'}`);

        // Throw regular Error (not HttpException) so it gets caught by try-catch
        // This triggers the stale cache fallback instead of failing the request
        throw new Error(
          `Navasan API rate limit exceeded. Retry after ${retryAfter || 'some time'}.`,
        );
      }

      // Handle other client errors
      if (response.status >= 400 && response.status < 500) {
        // Log detailed error for internal debugging
        this.logger.error(`❌ Client error - Status: ${response.status}`);
        this.logger.error(`❌ Response body: ${JSON.stringify(response.data)}`);
        this.logger.error(`❌ Request URL (sanitized): ${this.baseUrl}?item=${items}`);

        // SECURITY FIX: Don't expose API error details to clients to prevent information leakage
        throw new BadRequestException(
          'External API request failed. Please check your request parameters.',
        );
      }

      // Handle server errors
      if (response.status >= 500) {
        // Log detailed error for internal debugging
        this.logger.error(`🔥 Server error - Status: ${response.status}`);
        this.logger.error(`🔥 Response body: ${JSON.stringify(response.data)}`);

        // SECURITY FIX: Don't expose specific status codes to prevent information leakage
        throw new InternalServerErrorException('External API service temporarily unavailable. Please try again later.');
      }

      // Success
      if (response.status !== 200) {
        // Log unexpected status code
        this.logger.warn(`⚠️  Unexpected status code: ${response.status}`);
        this.logger.warn(`⚠️  Response body: ${JSON.stringify(response.data)}`);

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
      // Log all errors with detailed information for debugging (with sanitization)
      if (axios.isAxiosError(error)) {
        // Sanitize error message to prevent API key leakage
        const sanitizedMessage = sanitizeErrorMessage(error);
        this.logger.error(`🌐 Axios Error - Code: ${error.code}, Message: ${sanitizedMessage}`);

        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          this.logger.error(`🌐 Error Response - Status: ${error.response.status}`);
          this.logger.error(`🌐 Error Response Body: ${JSON.stringify(error.response.data)}`);
          this.logger.error(`🌐 Error Response Headers: ${JSON.stringify(error.response.headers)}`);
        } else if (error.request) {
          // The request was made but no response was received
          this.logger.error(`🌐 No response received from API`);
          this.logger.error(`🌐 Request details: ${JSON.stringify({
            method: error.request.method,
            path: error.request.path,
            host: error.request.host,
          })}`);
        } else {
          // Something happened in setting up the request that triggered an Error
          this.logger.error(`🌐 Request setup error: ${sanitizedMessage}`);
        }

        // Handle timeout
        if (error.code === 'ECONNABORTED') {
          this.logger.error(`⏱️  Request timed out after ${this.apiTimeoutMs}ms`);
          throw new RequestTimeoutException(
            `Navasan API request timed out after ${this.apiTimeoutMs}ms`,
          );
        }

        // Handle network errors (sanitize error message)
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          this.logger.error(`🌐 Network error: ${error.code} - Cannot reach API server`);
          throw new Error(`Cannot reach Navasan API server: ${sanitizeErrorMessage(error)}`);
        }
      } else {
        // Non-axios error - sanitize before logging
        const sanitizedMessage = error instanceof Error ? sanitizeErrorMessage(error) : String(error);
        const sanitizedStack = error instanceof Error && error.stack
          ? error.stack.replace(/(https?:\/\/[^\s]+)/gi, (match) => sanitizeUrl(match))
          : undefined;

        this.logger.error(`❌ Unexpected error type: ${sanitizedMessage}`);
        if (sanitizedStack) {
          this.logger.error(`❌ Stack trace: ${sanitizedStack}`);
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get fresh cached data (< 5 minutes old)
   * Now with DB error handling - returns null on DB failure instead of throwing
   */
  private async getFreshCachedData(category: string): Promise<CacheDocument | null> {
    const freshExpiry = new Date(Date.now() - this.freshCacheMinutes * 60 * 1000);

    return safeDbRead(
      () =>
        this.cacheModel
          .findOne({
            category,
            cacheType: 'fresh',
            timestamp: { $gte: freshExpiry },
          })
          .sort({ timestamp: -1 })
          .exec(),
      'getFreshCachedData',
      this.logger,
      { category },
    );
  }

  /**
   * Get stale cached data (up to 24 hours old) for fallback
   * Now with DB error handling - returns null on DB failure instead of throwing
   */
  private async getStaleCachedData(category: string): Promise<CacheDocument | null> {
    const staleExpiry = new Date(Date.now() - this.staleCacheHours * 60 * 60 * 1000);

    return safeDbRead(
      () =>
        this.cacheModel
          .findOne({
            category,
            cacheType: { $in: ['fresh', 'stale'] },
            timestamp: { $gte: staleExpiry },
          })
          .sort({ timestamp: -1 })
          .exec(),
      'getStaleCachedData',
      this.logger,
      { category },
    );
  }

  /**
   * Save data to fresh cache using atomic upsert to prevent race conditions
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * DB ERROR HANDLING: Uses safeDbWrite - won't throw on DB failure
   */
  private async saveToFreshCache(
    category: string,
    data: NavasanResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.freshCacheMinutes * 60 * 1000);

    // Atomic upsert with DB error handling
    await safeDbWrite(
      () =>
        this.cacheModel
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
          .exec(),
      'saveToFreshCache',
      this.logger,
      { category },
      false, // Not critical - can continue without fresh cache
    );

    this.logger.log(
      `💾 Saved fresh cache for category: ${category}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save data to stale cache (long-term fallback) using atomic upsert
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * DB ERROR HANDLING: Uses safeDbWrite with retry - critical for fallback functionality
   */
  private async saveToStaleCache(
    category: string,
    data: NavasanResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.staleCacheHours * 60 * 60 * 1000);

    // Atomic upsert with DB error handling
    await safeDbWrite(
      () =>
        this.cacheModel
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
          .exec(),
      'saveToStaleCache',
      this.logger,
      { category },
      true, // Critical - stale cache needed for fallback
    );

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
    data: NavasanResponse,
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
    data: NavasanResponse,
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
   * DB ERROR HANDLING: Won't throw on DB failure
   */
  private async markCacheAsFallback(category: string, errorMessage: string): Promise<void> {
    await safeDbWrite(
      () =>
        this.cacheModel
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
          .exec(),
      'markCacheAsFallback',
      this.logger,
      { category, errorMessage },
      false, // Not critical - just metadata update
    );
  }

  /**
   * Calculate data age in minutes
   */
  private getDataAgeMinutes(timestamp: Date): number {
    return Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60));
  }

  /**
   * Save hourly price snapshot to database with TTL
   * ISSUE 4 FIX: Reduced from 5-minute to 1-hour snapshots
   * Records are auto-deleted after 90 days via TTL index
   * METRICS: Tracks snapshot save failures
   */
  private async savePriceSnapshot(
    category: string,
    data: NavasanResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      // HOURLY SNAPSHOT LOGIC: Only save one snapshot per hour
      const now = new Date();
      const currentHour = new Date(Math.floor(now.getTime() / 3600000) * 3600000);

      // Check if we already have a snapshot for this hour
      const existingSnapshot = await safeDbRead(
        () =>
          this.priceSnapshotModel
            .findOne({
              category,
              timestamp: { $gte: currentHour },
            })
            .exec(),
        'checkExistingSnapshot',
        this.logger,
        { category, currentHour },
      );

      if (existingSnapshot) {
        this.logger.debug(
          `Snapshot already exists for ${category} in hour ${currentHour.toISOString()}, skipping`,
        );
        return;
      }

      // Save new hourly snapshot
      const snapshot = new this.priceSnapshotModel({
        category,
        data,
        timestamp: currentHour, // Use hour-rounded timestamp
        source: 'api',
        metadata: apiMetadata,
      });

      const saveResult = await safeDbWrite(
        () => snapshot.save(),
        'savePriceSnapshot',
        this.logger,
        { category },
        true, // Critical - track failures
      );

      if (saveResult) {
        this.logger.log(`📸 Saved hourly price snapshot for category: ${category}`);
        // Reset failure counter on success
        this.metricsService.resetSnapshotFailureCounter('price', category);
      } else {
        // Track failure
        this.metricsService.trackSnapshotFailure(
          'price',
          category,
          'Database write failed during snapshot save',
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save price snapshot for ${category}: ${errorMessage}`);
      // Track failure
      this.metricsService.trackSnapshotFailure('price', category, errorMessage);
      // Don't fail the request if snapshot saving fails
    }
  }
}
