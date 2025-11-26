import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';

// Services
import { MarketDataCategoryService } from './services/market-data-category.service';
import { MarketDataValidationService } from './services/market-data-validation.service';
import { MarketDataCacheService } from './services/market-data-cache.service';
import { MarketDataSnapshotService } from './services/market-data-snapshot.service';
import { MarketDataEnrichmentService } from './services/market-data-enrichment.service';
import { MarketDataCircuitBreakerService } from './services/market-data-circuit-breaker.service';
import { IntradayOhlcService } from '../navasan/services/intraday-ohlc.service';
import { MetricsService } from '../metrics/metrics.service';
import { ApiProviderFactory } from '../api-providers/api-provider.factory';
import { PersianApiTransformer } from '../api-providers/persianapi.transformer';

// Schemas
import { OHLCPermanent, OHLCPermanentDocument } from '../navasan/schemas/ohlc-permanent.schema';

// Types
import { ItemCategory } from './constants/market-data.constants';
import {
  ApiResponse,
  MarketDataResponse,
  PriceItem,
  ForceFetchResult,
  AggregatedOhlcData,
} from './types/market-data.types';
import {
  CurrencyData,
  CryptoData,
  GoldData,
} from '../api-providers/api-provider.interface';

/**
 * MarketDataOrchestratorService
 *
 * Thin orchestration layer that coordinates all market data operations.
 * Delegates actual work to specialized services.
 *
 * Responsibilities:
 * - Orchestrate fetch workflows (cache -> API -> fallback)
 * - Coordinate multiple services
 * - Handle error recovery
 * - Provide public API for controllers
 *
 * This service NEVER:
 * - Accesses database directly (delegates to CacheService/SnapshotService)
 * - Makes API calls directly (delegates to FetcherService via ApiProviderFactory)
 * - Transforms data directly (delegates to EnrichmentService)
 */
@Injectable()
export class MarketDataOrchestratorService {
  private readonly logger = new Logger(MarketDataOrchestratorService.name);

