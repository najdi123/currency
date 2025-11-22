import { Controller, Get, Post, HttpCode } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

/**
 * Metrics Controller
 *
 * Provides endpoints for monitoring application performance and health.
 */
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * GET /metrics/performance
   *
   * Returns comprehensive performance report including:
   * - Cache hit/miss metrics
   * - Rate limit usage
   * - Health status
   * - Failure tracking
   *
   * Example Response:
   * {
   *   "cache": {
   *     "hits": 1250,
   *     "misses": 350,
   *     "sets": 400,
   *     "errors": 2,
   *     "hitRate": 78.13,
   *     "totalRequests": 1600
   *   },
   *   "rateLimit": {
   *     "totalQuotaConsumed": 500,
   *     "totalQuotaExhausted": 5,
   *     "totalErrors": 0,
   *     "topConsumers": [...],
   *     "topExhausted": [...]
   *   },
   *   "health": {
   *     "healthy": true,
   *     "warnings": [],
   *     "criticalIssues": []
   *   },
   *   "failures": {
   *     "snapshots": [],
   *     "dbOperations": []
   *   },
   *   "timestamp": "2025-01-22T10:30:00.000Z"
   * }
   */
  @Get("performance")
  getPerformanceReport() {
    return this.metricsService.getPerformanceReport();
  }

  /**
   * GET /metrics/health
   *
   * Returns application health status based on failure metrics.
   *
   * Example Response:
   * {
   *   "healthy": true,
   *   "warnings": [],
   *   "criticalIssues": []
   * }
   */
  @Get("health")
  getHealthStatus() {
    return this.metricsService.getHealthStatus();
  }

  /**
   * GET /metrics/cache
   *
   * Returns cache performance metrics.
   *
   * Example Response:
   * {
   *   "hits": 1250,
   *   "misses": 350,
   *   "sets": 400,
   *   "errors": 2,
   *   "hitRate": 78.13,
   *   "totalRequests": 1600
   * }
   */
  @Get("cache")
  getCacheMetrics() {
    return this.metricsService.getCacheMetrics();
  }

  /**
   * GET /metrics/rate-limit
   *
   * Returns rate limiting metrics including quota consumption and top consumers.
   *
   * Example Response:
   * {
   *   "totalQuotaConsumed": 500,
   *   "totalQuotaExhausted": 5,
   *   "totalErrors": 0,
   *   "topConsumers": [
   *     { "identifier": "192.168.1.100", "count": 150 }
   *   ],
   *   "topExhausted": [
   *     { "identifier": "192.168.1.200", "count": 3 }
   *   ]
   * }
   */
  @Get("rate-limit")
  getRateLimitMetrics() {
    return this.metricsService.getRateLimitMetrics();
  }

  /**
   * GET /metrics/failures
   *
   * Returns all current failure metrics for snapshots and database operations.
   *
   * Example Response:
   * {
   *   "snapshots": [
   *     {
   *       "itemType": "currencies",
   *       "itemCode": "usd_sell",
   *       "consecutiveFailures": 2,
   *       "firstFailureTimestamp": "2025-01-22T10:00:00.000Z",
   *       "lastFailureTimestamp": "2025-01-22T10:05:00.000Z",
   *       "lastError": "Database connection timeout"
   *     }
   *   ],
   *   "dbOperations": []
   * }
   */
  @Get("failures")
  getFailureMetrics() {
    return {
      snapshots: this.metricsService.getSnapshotFailureMetrics(),
      dbOperations: this.metricsService.getDbOperationFailureMetrics(),
    };
  }

  /**
   * POST /metrics/reset
   *
   * Resets all metrics counters to zero.
   * Does not affect actual application state, only metrics tracking.
   *
   * Returns:
   * {
   *   "message": "All metrics reset successfully",
   *   "timestamp": "2025-01-22T10:30:00.000Z"
   * }
   */
  @Post("reset")
  @HttpCode(200)
  resetMetrics() {
    this.metricsService.clearAllMetrics();
    return {
      message: "All metrics reset successfully",
      timestamp: new Date().toISOString(),
    };
  }
}
