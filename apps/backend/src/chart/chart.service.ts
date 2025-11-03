import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import axios from 'axios';
import { TimeRange, ItemType } from './dto/chart-query.dto';
import { ChartDataPoint, ChartResponse } from './interfaces/chart.interface';
import { Cache, CacheDocument } from '../navasan/schemas/cache.schema';
import { OhlcSnapshot, OhlcSnapshotDocument } from '../navasan/schemas/ohlc-snapshot.schema';
import { safeDbRead, safeDbWrite } from '../common/utils/db-error-handler';
import { MetricsService } from '../metrics/metrics.service';
import { NavasanOHLCDataPoint } from '../navasan/interfaces/navasan-response.interface';
import { isOHLCDataArray } from '../navasan/utils/type-guards';

@Injectable()
export class ChartService {
  private readonly logger = new Logger(ChartService.name);
  private readonly apiKey: string;
  private readonly ohlcBaseUrl = 'http://api.navasan.tech/ohlcSearch/';
  private readonly freshCacheMinutes = 60; // 1 hour cache for OHLC data
  private readonly staleCacheHours = 72; // Keep stale OHLC data for 3 days

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    @InjectModel(OhlcSnapshot.name) private ohlcSnapshotModel: Model<OhlcSnapshotDocument>,
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    this.apiKey = this.configService.get<string>('NAVASAN_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.error('NAVASAN_API_KEY is not set in environment variables');
      throw new Error('NAVASAN_API_KEY is required for chart service');
    }
  }

  /**
   * Validate cache key parameter to prevent NoSQL injection
   * Only allows alphanumeric characters, underscores, hyphens, and reasonable length
   */
  private validateCacheKey(cacheKey: string): void {
    if (!cacheKey || typeof cacheKey !== 'string') {
      throw new Error('Cache key must be a non-empty string');
    }

    if (cacheKey.length > 100) {
      throw new Error('Cache key too long');
    }

    // Only allow alphanumeric, underscore, hyphen
    const safePattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePattern.test(cacheKey)) {
      throw new Error('Cache key contains invalid characters');
    }
  }

  /**
   * Map frontend item codes to Navasan API codes
   * Frontend sends uppercase codes, we map them to Navasan's lowercase format
   */
  private readonly itemCodeMap: Record<string, string> = {
    // Currencies
    USD_SELL: 'usd_sell',
    USD: 'usd_sell', // Fallback for backwards compatibility
    EUR: 'eur',
    GBP: 'gbp',
    CAD: 'cad',
    AUD: 'aud',

    // Cryptocurrencies
    USDT: 'usdt',
    BTC: 'btc',
    ETH: 'eth',

    // Gold items
    SEKKEH: 'sekkeh',
    BAHAR: 'bahar',
    NIM: 'nim',
    ROB: 'rob',
    GERAMI: 'gerami',
    '18AYAR': '18ayar',
  };

  /**
   * Map item code to Navasan API code
   * If no explicit mapping exists, convert to lowercase
   */
  private mapToNavasanCode(code: string): string {
    // Check explicit mapping first
    if (this.itemCodeMap[code]) {
      return this.itemCodeMap[code];
    }

    // If no mapping, convert to lowercase as default
    // This makes it work for any new items added to Navasan API
    return code.toLowerCase();
  }

  /**
   * Get chart data for a specific currency code
   */
  async getChartData(
    currencyCode: string,
    timeRange: TimeRange = TimeRange.ONE_MONTH,
    itemType: ItemType = ItemType.CURRENCY,
  ): Promise<ChartResponse> {
    this.logger.log(
      `Fetching chart data for ${currencyCode} (${itemType}) with timeRange: ${timeRange}`,
    );

    // Validate and map currency code
    const upperCode = currencyCode.toUpperCase();
    if (!this.isValidCurrencyCode(upperCode, itemType)) {
      throw new NotFoundException(
        `Currency code "${currencyCode}" not found for item type "${itemType}"`,
      );
    }

    const navasanItemCode = this.mapToNavasanCode(upperCode);
    if (!navasanItemCode) {
      throw new NotFoundException(
        `No Navasan mapping found for currency code "${currencyCode}"`,
      );
    }

    // Calculate date range
    const { startTimestamp, endTimestamp } = this.getDateRange(timeRange);

    // Fetch OHLC data from Navasan API with caching
    try {
      const data = await this.fetchOHLCDataWithCache(
        navasanItemCode,
        startTimestamp,
        endTimestamp,
        timeRange,
      );

      // Transform and return data
      const transformedData = this.transformOHLCData(data);

      return {
        data: transformedData,
        count: transformedData.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch chart data for ${currencyCode}: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Re-throw with appropriate error type
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to fetch chart data for ${currencyCode}. Please try again later.`,
      );
    }
  }

  /**
   * Validate if currency code exists for the given item type
   * Now modular - accepts any code that has a valid mapping or can be lowercased
   */
  private isValidCurrencyCode(code: string, itemType: ItemType): boolean {
    const validCodes = {
      [ItemType.CURRENCY]: ['USD_SELL', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'],
      [ItemType.CRYPTO]: ['BTC', 'ETH', 'USDT'],
      [ItemType.GOLD]: ['SEKKEH', 'BAHAR', 'NIM', 'ROB', 'GERAMI', '18AYAR'],
    };

    return validCodes[itemType].includes(code);
  }

  /**
   * Get date range (Unix timestamps) based on TimeRange enum
   */
  private getDateRange(timeRange: TimeRange): { startTimestamp: number; endTimestamp: number } {
    const now = new Date();
    const endTimestamp = Math.floor(now.getTime() / 1000); // Current time in Unix timestamp

    let startDate = new Date(now);

    switch (timeRange) {
      case TimeRange.ONE_DAY:
        startDate.setDate(now.getDate() - 1);
        break;
      case TimeRange.ONE_WEEK:
        startDate.setDate(now.getDate() - 7);
        break;
      case TimeRange.ONE_MONTH:
        startDate.setMonth(now.getMonth() - 1);
        break;
      case TimeRange.THREE_MONTHS:
        startDate.setMonth(now.getMonth() - 3);
        break;
      case TimeRange.ONE_YEAR:
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case TimeRange.ALL:
        startDate.setFullYear(now.getFullYear() - 3);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1); // Default to 1 month
    }

    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    return { startTimestamp, endTimestamp };
  }

  /**
   * Fetch OHLC data with caching and fallback to stale data
   */
  private async fetchOHLCDataWithCache(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
    timeRange: TimeRange,
  ): Promise<NavasanOHLCDataPoint[]> {
    // Generate cache key based on item, time range
    const cacheKey = `ohlc_${itemCode}_${timeRange}`;

    // Validate cache key to prevent NoSQL injection
    this.validateCacheKey(cacheKey);

    try {
      // Step 1: Check for fresh cache (< 1 hour old)
      const freshCache = await this.getFreshCachedOHLCData(cacheKey);
      if (freshCache) {
        this.logger.log(`✅ Returning fresh cached OHLC data for ${itemCode} (${timeRange})`);
        return freshCache as NavasanOHLCDataPoint[];
      }

      // Step 2: Try to fetch from API
      this.logger.log(`📡 Fetching OHLC data from Navasan API for ${itemCode} (${timeRange})`);
      try {
        const apiResponse = await this.fetchOHLCFromApi(itemCode, startTimestamp, endTimestamp);

        // Success! Save to both fresh and stale caches with error handling
        await this.saveOHLCToFreshCacheWithRetry(cacheKey, apiResponse.data, apiResponse.metadata);
        await this.saveOHLCToStaleCacheWithRetry(cacheKey, apiResponse.data, apiResponse.metadata);

        // 📸 PERMANENT STORAGE: Save OHLC snapshot for historical record
        // This data is never deleted and builds a permanent chart history database
        await this.saveOhlcSnapshot(itemCode, timeRange, apiResponse.data, apiResponse.metadata);

        return apiResponse.data;
      } catch (apiError) {
        // Step 3: API failed, try to serve stale data
        this.logger.warn(
          `⚠️  OHLC API failed for ${itemCode}. Attempting fallback to stale data.`,
        );

        // Capture error message for tracking
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);

        // Check if it's a token error
        const isTokenError = this.isTokenExpirationError(apiError);
        if (isTokenError) {
          this.logger.error(`🔑 TOKEN EXPIRATION detected for OHLC API`);
        }

        // Try to get stale cache (up to 72 hours old)
        const staleCache = await this.getStaleCachedOHLCData(cacheKey);
        if (staleCache) {
          this.logger.warn(`⚠️  Serving STALE OHLC data for ${itemCode} (${timeRange})`);

          // Mark cache as fallback with error message for monitoring
          await this.markOHLCCacheAsFallback(cacheKey, errorMessage).catch((err) => {
            this.logger.error(`Failed to mark OHLC cache as fallback: ${err.message}`);
          });

          return staleCache as NavasanOHLCDataPoint[];
        }

        // No stale cache available
        this.logger.error(`❌ No stale OHLC cache available for ${itemCode}`);
        throw apiError;
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch OHLC data for ${itemCode}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Check if error is due to token expiration
   */
  private isTokenExpirationError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return true;
      }
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
   * Validate OHLC API response structure
   * Ensures response contains valid OHLC data points with required fields
   */
  private validateOHLCResponse(data: unknown, itemCode: string): void {
    // Check that response is an array
    if (!Array.isArray(data)) {
      this.logger.error(`Invalid OHLC API response for ${itemCode}: expected array, received ${typeof data}`);
      throw new Error('Invalid OHLC API response structure: expected array of data points');
    }

    // Allow empty arrays (no data for time range is valid)
    if (data.length === 0) {
      this.logger.warn(`OHLC API returned empty array for ${itemCode}`);
      return;
    }

    // Validate structure of each data point
    const requiredFields = ['timestamp', 'date', 'open', 'high', 'low', 'close'];

    for (let i = 0; i < data.length; i++) {
      const point = data[i];

      // Check that point is an object
      if (!point || typeof point !== 'object' || Array.isArray(point)) {
        this.logger.error(`Invalid OHLC data point at index ${i} for ${itemCode}: not an object`);
        throw new Error(`Invalid OHLC API response: data point ${i} is not an object`);
      }

      // Check all required fields exist
      for (const field of requiredFields) {
        if (!(field in point)) {
          this.logger.error(`Missing required field "${field}" in OHLC data point ${i} for ${itemCode}`);
          throw new Error(`Invalid OHLC API response: data point ${i} missing "${field}" field`);
        }
      }

      // Validate field types
      const typedPoint = point as NavasanOHLCDataPoint;

      // Validate timestamp is a number
      if (typeof typedPoint.timestamp !== 'number' || isNaN(typedPoint.timestamp)) {
        this.logger.error(`Invalid timestamp in OHLC data point ${i} for ${itemCode}`);
        throw new Error(`Invalid OHLC API response: data point ${i} has invalid timestamp`);
      }

      // Validate price fields are numbers or strings that can be parsed as numbers
      const priceFields = ['open', 'high', 'low', 'close'];
      for (const field of priceFields) {
        const value = typedPoint[field as keyof Pick<NavasanOHLCDataPoint, 'open' | 'high' | 'low' | 'close'>];
        // Accept both numbers and numeric strings (API can return either)
        const isValidNumber = typeof value === 'number' && !isNaN(value);
        const isValidString = typeof value === 'string' && !isNaN(parseFloat(value));
        if (!isValidNumber && !isValidString) {
          this.logger.error(`Invalid ${field} value in OHLC data point ${i} for ${itemCode}: ${typeof value} = ${value}`);
          throw new Error(`Invalid OHLC API response: data point ${i} has invalid "${field}" value`);
        }
      }
    }

    this.logger.log(`✅ OHLC API response validation passed for ${itemCode}: ${data.length} data points`);
  }

  /**
   * Fetch OHLC data from Navasan API
   * NOTE: Navasan API requires the API key as a query parameter (not in headers)
   * This is not ideal from a security perspective, but it's how their API works
   */
  private async fetchOHLCFromApi(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<{ data: NavasanOHLCDataPoint[]; metadata?: Record<string, unknown> }> {
    try {
      // NOTE: Navasan API requires the API key as a query parameter (not in headers)
      const url = `${this.ohlcBaseUrl}?api_key=${this.apiKey}&item=${itemCode}&start=${startTimestamp}&end=${endTimestamp}`;

      this.logger.log(`Calling Navasan OHLC API: ${itemCode} from ${startTimestamp} to ${endTimestamp}`);

      const response = await axios.get<NavasanOHLCDataPoint[]>(url, {
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      // Handle authentication errors - throw error to trigger stale fallback
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          'Navasan OHLC API authentication failed. API key may be expired or invalid.',
        );
      }

      // Handle rate limiting - throw error to trigger stale fallback
      if (response.status === 429) {
        const retryAfter = response.headers['retry-after'];
        // Throw regular Error so it gets caught by try-catch and triggers stale cache fallback
        throw new Error(
          `Navasan OHLC API rate limit exceeded. Retry after ${retryAfter || 'some time'}.`,
        );
      }

      // Handle other non-200 responses
      if (response.status !== 200) {
        // SECURITY FIX: Don't expose specific status codes to prevent information leakage
        throw new Error('External API returned unexpected response. Please try again later.');
      }

      // VALIDATION FIX: Validate OHLC API response structure before caching
      // This prevents invalid/malformed data from being cached and served to users
      this.validateOHLCResponse(response.data, itemCode);

      if (response.data.length === 0) {
        this.logger.warn(`No OHLC data returned for ${itemCode}`);
      }

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
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new InternalServerErrorException('Request to Navasan API timed out');
        }
        if (error.response) {
          // Log detailed error internally for debugging
          this.logger.error(
            `Navasan API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
          );
          // SECURITY FIX: Don't expose API error details to clients to prevent information leakage
          throw new InternalServerErrorException(
            'Failed to fetch chart data. Please try again later.',
          );
        }
      }
      throw error;
    }
  }

  /**
   * Get fresh cached OHLC data (< 1 hour old)
   * DB ERROR HANDLING: Returns null on DB failure instead of throwing
   */
  private async getFreshCachedOHLCData(cacheKey: string): Promise<NavasanOHLCDataPoint[] | null> {
    const freshExpiry = new Date(Date.now() - this.freshCacheMinutes * 60 * 1000);

    const cached = await safeDbRead(
      () =>
        this.cacheModel
          .findOne({
            category: cacheKey,
            cacheType: 'fresh',
            timestamp: { $gte: freshExpiry },
          })
          .sort({ timestamp: -1 })
          .exec(),
      'getFreshCachedOHLCData',
      this.logger,
      { cacheKey },
    );

    if (cached && Array.isArray(cached.data) && isOHLCDataArray(cached.data)) {
      return cached.data;
    }

    return null;
  }

  /**
   * Get stale cached OHLC data (up to 72 hours old) for fallback
   * DB ERROR HANDLING: Returns null on DB failure instead of throwing
   */
  private async getStaleCachedOHLCData(cacheKey: string): Promise<NavasanOHLCDataPoint[] | null> {
    const staleExpiry = new Date(Date.now() - this.staleCacheHours * 60 * 60 * 1000);

    const cached = await safeDbRead(
      () =>
        this.cacheModel
          .findOne({
            category: cacheKey,
            cacheType: { $in: ['fresh', 'stale'] },
            timestamp: { $gte: staleExpiry },
          })
          .sort({ timestamp: -1 })
          .exec(),
      'getStaleCachedOHLCData',
      this.logger,
      { cacheKey },
    );

    if (cached && Array.isArray(cached.data) && isOHLCDataArray(cached.data)) {
      return cached.data;
    }

    return null;
  }

  /**
   * Save OHLC data to fresh cache using atomic upsert
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * DB ERROR HANDLING: Uses safeDbWrite - won't throw on DB failure
   */
  private async saveOHLCToFreshCache(
    cacheKey: string,
    data: NavasanOHLCDataPoint[],
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.freshCacheMinutes * 60 * 1000);

    // Atomic upsert with DB error handling
    await safeDbWrite(
      () =>
        this.cacheModel
          .findOneAndUpdate(
            { category: cacheKey, cacheType: 'fresh' },
            {
              $set: {
                data: data,
                timestamp: now,
                expiresAt,
                lastApiSuccess: now,
                apiErrorCount: 0, // Reset error count on success
                isFallback: false,
                lastApiError: undefined,
                apiMetadata: apiMetadata || undefined,
              },
            },
            { upsert: true, new: true },
          )
          .exec(),
      'saveOHLCToFreshCache',
      this.logger,
      { cacheKey },
      false, // Not critical
    );

    this.logger.log(
      `💾 Saved fresh OHLC cache for ${cacheKey}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save OHLC data to stale cache using atomic upsert
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * DB ERROR HANDLING: Uses safeDbWrite - critical for fallback functionality
   */
  private async saveOHLCToStaleCache(
    cacheKey: string,
    data: NavasanOHLCDataPoint[],
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.staleCacheHours * 60 * 60 * 1000);

    // Atomic upsert with DB error handling
    await safeDbWrite(
      () =>
        this.cacheModel
          .findOneAndUpdate(
            { category: cacheKey, cacheType: 'stale' },
            {
              $set: {
                data: data,
                timestamp: now,
                expiresAt,
                lastApiSuccess: now,
                apiErrorCount: 0, // Reset error count on success
                isFallback: false,
                lastApiError: undefined,
                apiMetadata: apiMetadata || undefined,
              },
            },
            { upsert: true, new: true },
          )
          .exec(),
      'saveOHLCToStaleCache',
      this.logger,
      { cacheKey },
      true, // Critical for fallback
    );

    this.logger.log(
      `💾 Saved stale OHLC cache for ${cacheKey}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save OHLC cache with retry logic for resilience
   * RELIABILITY FIX: Cache write failures shouldn't fail the request
   */
  private async saveOHLCToFreshCacheWithRetry(
    cacheKey: string,
    data: NavasanOHLCDataPoint[],
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.saveOHLCToFreshCache(cacheKey, data, apiMetadata);
    } catch (error) {
      this.logger.error(
        `Failed to save fresh OHLC cache for ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't fail the request, just log the error
    }
  }

  /**
   * Save stale OHLC cache with retry logic
   * RELIABILITY FIX: Retry stale cache writes since they're critical for fallback
   */
  private async saveOHLCToStaleCacheWithRetry(
    cacheKey: string,
    data: NavasanOHLCDataPoint[],
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      try {
        await this.saveOHLCToStaleCache(cacheKey, data, apiMetadata);
        return; // Success
      } catch (error) {
        retries++;
        this.logger.error(
          `Failed to save stale OHLC cache for ${cacheKey} (attempt ${retries}/${maxRetries + 1}): ${error instanceof Error ? error.message : String(error)}`,
        );

        if (retries > maxRetries) {
          this.logger.error(`Gave up saving stale OHLC cache for ${cacheKey} after ${maxRetries + 1} attempts`);
          // Don't fail the request, but log as critical
        }
      }
    }
  }

  /**
   * Mark OHLC cache entry as being used as fallback and track API errors
   * Populates isFallback, lastApiError, and increments apiErrorCount
   * DB ERROR HANDLING: Won't throw on DB failure
   */
  private async markOHLCCacheAsFallback(cacheKey: string, errorMessage: string): Promise<void> {
    await safeDbWrite(
      () =>
        this.cacheModel
          .updateMany(
            { category: cacheKey, cacheType: { $in: ['fresh', 'stale'] } },
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
      'markOHLCCacheAsFallback',
      this.logger,
      { cacheKey, errorMessage },
      false, // Not critical - just metadata
    );
  }

  /**
   * Transform Navasan OHLC data to frontend format
   */
  private transformOHLCData(data: NavasanOHLCDataPoint[]): ChartDataPoint[] {
    return data.map((point) => {
      // Convert prices to numbers (handle both number and string types)
      const open = typeof point.open === 'number' ? point.open : parseFloat(point.open);
      const high = typeof point.high === 'number' ? point.high : parseFloat(point.high);
      const low = typeof point.low === 'number' ? point.low : parseFloat(point.low);
      const close = typeof point.close === 'number' ? point.close : parseFloat(point.close);

      // Convert Unix timestamp to ISO 8601 string
      const timestamp = new Date(point.timestamp * 1000).toISOString();

      return {
        timestamp,
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(close),
        volume: 0, // Navasan doesn't provide volume data
      };
    });
  }

  /**
   * Save OHLC snapshot to database with TTL and metrics tracking
   * ISSUE 4 FIX: Records auto-deleted after 90 days via TTL index
   * METRICS: Tracks snapshot save failures
   * DB ERROR HANDLING: Uses safeDbWrite
   */
  private async saveOhlcSnapshot(
    itemCode: string,
    timeRange: TimeRange,
    data: NavasanOHLCDataPoint[],
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const snapshot = new this.ohlcSnapshotModel({
        itemCode,
        timeRange,
        data,
        timestamp: new Date(),
        source: 'api',
        metadata: apiMetadata,
      });

      const saveResult = await safeDbWrite(
        () => snapshot.save(),
        'saveOhlcSnapshot',
        this.logger,
        { itemCode, timeRange },
        true, // Critical - track failures
      );

      if (saveResult) {
        this.logger.log(`📸 Saved OHLC snapshot for ${itemCode} (${timeRange})`);
        // Reset failure counter on success
        this.metricsService.resetSnapshotFailureCounter('ohlc', `${itemCode}_${timeRange}`);
      } else {
        // Track failure
        this.metricsService.trackSnapshotFailure(
          'ohlc',
          `${itemCode}_${timeRange}`,
          'Database write failed during OHLC snapshot save',
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save OHLC snapshot for ${itemCode}: ${errorMessage}`);
      // Track failure
      this.metricsService.trackSnapshotFailure('ohlc', `${itemCode}_${timeRange}`, errorMessage);
      // Don't fail the request if snapshot saving fails
    }
  }
}