  constructor(
    // Specialized services
    private readonly categoryService: MarketDataCategoryService,
    private readonly validationService: MarketDataValidationService,
    private readonly cacheService: MarketDataCacheService,
    private readonly snapshotService: MarketDataSnapshotService,
    private readonly enrichmentService: MarketDataEnrichmentService,
    private readonly circuitBreakerService: MarketDataCircuitBreakerService,
    private readonly intradayOhlcService: IntradayOhlcService,
    private readonly metricsService: MetricsService,
    private readonly apiProviderFactory: ApiProviderFactory,
    private readonly persianApiTransformer: PersianApiTransformer,
    private readonly configService: ConfigService,
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
  ) {
    // Validate internal API URL on startup
    const internalApiUrl = this.configService.get<string>('INTERNAL_API_URL') || 'http://localhost:4000';
    this.validationService.validateInternalApiUrl(internalApiUrl);
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get latest rates for all items (currencies, crypto, gold)
   */
  async getLatestRates(): Promise<ApiResponse<MarketDataResponse>> {
    return this.fetchWithCache('all');
  }

  /**
   * Get latest currency rates only
   */
  async getCurrencies(): Promise<ApiResponse<MarketDataResponse>> {
    return this.fetchWithCache('currencies');
  }

  /**
   * Get latest cryptocurrency rates only
   */
  async getCrypto(): Promise<ApiResponse<MarketDataResponse>> {
    return this.fetchWithCache('crypto');
  }

  /**
   * Get latest gold prices only
   * Note: Gold coins are multiplied by 1000 (stored in thousands)
   */
  async getGold(): Promise<ApiResponse<MarketDataResponse>> {
    const response = await this.fetchWithCache('gold');

    // Apply gold multipliers
    const transformedData = this.enrichmentService.applyGoldMultipliers(response.data);

    return {
      data: transformedData,
      metadata: response.metadata,
    };
  }

  /**
   * Get latest coin prices only
   */
  async getCoins(): Promise<ApiResponse<MarketDataResponse>> {
    return this.fetchWithCache('coins');
  }

  /**
   * Force fetch from API and update all caches
   * Used by scheduler to proactively cache data
   */
  async forceFetchAndCache(
    category: 'currencies' | 'crypto' | 'gold',
  ): Promise<ForceFetchResult> {
    this.categoryService.validateCategory(category);

    try {
      this.logger.log(`Force fetching ${category} from API...`);

      const apiResponse = await this.fetchFromApi(category);

      // Save to all cache tiers
      await Promise.all([
        this.cacheService.saveToFreshCacheWithRetry(
          category,
          apiResponse.data,
          apiResponse.metadata as Record<string, unknown>,
        ),
        this.cacheService.saveToStaleCacheWithRetry(
          category,
          apiResponse.data,
          apiResponse.metadata as Record<string, unknown>,
        ),
        this.snapshotService.savePriceSnapshot(
          category,
          apiResponse.data,
          apiResponse.metadata as Record<string, unknown>,
        ),
      ]);

      // Record intraday OHLC data points
      if (this.validationService.isValidMarketData(apiResponse.data)) {
        await this.recordIntradayOhlc(category, apiResponse.data);
      }

      this.logger.log(`Force fetch successful for ${category}`);
      return { success: true };
    } catch (error) {
      const errorMessage = this.validationService.sanitizeErrorMessage(error);
      this.logger.error(`Force fetch failed for ${category}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get historical data for yesterday
   */
  async getHistoricalData(
    category: string,
  ): Promise<ApiResponse<MarketDataResponse>> {
    this.categoryService.validateCategory(category);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return this.getHistoricalDataForDate(category, yesterday);
  }

  /**
   * Get historical data from OHLC for a specific date
   */
  async getHistoricalDataFromOHLC(
    category: string,
    targetDate: Date,
  ): Promise<ApiResponse<MarketDataResponse>> {
    this.categoryService.validateCategory(category);
    this.validationService.validateDateRange(targetDate);

    const targetDateStr = targetDate.toISOString().split('T')[0];
    this.logger.log(
      `Fetching historical data for ${category} on ${targetDateStr} from ohlc_permanent`,
    );

    try {
      const itemCodes = this.categoryService.getCategoryItemCodes(category);
      const startOfDay = new Date(targetDateStr + 'T00:00:00.000Z');
      const endOfDay = new Date(targetDateStr + 'T23:59:59.999Z');

      // Query ohlc_permanent for 1d (daily) data first
      let records = await this.queryDailyOhlc(itemCodes, startOfDay, endOfDay);

      // If no 1d data, aggregate from 1m data
      if (records.length === 0) {
        this.logger.log(
          `No 1d data found for ${targetDateStr}, aggregating from 1m data...`,
        );
        records = await this.aggregateMinuteToDaily(itemCodes, startOfDay, endOfDay);
      }

      if (records.length === 0) {
        throw new NotFoundException(
          `No historical data available for ${targetDateStr}`,
        );
      }

      // Transform to response format
      const priceData = this.transformOhlcToResponse(records, targetDateStr);

      return {
        data: priceData,
        metadata: {
          isFresh: false,
          isStale: false,
          dataAge: Math.round((Date.now() - targetDate.getTime()) / 60000),
          source: 'ohlc_permanent',
          lastUpdated: targetDate,
          isHistorical: true,
          historicalDate: targetDate,
          completeness: {
            successCount: records.length,
            totalCount: itemCodes.length,
            percentage: Math.round((records.length / itemCodes.length) * 100),
          },
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      const sanitizedMessage = this.validationService.sanitizeErrorMessage(error);
      this.logger.error(
        `Error fetching historical data for ${category}: ${sanitizedMessage}`,
      );

      throw new InternalServerErrorException('Failed to retrieve historical data');
    }
  }

  // ==================== PRIVATE ORCHESTRATION METHODS ====================

  /**
   * Fetch data with caching logic and fallback to stale data on API failure
   */
  private async fetchWithCache(
    category: ItemCategory,
  ): Promise<ApiResponse<MarketDataResponse>> {
    this.categoryService.validateCategory(category);

    try {
      // Step 1: Check for fresh cache
      const freshCache = await this.cacheService.getFreshCachedData(category);
      if (freshCache) {
        this.logger.log(`Returning FRESH cached data for category: ${category}`);
        const enrichedData = await this.enrichmentService.enrichChangeValues(
          freshCache.data as MarketDataResponse,
        );
        return {
          data: enrichedData,
          metadata: {
            isFresh: true,
            isStale: false,
            dataAge: this.cacheService.getDataAgeMinutes(freshCache.timestamp),
            lastUpdated: freshCache.timestamp,
            source: 'cache',
          },
        };
      }

      // Step 2: Try to fetch fresh data from API
      this.logger.log(`Fetching fresh data from API for category: ${category}`);
      try {
        const apiResponse = await this.fetchFromApi(category);

        // Success! Update caches
        await Promise.all([
          this.cacheService.saveToFreshCacheWithRetry(
            category,
            apiResponse.data,
            apiResponse.metadata as Record<string, unknown>,
          ),
          this.cacheService.saveToStaleCacheWithRetry(
            category,
            apiResponse.data,
            apiResponse.metadata as Record<string, unknown>,
          ),
          this.snapshotService.savePriceSnapshot(
            category,
            apiResponse.data,
            apiResponse.metadata as Record<string, unknown>,
          ),
        ]);

        this.logger.log(`API fetch successful for category: ${category}`);

        // Enrich with OHLC change values
        const enrichedData = await this.enrichmentService.enrichChangeValues(
          apiResponse.data,
        );

        return {
          data: enrichedData,
          metadata: {
            isFresh: true,
            isStale: false,
            dataAge: 0,
            lastUpdated: new Date(),
            source: 'api',
          },
        };
      } catch (apiError) {
        // Step 3: API failed, try to serve stale data
        this.logger.warn(
          `API fetch failed for category: ${category}. Attempting fallback to stale data.`,
        );

        const errorMessage = this.validationService.sanitizeErrorMessage(apiError);
        const isTokenError = this.isTokenExpirationError(apiError);

        if (isTokenError) {
          this.logger.error(`TOKEN EXPIRATION detected for category: ${category}`);
        }

        const staleCache = await this.cacheService.getStaleCachedData(category);
        if (staleCache) {
          const dataAgeMinutes = this.cacheService.getDataAgeMinutes(staleCache.timestamp);
          const dataAgeHours = Math.floor(dataAgeMinutes / 60);

          this.logger.warn(
            `Serving STALE data for category: ${category} (${dataAgeHours}h ${dataAgeMinutes % 60}m old)`,
          );

          await this.cacheService.markCacheAsFallback(category, errorMessage).catch(
            (err) => this.logger.error(`Failed to mark cache as fallback: ${err.message}`),
          );

          const enrichedStaleData = await this.enrichmentService.enrichChangeValues(
            staleCache.data as MarketDataResponse,
          );

          return {
            data: enrichedStaleData,
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
        this.logger.error(`No stale cache available for category: ${category}. Failing request.`);

        throw new InternalServerErrorException(
          isTokenError
            ? 'API authentication failed and no cached data available. Please contact administrator.'
            : 'Service temporarily unavailable and no cached data available. Please try again later.',
        );
      }
    } catch (error) {
      const sanitizedMessage = this.validationService.sanitizeErrorMessage(error);
      this.logger.error(
        `Unexpected error in fetchWithCache for category ${category}: ${sanitizedMessage}`,
      );
      throw error;
    }
  }

  /**
   * Fetch data from API provider
   */
  private async fetchFromApi(
    category: ItemCategory,
  ): Promise<{ data: MarketDataResponse; metadata: Record<string, unknown> }> {
    const provider = this.apiProviderFactory.getActiveProvider();
    let responseData: (CurrencyData | CryptoData | GoldData)[] = [];

    if (category === 'all') {
      const allData = await provider.fetchAll({ limit: 100 });
      responseData = [...allData.currencies, ...allData.crypto, ...allData.gold];
    } else if (category === 'currencies') {
      responseData = await provider.fetchCurrencies({ limit: 100 });
    } else if (category === 'crypto') {
      responseData = await provider.fetchCrypto({ limit: 100 });
    } else if (category === 'gold' || category === 'coins') {
      try {
        responseData = await provider.fetchGold({ limit: 100 });
      } catch (error: any) {
        this.logger.warn(`Gold endpoint unavailable: ${error.message}`);
        responseData = [];
      }
    }

    // Transform to standard format
    const marketData = this.persianApiTransformer.transformToNavasanFormat(responseData);

    // Validate response
    this.validationService.validateApiResponseOrThrow(marketData, category);

    return {
      data: marketData as MarketDataResponse,
      metadata: {
        provider: 'PersianAPI',
        itemCount: responseData.length,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Get historical data for a specific date
   */
  private async getHistoricalDataForDate(
    category: string,
    targetDate: Date,
  ): Promise<ApiResponse<MarketDataResponse>> {
    this.logger.log(
      `Fetching historical data for category: ${category} (${targetDate.toISOString()})`,
    );

    try {
      // Try to find snapshot in database
      const snapshot = await this.snapshotService.findClosestSnapshot(category, targetDate);

      if (snapshot) {
        const dataAgeMinutes = this.cacheService.getDataAgeMinutes(snapshot.timestamp);

        this.logger.log(
          `Found historical snapshot for ${category} from ${snapshot.timestamp.toISOString()}`,
        );

        return {
          data: snapshot.data as MarketDataResponse,
          metadata: {
            isFresh: false,
            isStale: true,
            dataAge: dataAgeMinutes,
            lastUpdated: snapshot.timestamp,
            source: 'snapshot',
            isHistorical: true,
            historicalDate: snapshot.timestamp,
          },
        };
      }

      // No snapshot found, try OHLC
      this.logger.warn(`No snapshot found for ${category}, trying OHLC fallback`);
      return this.getHistoricalDataFromOHLC(category, targetDate);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const sanitizedMessage = this.validationService.sanitizeErrorMessage(error);
      this.logger.error(
        `Unexpected error fetching historical data for ${category}: ${sanitizedMessage}`,
      );

      throw new InternalServerErrorException(
        'Failed to retrieve historical data. Please try again later.',
      );
    }
  }

  /**
   * Record intraday OHLC data
   */
  private async recordIntradayOhlc(
    category: 'currencies' | 'crypto' | 'gold',
    data: MarketDataResponse,
  ): Promise<void> {
    try {
      const transformedData = this.transformToOhlcFormat(category, data);
      await this.intradayOhlcService.recordDataPoints(transformedData);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to record intraday OHLC for ${category}: ${err.message}`,
      );
    }
  }

  /**
   * Transform response to OHLC format
   */
  private transformToOhlcFormat(
    category: 'currencies' | 'crypto' | 'gold',
    data: MarketDataResponse,
  ): { currencies: CurrencyData[]; crypto: CryptoData[]; gold: GoldData[] } {
    const result: { currencies: CurrencyData[]; crypto: CryptoData[]; gold: GoldData[] } = {
      currencies: [],
      crypto: [],
      gold: [],
    };

    for (const [code, itemData] of Object.entries(data)) {
      if (!itemData || typeof itemData !== 'object' || code.startsWith('_')) continue;

      const item = itemData as PriceItem;
      const price = parseFloat(item.value);

      if (isNaN(price)) continue;

      const baseData = {
        code,
        price,
        updatedAt: new Date(item.utc || Date.now()),
      };

      if (category === 'currencies') {
        result.currencies.push({ ...baseData, name: code, change: item.change });
      } else if (category === 'crypto') {
        result.crypto.push({
          ...baseData,
          name: code,
          symbol: code.toUpperCase(),
          priceIrt: price,
          change24h: item.change,
        });
      } else if (category === 'gold') {
        result.gold.push({ ...baseData, name: code });
      }
    }

    return result;
  }

  /**
   * Query daily OHLC data
   */
  private async queryDailyOhlc(
    itemCodes: string[],
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<AggregatedOhlcData[]> {
    const records = await this.ohlcPermanentModel
      .find({
        itemCode: { $in: itemCodes },
        timeframe: '1d',
        timestamp: { $gte: startOfDay, $lte: endOfDay },
      })
      .lean()
      .exec();

    return records.map((r) => ({
      itemCode: r.itemCode,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      timestamp: r.timestamp,
    }));
  }

  /**
   * Aggregate minute data to daily
   */
  private async aggregateMinuteToDaily(
    itemCodes: string[],
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<AggregatedOhlcData[]> {
    const aggregation = await this.ohlcPermanentModel
      .aggregate([
        {
          $match: {
            itemCode: { $in: itemCodes },
            timeframe: '1m',
            timestamp: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        { $sort: { timestamp: 1 } },
        {
          $group: {
            _id: '$itemCode',
            open: { $first: '$open' },
            high: { $max: '$high' },
            low: { $min: '$low' },
            close: { $last: '$close' },
            timestamp: { $first: '$timestamp' },
          },
        },
        {
          $project: {
            itemCode: '$_id',
            open: 1,
            high: 1,
            low: 1,
            close: 1,
            timestamp: 1,
          },
        },
      ])
      .exec();

    return aggregation as AggregatedOhlcData[];
  }

  /**
   * Transform OHLC records to response format
   */
  private transformOhlcToResponse(
    records: AggregatedOhlcData[],
    targetDateStr: string,
  ): MarketDataResponse {
    const priceData: MarketDataResponse = {};

    for (const record of records) {
      const key = record.itemCode.toLowerCase();
      const changeAmount = record.close - record.open;

      priceData[key] = {
        value: String(record.close),
        change: changeAmount,
        utc: record.timestamp.toISOString(),
        date: targetDateStr,
        dt: record.timestamp.toTimeString().split(' ')[0],
      };
    }

    return priceData;
  }

  /**
   * Detect if error is due to token expiration
   */
  private isTokenExpirationError(error: unknown): boolean {
    const err = error as any;

    if (err?.response?.status === 401 || err?.response?.status === 403) {
      return true;
    }

    if (err?.response?.data) {
      const message = JSON.stringify(err.response.data).toLowerCase();
      return (
        message.includes('token') ||
        message.includes('unauthorized') ||
        message.includes('api key') ||
        message.includes('authentication')
      );
    }

    return false;
  }
}
