import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { MetricsService } from '../../metrics/metrics.service';
import {
  CACHE_DURATIONS,
  ItemCategory,
} from '../constants/navasan.constants';

/**
 * NavasanCacheManagerService
 *
 * Responsible for all caching operations
 * - Manages cache keys and namespaces
 * - Handles cache read/write operations
 * - Implements cache invalidation logic
 * - Tracks cache metrics
 */
@Injectable()
export class NavasanCacheManagerService {
  private readonly logger = new Logger(NavasanCacheManagerService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Get fresh data from cache
   */
  async getFreshData(category: ItemCategory): Promise<any | null> {
    const cacheKey = this.buildFreshCacheKey(category);

    try {
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        this.logger.debug(`Fresh cache hit for ${category}`);
        this.metricsService.trackCacheHit(category, 'fresh');
        return cached;
      }

      this.logger.debug(`Fresh cache miss for ${category}`);
      this.metricsService.trackCacheMiss(category, 'fresh');
      return null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error reading fresh cache for ${category}: ${err.message}`,
      );
      this.metricsService.trackCacheError(err.message);
      return null;
    }
  }

  /**
   * Set fresh data in cache
   */
  async setFreshData(category: ItemCategory, data: any): Promise<void> {
    const cacheKey = this.buildFreshCacheKey(category);
    const ttlSeconds = Math.floor(CACHE_DURATIONS.FRESH / 1000);

    try {
      await this.cacheService.set(cacheKey, data, ttlSeconds);
      this.logger.debug(
        `Cached fresh data for ${category} (TTL: ${ttlSeconds}s)`,
      );
      this.metricsService.trackCacheSet(cacheKey);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error caching fresh data for ${category}: ${err.message}`,
      );
      this.metricsService.trackCacheError(err.message);
    }
  }

  /**
   * Get stale data from cache (fallback)
   */
  async getStaleData(category: ItemCategory): Promise<any | null> {
    const cacheKey = this.buildStaleCacheKey(category);

    try {
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        this.logger.debug(`Stale cache hit for ${category}`);
        this.metricsService.trackCacheHit(category, 'stale');
        return cached;
      }

      this.logger.debug(`Stale cache miss for ${category}`);
      this.metricsService.trackCacheMiss(category, 'stale');
      return null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error reading stale cache for ${category}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Set stale data in cache (long-term fallback)
   */
  async setStaleData(category: ItemCategory, data: any): Promise<void> {
    const cacheKey = this.buildStaleCacheKey(category);
    const ttlSeconds = Math.floor(CACHE_DURATIONS.STALE / 1000);

    try {
      await this.cacheService.set(cacheKey, data, ttlSeconds);
      this.logger.debug(
        `Cached stale data for ${category} (TTL: ${ttlSeconds}s)`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error caching stale data for ${category}: ${err.message}`,
      );
    }
  }

  /**
   * Get OHLC data from cache
   */
  async getOhlcData(category: ItemCategory): Promise<any | null> {
    const dateString = new Date().toDateString();
    const cacheKey = `navasan:ohlc:${category}:${dateString}`;

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
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error reading OHLC cache for ${category}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Set OHLC data in cache
   */
  async setOhlcData(category: ItemCategory, data: any): Promise<void> {
    const dateString = new Date().toDateString();
    const cacheKey = `navasan:ohlc:${category}:${dateString}`;
    const ttlSeconds = Math.floor(CACHE_DURATIONS.OHLC / 1000);

    try {
      await this.cacheService.set(cacheKey, data, ttlSeconds);
      this.logger.debug(
        `Cached OHLC data for ${category} (TTL: ${ttlSeconds}s)`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error caching OHLC data for ${category}: ${err.message}`,
      );
    }
  }

  /**
   * Get historical data from cache
   */
  async getHistoricalData(
    category: ItemCategory,
    date: Date,
  ): Promise<any | null> {
    const dateISO = date.toISOString().split('T')[0];
    const cacheKey = `navasan:historical:${category}:${dateISO}`;

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
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error reading historical cache for ${category}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Set historical data in cache
   */
  async setHistoricalData(
    category: ItemCategory,
    date: Date,
    data: any,
  ): Promise<void> {
    const dateISO = date.toISOString().split('T')[0];
    const cacheKey = `navasan:historical:${category}:${dateISO}`;
    const ttlSeconds = Math.floor(CACHE_DURATIONS.HISTORICAL / 1000);

    try {
      await this.cacheService.set(cacheKey, data, ttlSeconds);
      this.logger.debug(
        `Cached historical data for ${category}:${dateISO} (TTL: ${ttlSeconds}s)`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error caching historical data for ${category}: ${err.message}`,
      );
    }
  }

  /**
   * Invalidate all cache for a category
   */
  async invalidateCategory(category: ItemCategory): Promise<void> {
    this.logger.log(`Invalidating all cache for category: ${category}`);

    // In the current CacheService, there's no delete-by-pattern
    // This is a placeholder for future enhancement
    // For now, cache will expire naturally via TTL

    this.logger.warn(
      'Cache invalidation by pattern not implemented - relying on TTL expiration',
    );
  }

  /**
   * Build fresh cache key
   */
  private buildFreshCacheKey(category: ItemCategory): string {
    return `navasan:fresh:${category}`;
  }

  /**
   * Build stale cache key
   */
  private buildStaleCacheKey(category: ItemCategory): string {
    return `navasan:stale:${category}`;
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
    // For now, return placeholder
    return {
      freshHits: 0,
      freshMisses: 0,
      staleHits: 0,
      staleMisses: 0,
    };
  }
}
