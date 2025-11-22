import { Controller, Get, Post, HttpCode } from "@nestjs/common";
import { CacheService } from "./cache.service";

/**
 * Cache Metrics Controller
 *
 * Provides endpoints for monitoring cache performance and statistics.
 */
@Controller("cache")
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * GET /cache/metrics
   *
   * Returns detailed cache metrics including hit/miss rates and namespace breakdown.
   *
   * Example Response:
   * {
   *   "total": {
   *     "hits": 1250,
   *     "misses": 350,
   *     "sets": 400,
   *     "deletes": 50,
   *     "errors": 2,
   *     "requests": 1600,
   *     "hitRate": 78.13
   *   },
   *   "byNamespace": {
   *     "navasan:ohlc": {
   *       "hits": 800,
   *       "misses": 200,
   *       "requests": 1000,
   *       "hitRate": 80.00
   *     },
   *     "navasan:historical": {
   *       "hits": 450,
   *       "misses": 150,
   *       "requests": 600,
   *       "hitRate": 75.00
   *     }
   *   }
   * }
   */
  @Get("metrics")
  getMetrics() {
    return this.cacheService.getMetrics();
  }

  /**
   * GET /cache/stats
   *
   * Returns cache statistics including type (Redis/memory), key count, and memory usage.
   *
   * Example Response:
   * {
   *   "type": "redis",
   *   "keys": 156,
   *   "memoryUsage": "2.5M"
   * }
   */
  @Get("stats")
  async getStats() {
    return this.cacheService.getStats();
  }

  /**
   * GET /cache/health
   *
   * Returns comprehensive cache health information combining metrics and stats.
   *
   * Example Response:
   * {
   *   "status": "healthy",
   *   "cacheType": "redis",
   *   "metrics": { ... },
   *   "stats": { ... },
   *   "timestamp": "2025-01-22T10:30:00.000Z"
   * }
   */
  @Get("health")
  async getHealth() {
    const metrics = this.cacheService.getMetrics();
    const stats = await this.cacheService.getStats();

    return {
      status: "healthy",
      cacheType: stats.type,
      metrics,
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /cache/metrics/reset
   *
   * Resets all cache metrics counters to zero.
   * Does not clear cached data, only resets performance counters.
   *
   * Returns:
   * {
   *   "message": "Cache metrics reset successfully",
   *   "timestamp": "2025-01-22T10:30:00.000Z"
   * }
   */
  @Post("metrics/reset")
  @HttpCode(200)
  resetMetrics() {
    this.cacheService.resetMetrics();
    return {
      message: "Cache metrics reset successfully",
      timestamp: new Date().toISOString(),
    };
  }
}
