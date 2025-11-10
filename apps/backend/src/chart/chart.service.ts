import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import axios from 'axios';
import { TimeRange, ItemType } from './dto/chart-query.dto';
import { ChartDataPoint, ChartResponse } from './interfaces/chart.interface';
import { Cache, CacheDocument } from '../navasan/schemas/cache.schema';
import { OhlcSnapshot, OhlcSnapshotDocument } from '../navasan/schemas/ohlc-snapshot.schema';
import { PriceSnapshot, PriceSnapshotDocument } from '../navasan/schemas/price-snapshot.schema';
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
  private readonly snapshotCoverageThreshold: number; // Minimum coverage % for price snapshot fallback

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    @InjectModel(OhlcSnapshot.name) private ohlcSnapshotModel: Model<OhlcSnapshotDocument>,
    @InjectModel(PriceSnapshot.name) private priceSnapshotModel: Model<PriceSnapshotDocument>,
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    this.apiKey = this.configService.get<string>('NAVASAN_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.error('NAVASAN_API_KEY is not set in environment variables');
      throw new Error('NAVASAN_API_KEY is required for chart service');
    }

    // Read snapshot coverage threshold from env (default: 50%)
    this.snapshotCoverageThreshold =
      parseInt(this.configService.get<string>('SNAPSHOT_COVERAGE_THRESHOLD') || '50', 10);

    if (this.snapshotCoverageThreshold < 0 || this.snapshotCoverageThreshold > 100) {
      this.logger.warn(
        `Invalid SNAPSHOT_COVERAGE_THRESHOLD (${this.snapshotCoverageThreshold}), defaulting to 50%`,
      );
      this.snapshotCoverageThreshold = 50;
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
    // Main Currencies
    USD_SELL: 'usd_sell',
    USD: 'usd_sell', // Fallback for backwards compatibility
    EUR: 'eur',
    GBP: 'gbp',
    CAD: 'cad',
    AUD: 'aud',
    AED: 'aed',
    CNY: 'cny',
    TRY: 'try',

    // Additional Currencies
    CHF: 'chf',
    JPY: 'jpy',
    RUB: 'rub',
    INR: 'inr',
    PKR: 'pkr',
    IQD: 'iqd',
    KWD: 'kwd',
    SAR: 'sar',
    QAR: 'qar',
    OMR: 'omr',
    BHD: 'bhd',

    // Currency Variants
    USD_BUY: 'usd_buy',
    USD_HARAT_SELL: 'dolar_harat_sell',
    USD_HARAT_CASH_SELL: 'harat_naghdi_sell',
    USD_HARAT_CASH_BUY: 'harat_naghdi_buy',
    USD_FARDA_SELL: 'usd_farda_sell',
    USD_FARDA_BUY: 'usd_farda_buy',
    USD_SHAKHS: 'usd_shakhs',
    USD_SHERKAT: 'usd_sherkat',
    USD_PP: 'usd_pp',
    USD_MASHAD_SELL: 'dolar_mashad_sell',
    USD_KORDESTAN_SELL: 'dolar_kordestan_sell',
    USD_SOLEIMANIE_SELL: 'dolar_soleimanie_sell',
    AED_SELL: 'aed_sell',
    DIRHAM_DUBAI: 'dirham_dubai',
    EUR_HAV: 'eur_hav',
    GBP_HAV: 'gbp_hav',
    GBP_WHT: 'gbp_wht',
    CAD_HAV: 'cad_hav',
    CAD_CASH: 'cad_cash',
    AUD_HAV: 'aud_hav',
    AUD_WHT: 'aud_wht',

    // Main Cryptocurrencies
    USDT: 'usdt',
    BTC: 'btc',
    ETH: 'eth',

    // Additional Cryptocurrencies
    BNB: 'bnb',
    XRP: 'xrp',
    ADA: 'ada',
    DOGE: 'doge',
    SOL: 'sol',
    MATIC: 'matic',
    DOT: 'dot',
    LTC: 'ltc',

    // Gold items
    SEKKEH: 'sekkeh',
    BAHAR: 'bahar',
    NIM: 'nim',
    ROB: 'rob',
    GERAMI: 'gerami',
    '18AYAR': '18ayar',
    ABSHODEH: 'abshodeh',
  };

  /**
   * Gold price multipliers - Most gold items stored as thousands in Navasan API
   * Items not in this map default to multiplier of 1
   */
  private readonly goldPriceMultipliers: Record<string, number> = {
    sekkeh: 1000,
    bahar: 1000,
    nim: 1000,
    rob: 1000,
    gerami: 1000,
    '18ayar': 1, // No multiplication for 18ayar
    abshodeh: 1000,
  };

  /**
   * Item code to category mapping - Centralized source of truth
   * Used for price snapshot queries and category determination
   */
  private readonly itemCategoryMap: Record<string, string> = {
    // Main Currencies
    usd_sell: 'currencies',
    eur: 'currencies',
    gbp: 'currencies',
    cad: 'currencies',
    aud: 'currencies',
    aed: 'currencies',
    cny: 'currencies',
    try: 'currencies',

    // Additional Currencies
    chf: 'currencies',
    jpy: 'currencies',
    rub: 'currencies',
    inr: 'currencies',
    pkr: 'currencies',
    iqd: 'currencies',
    kwd: 'currencies',
    sar: 'currencies',
    qar: 'currencies',
    omr: 'currencies',
    bhd: 'currencies',

    // Currency Variants
    usd_buy: 'currencies',
    dolar_harat_sell: 'currencies',
    harat_naghdi_sell: 'currencies',
    harat_naghdi_buy: 'currencies',
    usd_farda_sell: 'currencies',
    usd_farda_buy: 'currencies',
    usd_shakhs: 'currencies',
    usd_sherkat: 'currencies',
    usd_pp: 'currencies',
    dolar_mashad_sell: 'currencies',
    dolar_kordestan_sell: 'currencies',
    dolar_soleimanie_sell: 'currencies',
    aed_sell: 'currencies',
    dirham_dubai: 'currencies',
    eur_hav: 'currencies',
    gbp_hav: 'currencies',
    gbp_wht: 'currencies',
    cad_hav: 'currencies',
    cad_cash: 'currencies',
    hav_cad_my: 'currencies',
    hav_cad_cheque: 'currencies',
    hav_cad_cash: 'currencies',
    aud_hav: 'currencies',
    aud_wht: 'currencies',

    // Main Cryptocurrencies
    usdt: 'crypto',
    btc: 'crypto',
    eth: 'crypto',

    // Additional Cryptocurrencies
    bnb: 'crypto',
    xrp: 'crypto',
    ada: 'crypto',
    doge: 'crypto',
    sol: 'crypto',
    matic: 'crypto',
    dot: 'crypto',
    ltc: 'crypto',

    // Gold
    sekkeh: 'gold',
    bahar: 'gold',
    nim: 'gold',
    rob: 'gold',
    gerami: 'gold',
    '18ayar': 'gold',
    abshodeh: 'gold',
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
      [ItemType.CURRENCY]: [
        // Main currencies
        'USD_SELL', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'CNY', 'CNY_HAV', 'TRY', 'TRY_HAV',
        // Additional currencies
        'CHF', 'JPY', 'JPY_HAV', 'RUB', 'INR', 'PKR', 'IQD', 'KWD', 'SAR', 'QAR', 'OMR', 'BHD',
        // Currency variants
        'USD_BUY', 'USD_HARAT_SELL', 'USD_HARAT_CASH_SELL', 'USD_HARAT_CASH_BUY',
        'USD_FARDA_SELL', 'USD_FARDA_BUY', 'USD_SHAKHS', 'USD_SHERKAT', 'USD_PP',
        'USD_MASHAD_SELL', 'USD_KORDESTAN_SELL', 'USD_SOLEIMANIE_SELL',
        'AED_SELL', 'DIRHAM_DUBAI',
        'EUR_HAV', 'GBP_HAV', 'GBP_WHT', 'CAD_HAV', 'CAD_CASH', 'AUD_HAV', 'AUD_WHT'
      ],
      [ItemType.CRYPTO]: [
        // Main crypto
        'BTC', 'ETH', 'USDT',
        // Additional crypto
        'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'MATIC', 'DOT', 'LTC'
      ],
      [ItemType.GOLD]: [
        'SEKKEH', 'BAHAR', 'NIM', 'ROB', 'GERAMI', '18AYAR', 'ABSHODEH'
      ],
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
        this.metricsService.trackCacheHit('ohlc', 'fresh_cache');
        return freshCache as NavasanOHLCDataPoint[];
      }

      // Step 1.5: Check OHLC Snapshot database (persisted data with longer TTL)
      const snapshotData = await this.getOhlcSnapshotData(itemCode, timeRange);
      if (snapshotData) {
        const dataAge = this.getDataAge(snapshotData.timestamp);
        this.logger.log(`📦 Returning OHLC snapshot data for ${itemCode} (${timeRange}) - ${dataAge} old`);
        this.metricsService.trackCacheHit('ohlc', 'snapshot_db');

        // Refresh fresh cache for faster subsequent requests (fire-and-forget)
        this.saveOHLCToFreshCacheWithRetry(cacheKey, snapshotData.data, snapshotData.metadata).catch(err => {
          this.logger.warn(`Failed to refresh fresh cache from snapshot: ${err.message}`);
        });

        return snapshotData.data;
      }

      // Step 2: Try to fetch from API
      this.logger.log(`📡 Fetching OHLC data from Navasan API for ${itemCode} (${timeRange})`);
      this.metricsService.trackCacheMiss('ohlc', 'api_fetch');
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

        // Step 4: Try to build chart from price snapshots as last resort
        this.logger.warn(`📸 Attempting price snapshot fallback for ${itemCode}`);
        const snapshotData = await this.buildChartFromPriceSnapshots(
          itemCode,
          startTimestamp,
          endTimestamp,
          timeRange,
        );

        if (snapshotData) {
          this.logger.warn(
            `⚠️  Serving chart data built from PRICE SNAPSHOTS for ${itemCode} (${timeRange})`,
          );
          return snapshotData;
        }

        // No fallback options available
        this.logger.error(
          `❌ No stale OHLC cache or price snapshots available for ${itemCode}`,
        );
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

  /**
   * Get OHLC snapshot from database with smart TTL based on time range
   * Returns data if found and not expired according to retention policy
   */
  private async getOhlcSnapshotData(
    itemCode: string,
    timeRange: TimeRange,
  ): Promise<{ data: NavasanOHLCDataPoint[]; timestamp: Date; metadata?: Record<string, unknown> } | null> {
    try {
      // Get expiry date based on time range retention policy
      const expiryDate = this.getSnapshotExpiryDate(timeRange);

      const snapshot = await safeDbRead(
        () => this.ohlcSnapshotModel
          .findOne({
            itemCode,
            timeRange,
            timestamp: { $gte: expiryDate },
          })
          .sort({ timestamp: -1 }) // Get most recent
          .exec(),
        'getOhlcSnapshot',
        this.logger,
      );

      if (!snapshot) {
        this.metricsService.trackCacheMiss('ohlc', 'snapshot_db');
        return null;
      }

      // Validate data structure
      if (!snapshot.data || !Array.isArray(snapshot.data) || snapshot.data.length === 0) {
        this.logger.warn(`Invalid OHLC snapshot data for ${itemCode} (${timeRange})`);
        return null;
      }

      return {
        data: snapshot.data as NavasanOHLCDataPoint[],
        timestamp: snapshot.timestamp,
        metadata: snapshot.metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get OHLC snapshot for ${itemCode}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get expiry date for OHLC snapshots based on time range
   * Different time ranges have different retention policies:
   * - 1d: Keep for 1 hour (same as fresh cache)
   * - 1w: Keep for 6 hours
   * - 1m: Keep for 1 day
   * - 3m: Keep for 7 days
   * - 1y/all: Keep for 30 days
   */
  private getSnapshotExpiryDate(timeRange: TimeRange): Date {
    const now = new Date();
    const expiryDate = new Date(now);

    switch (timeRange) {
      case TimeRange.ONE_DAY:
        expiryDate.setHours(now.getHours() - 1); // 1 hour
        break;
      case TimeRange.ONE_WEEK:
        expiryDate.setHours(now.getHours() - 6); // 6 hours
        break;
      case TimeRange.ONE_MONTH:
        expiryDate.setDate(now.getDate() - 1); // 1 day
        break;
      case TimeRange.THREE_MONTHS:
        expiryDate.setDate(now.getDate() - 7); // 7 days
        break;
      case TimeRange.ONE_YEAR:
      case TimeRange.ALL:
        expiryDate.setDate(now.getDate() - 30); // 30 days
        break;
      default:
        expiryDate.setHours(now.getHours() - 1); // Default: 1 hour
    }

    return expiryDate;
  }

  /**
   * Get human-readable data age string
   */
  private getDataAge(timestamp: Date): string {
    const now = new Date();
    const ageMs = now.getTime() - timestamp.getTime();
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);

    if (ageDays > 0) {
      return `${ageDays} day${ageDays > 1 ? 's' : ''}`;
    } else if (ageHours > 0) {
      return `${ageHours} hour${ageHours > 1 ? 's' : ''}`;
    } else {
      return `${ageMinutes} minute${ageMinutes > 1 ? 's' : ''}`;
    }
  }

  /**
   * ==========================================
   * PRICE SNAPSHOT FALLBACK METHODS
   * ==========================================
   */

  /**
   * Map item code to price snapshot category
   * @param itemCode - Navasan item code (e.g., 'usd_sell', 'btc', 'sekkeh')
   * @returns Category name ('currencies', 'crypto', or 'gold')
   */
  private mapItemCodeToCategory(itemCode: string): string {
    const category = this.itemCategoryMap[itemCode];

    if (!category) {
      throw new Error(`Unknown item code: ${itemCode}`);
    }

    return category;
  }

  /**
   * Extract price value from a price snapshot for a specific item code
   * Handles gold price multiplication (most gold items stored as thousands)
   * @param snapshot - Price snapshot document
   * @param itemCode - Item code to extract (e.g., 'usd_sell', 'btc')
   * @returns Price as number, or null if not found/invalid
   */
  private extractPriceFromSnapshot(
    snapshot: PriceSnapshotDocument,
    itemCode: string,
  ): number | null {
    try {
      // Type guard: check if data is an object
      if (!snapshot.data || typeof snapshot.data !== 'object') {
        return null;
      }

      // Extract item data with proper type guard
      const itemData = snapshot.data[itemCode];
      if (!itemData || typeof itemData !== 'object') {
        return null;
      }

      // Type assertion with validation
      const typedItemData = itemData as Record<string, unknown>;
      const valueStr = typedItemData.value;
      if (typeof valueStr !== 'string') {
        return null;
      }

      // Parse to number
      let price = parseFloat(valueStr);
      if (isNaN(price)) {
        return null;
      }

      // Apply gold price multiplier if configured (defaults to 1 if not in map)
      const multiplier = this.goldPriceMultipliers[itemCode] || 1;
      price = price * multiplier;

      return price;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error extracting price from snapshot for ${itemCode}: ${errorMessage}`,
        errorStack,
      );
      return null;
    }
  }

  /**
   * Build chart data from price snapshots as fallback when OHLC API is unavailable
   * Creates synthetic OHLC data where open=high=low=close=snapshot price
   * @param itemCode - Item code (e.g., 'usd_sell', 'btc')
   * @param startTimestamp - Start time (Unix timestamp)
   * @param endTimestamp - End time (Unix timestamp)
   * @param timeRange - Time range enum (for logging)
   * @returns Array of OHLC data points, or null if insufficient data
   */
  private async buildChartFromPriceSnapshots(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
    timeRange: TimeRange,
  ): Promise<NavasanOHLCDataPoint[] | null> {
    try {
      // Validate timestamps
      if (startTimestamp < 0 || endTimestamp < 0) {
        this.logger.error(
          `Invalid timestamps for ${itemCode}: start=${startTimestamp}, end=${endTimestamp}`,
        );
        return null;
      }

      if (startTimestamp >= endTimestamp) {
        this.logger.error(
          `Start timestamp must be before end timestamp for ${itemCode}`,
        );
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      const maxRangeSeconds = 3 * 365 * 24 * 60 * 60; // 3 years maximum

      if (endTimestamp - startTimestamp > maxRangeSeconds) {
        this.logger.error(
          `Time range too large for ${itemCode}: ${endTimestamp - startTimestamp} seconds (max: ${maxRangeSeconds})`,
        );
        return null;
      }

      // Map item code to category for querying snapshots
      const category = this.mapItemCodeToCategory(itemCode);

      this.logger.log(
        `📸 Attempting to build chart from price snapshots for ${itemCode} (category: ${category})`,
      );

      // Query price snapshots for the time range
      const snapshots = await safeDbRead(
        () =>
          this.priceSnapshotModel
            .find({
              category,
              timestamp: {
                $gte: new Date(startTimestamp * 1000),
                $lte: new Date(endTimestamp * 1000),
              },
            })
            .sort({ timestamp: 1 })
            .exec(),
        'buildChartFromPriceSnapshots',
        this.logger,
        { itemCode, category, timeRange },
      );

      if (!snapshots || snapshots.length === 0) {
        this.logger.warn(`No price snapshots found for ${itemCode} in requested time range`);
        return null;
      }

      // Calculate expected number of hourly snapshots
      const hoursDiff = Math.floor((endTimestamp - startTimestamp) / 3600);
      const expectedSnapshots = hoursDiff;
      const coverage = (snapshots.length / expectedSnapshots) * 100;

      this.logger.log(
        `Found ${snapshots.length} snapshots (expected ~${expectedSnapshots}, coverage: ${coverage.toFixed(1)}%)`,
      );

      // Check if coverage meets configured threshold
      if (coverage < this.snapshotCoverageThreshold) {
        this.logger.warn(
          `Insufficient snapshot coverage (${coverage.toFixed(1)}%) for ${itemCode}. ` +
            `Need at least ${this.snapshotCoverageThreshold}%.`,
        );
        return null;
      }

      // Transform snapshots to synthetic OHLC data
      const ohlcData: NavasanOHLCDataPoint[] = [];

      for (const snapshot of snapshots) {
        const price = this.extractPriceFromSnapshot(snapshot, itemCode);

        if (price === null) {
          // Skip snapshots where we can't extract the price
          continue;
        }

        // Validate price sanity
        if (price < 0) {
          this.logger.warn(
            `Negative price detected for ${itemCode} at ${snapshot.timestamp}: ${price}`,
          );
          continue;
        }

        if (price === 0) {
          this.logger.warn(
            `Zero price detected for ${itemCode} at ${snapshot.timestamp}`,
          );
          continue;
        }

        // Set reasonable maximum (1 billion Toman)
        const maxReasonablePrice = 1_000_000_000;
        if (price > maxReasonablePrice) {
          this.logger.warn(
            `Suspiciously high price for ${itemCode} at ${snapshot.timestamp}: ${price}`,
          );
          continue;
        }

        // Create synthetic OHLC point (open=high=low=close=price)
        const unixTimestamp = Math.floor(snapshot.timestamp.getTime() / 1000);
        ohlcData.push({
          timestamp: unixTimestamp,
          date: snapshot.timestamp.toISOString().split('T')[0], // YYYY-MM-DD
          open: price,
          high: price,
          low: price,
          close: price,
        });
      }

      if (ohlcData.length === 0) {
        this.logger.warn(`Could not extract any valid prices from snapshots for ${itemCode}`);
        return null;
      }

      this.logger.log(
        `✅ Successfully built ${ohlcData.length} OHLC points from price snapshots for ${itemCode}`,
      );

      return ohlcData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to build chart from price snapshots for ${itemCode}: ${errorMessage}`,
        errorStack,
      );

      return null;
    }
  }
}
