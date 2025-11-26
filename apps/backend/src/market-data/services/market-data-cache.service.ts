import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CacheService } from '../../cache/cache.service';
import { MetricsService } from '../../metrics/metrics.service';
import { Cache, CacheDocument } from '../../navasan/schemas/cache.schema';
import { safeDbRead, safeDbWrite } from '../../common/utils/db-error-handler';
import {
  CACHE_DURATIONS,
  ItemCategory,
} from '../constants/market-data.constants';
import { MarketDataResponse, OhlcData, HistoricalDataPoint } from '../types/market-data.types';

/**
 * MarketDataCacheService
 *
 * Responsible for all caching operations (both Redis and MongoDB)
 * - Manages cache keys and namespaces
 * - Handles cache read/write operations
 * - Implements cache invalidation logic
 * - Tracks cache metrics
 *
 * This service extends the original NavasanCacheManagerService
 * with MongoDB cache operations from the main NavasanService.
 */
@Injectable()
export class MarketDataCacheService {
  private readonly logger = new Logger(MarketDataCacheService.name);

  // Configuration
  private readonly freshCacheMinutes = 5;
  private readonly staleCacheHours = 168; // 7 days

  constructor(
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
  ) {}

  // ==================== REDIS CACHE OPERATIONS ====================

  /**
   * Get fresh data from Redis cache
   */
  async getFreshDataFromRedis(category: ItemCategory): Promise<unknown | null> {
    const cacheKey = this.buildFreshCacheKey(category);

    try {
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        this.logger.debug(`Redis fresh cache hit for ${category}`);
        this.metricsService.trackCacheHit(category, 'fresh');
        return cached;
      }

      this.logger.debug(`Redis fresh cache miss for ${category}`);
      this.metricsService.trackCacheMiss(category, 'fresh');
      return null;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error reading Redis fresh cache for ${category}: ${err.message}`,
      );
      this.metricsService.trackCacheError(err.message);
      return null;
    }
  }

  /**
   * Set fresh data in Redis cache
   */
  async setFreshDataToRedis(category: ItemCategory, data: unknown): Promise<void> {
    const cacheKey = this.buildFreshCacheKey(category);
    const ttlSeconds = Math.floor(CACHE_DURATIONS.FRESH / 1000);

    try {
      await this.cacheService.set(cacheKey, data, ttlSeconds);
      this.logger.debug(
        `Cached fresh data to Redis for ${category} (TTL: ${ttlSeconds}s)`,
      );
      this.metricsService.trackCacheSet(cacheKey);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error caching fresh data to Redis for ${category}: ${err.message}`,
      );
      this.metricsService.trackCacheError(err.message);
    }
  }

  /**
   * Get stale data from Redis cache (fallback)
   */
  async getStaleDataFromRedis(category: ItemCategory): Promise<unknown | null> {
    const cacheKey = this.buildStaleCacheKey(category);

    try {
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        this.logger.debug(`Redis stale cache hit for ${category}`);
        this.metricsService.trackCacheHit(category, 'stale');
        return cached;
      }

      this.logger.debug(`Redis stale cache miss for ${category}`);
      this.metricsService.trackCacheMiss(category, 'stale');
      return null;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error reading Redis stale cache for ${category}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Set stale data in Redis cache (long-term fallback)
   */
  async setStaleDataToRedis(category: ItemCategory, data: unknown): Promise<void> {
    const cacheKey = this.buildStaleCacheKey(category);
    const ttlSeconds = Math.floor(CACHE_DURATIONS.STALE / 1000);

    try {
      await this.cacheService.set(cacheKey, data, ttlSeconds);
      this.logger.debug(
        `Cached stale data to Redis for ${category} (TTL: ${ttlSeconds}s)`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error caching stale data to Redis for ${category}: ${err.message}`,
      );
    }
  }

  // ==================== MONGODB CACHE OPERATIONS ====================

  /**
   * Get fresh cached data from MongoDB (< 5 minutes old)
   * Returns null on DB failure instead of throwing
   */
  async getFreshCachedData(category: string): Promise<CacheDocument | null> {
    const freshExpiry = new Date(
      Date.now() - this.freshCacheMinutes * 60 * 1000,
    );

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
   * Get stale cached data from MongoDB (up to 7 days old) for fallback
   * Returns null on DB failure instead of throwing
   */
  async getStaleCachedData(category: string): Promise<CacheDocument | null> {
    const staleExpiry = new Date(
      Date.now() - this.staleCacheHours * 60 * 60 * 1000,
    );

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
   * Save data to fresh cache in MongoDB using atomic upsert
   * Uses findOneAndUpdate with upsert instead of delete-then-create
   */
  async saveToFreshCache(
    category: string,
    data: MarketDataResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.freshCacheMinutes * 60 * 1000,
    );

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
                lastApiError: undefined,
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
      `Saved fresh cache for category: ${category}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save data to stale cache in MongoDB (long-term fallback) using atomic upsert
   */
  async saveToStaleCache(
    category: string,
    data: MarketDataResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.staleCacheHours * 60 * 60 * 1000,
    );

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
                lastApiError: undefined,
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
      `Saved stale cache for category: ${category}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save to fresh cache with retry logic
   */
  async saveToFreshCacheWithRetry(
    category: string,
    data: MarketDataResponse,
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
   * Save to stale cache with retry logic
   */
  async saveToStaleCacheWithRetry(
    category: string,
    data: MarketDataResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      try {
        await this.saveToStaleCache(category, data, apiMetadata);
        return;
      } catch (error) {
        retries++;
        this.logger.error(
          `Failed to save stale cache for ${category} (attempt ${retries}/${maxRetries + 1}): ${error instanceof Error ? error.message : String(error)}`,
        );

        if (retries > maxRetries) {
          this.logger.error(
            `Gave up saving stale cache for ${category} after ${maxRetries + 1} attempts`,
          );
        }
      }
    }
  }

  /**
   * Mark cache entry as being used as fallback and track API errors
   */
  async markCacheAsFallback(
    category: string,
    errorMessage: string,
  ): Promise<void> {
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
  getDataAgeMinutes(timestamp: Date): number {
    return Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60));
  }

  // ==================== OHLC CACHE OPERATIONS ====================

  /**
   * Get OHLC data from Redis cache
   */
  async getOhlcData(category: ItemCategory): Promise<OhlcData | null> {
    const dateString = new Date().toDateString();
    const cacheKey = `market-data:ohlc:${category}:${dateString}`;

    try {
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        this.logger.debug(`OHLC cache hit for ${category}`);
        this.metricsService.trackCacheHit(category, 'ohlc');
        return cached;
      }

      this.logger.debug(`OHLC cache miss for ${category}`);
      this.metricsService.trackCacheMiss(category, 'ohlc');
      return null;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error reading OHLC cache for ${category}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Set OHLC data in Redis cache
   */
  async setOhlcData(category: ItemCategory, data: OhlcData): Promise<void> {
    const dateString = new Date().toDateString();
    const cacheKey = `market-data:ohlc:${category}:${dateString}`;
    const ttlSeconds = Math.floor(CACHE_DURATIONS.OHLC / 1000);

    try {
      await this.cacheService.set(cacheKey, data, ttlSeconds);
      this.logger.debug(
        `Cached OHLC data for ${category} (TTL: ${ttlSeconds}s)`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error caching OHLC data for ${category}: ${err.message}`,
      );
    }
  }

  // ==================== HISTORICAL CACHE OPERATIONS ====================

  /**
   * Get historical data from Redis cache
   */
  async getHistoricalData(
    category: ItemCategory,
    date: Date,
  ): Promise<HistoricalDataPoint | null> {
    const dateISO = date.toISOString().split('T')[0];
    const cacheKey = `market-data:historical:${category}:${dateISO}`;

    try {
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        this.logger.debug(`Historical cache hit for ${category}:${dateISO}`);
        this.metricsService.trackCacheHit(category, 'historical');
        return cached;
      }

      this.logger.debug(`Historical cache miss for ${category}:${dateISO}`);
      this.metricsService.trackCacheMiss(category, 'historical');
      return null;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error reading historical cache for ${category}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Set historical data in Redis cache
   */
  async setHistoricalData(
    category: ItemCategory,
    date: Date,
    data: HistoricalDataPoint,
  ): Promise<void> {
    const dateISO = date.toISOString().split('T')[0];
    const cacheKey = `market-data:historical:${category}:${dateISO}`;
    const ttlSeconds = Math.floor(CACHE_DURATIONS.HISTORICAL / 1000);

    try {
      await this.cacheService.set(cacheKey, data, ttlSeconds);
      this.logger.debug(
        `Cached historical data for ${category}:${dateISO} (TTL: ${ttlSeconds}s)`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Error caching historical data for ${category}: ${err.message}`,
      );
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Invalidate all cache for a category
   */
  async invalidateCategory(category: ItemCategory): Promise<void> {
    this.logger.log(`Invalidating all cache for category: ${category}`);

    // Clear MongoDB cache
    try {
      await this.cacheModel.deleteMany({ category }).exec();
      this.logger.log(`Cleared MongoDB cache for ${category}`);
    } catch (error) {
      this.logger.error(
        `Failed to clear MongoDB cache for ${category}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Note: Redis cache will expire via TTL
    this.logger.warn(
      'Redis cache invalidation by pattern not implemented - relying on TTL expiration',
    );
  }

  /**
   * Build fresh cache key for Redis
   */
  private buildFreshCacheKey(category: ItemCategory): string {
    return `market-data:fresh:${category}`;
  }

  /**
   * Build stale cache key for Redis
   */
  private buildStaleCacheKey(category: ItemCategory): string {
    return `market-data:stale:${category}`;
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    freshHits: number;
    freshMisses: number;
    staleHits: number;
    staleMisses: number;
  }> {
    // This would integrate with CacheService metrics
    return {
      freshHits: 0,
      freshMisses: 0,
      staleHits: 0,
      staleMisses: 0,
    };
  }
}
