import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";

/**
 * Metrics Service
 *
 * Tracks operational metrics for monitoring and alerting.
 * Focuses on database operation failures and snapshot save errors.
 * Provides threshold-based alerts for consecutive failures.
 *
 * Memory Management:
 * - Rate limit Maps have size limits (MAX_RATE_LIMIT_ENTRIES)
 * - Periodic cleanup runs every hour to clear old entries
 * - Maps are pruned when they exceed size limits
 */

export interface SnapshotFailureMetric {
  itemType: string; // e.g., 'currencies', 'crypto', 'gold', 'ohlc'
  itemCode: string; // e.g., 'all', 'usd_sell', 'btc'
  consecutiveFailures: number;
  firstFailureTimestamp: Date;
  lastFailureTimestamp: Date;
  lastError: string;
}

export interface DbOperationFailureMetric {
  operation: string; // e.g., 'cache_read', 'cache_write', 'snapshot_save'
  context: string; // Additional context about the operation
  consecutiveFailures: number;
  firstFailureTimestamp: Date;
  lastFailureTimestamp: Date;
  lastError: string;
}

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);

  // Alert thresholds
  private readonly CONSECUTIVE_FAILURE_ALERT_THRESHOLD = 3;
  private readonly CRITICAL_FAILURE_ALERT_THRESHOLD = 10;

  // Memory management limits
  private readonly MAX_RATE_LIMIT_ENTRIES = 1000; // Max unique identifiers to track
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private cleanupInterval: NodeJS.Timeout;

  // In-memory tracking of failures (in production, use Redis or similar)
  private snapshotFailures = new Map<string, SnapshotFailureMetric>();
  private dbOperationFailures = new Map<string, DbOperationFailureMetric>();

  constructor() {
    // Start periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.pruneRateLimitMaps();
    }, this.CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Prune rate limit maps to prevent unbounded memory growth
   * Called periodically and when maps exceed size limits
   */
  private pruneRateLimitMaps(): void {
    const consumedSize = this.rateLimitQuotaConsumed.size;
    const exhaustedSize = this.rateLimitQuotaExhausted.size;

    if (consumedSize > this.MAX_RATE_LIMIT_ENTRIES) {
      // Keep only the top N entries by count
      const sorted = Array.from(this.rateLimitQuotaConsumed.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.floor(this.MAX_RATE_LIMIT_ENTRIES * 0.8));
      this.rateLimitQuotaConsumed.clear();
      sorted.forEach(([key, value]) => this.rateLimitQuotaConsumed.set(key, value));
      this.logger.log(`Pruned rateLimitQuotaConsumed from ${consumedSize} to ${this.rateLimitQuotaConsumed.size} entries`);
    }

    if (exhaustedSize > this.MAX_RATE_LIMIT_ENTRIES) {
      const sorted = Array.from(this.rateLimitQuotaExhausted.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.floor(this.MAX_RATE_LIMIT_ENTRIES * 0.8));
      this.rateLimitQuotaExhausted.clear();
      sorted.forEach(([key, value]) => this.rateLimitQuotaExhausted.set(key, value));
      this.logger.log(`Pruned rateLimitQuotaExhausted from ${exhaustedSize} to ${this.rateLimitQuotaExhausted.size} entries`);
    }
  }

  /**
   * Track a snapshot save failure
   */
  trackSnapshotFailure(
    itemType: string,
    itemCode: string,
    error: string,
  ): void {
    const key = `${itemType}:${itemCode}`;
    const now = new Date();

    const existing = this.snapshotFailures.get(key);

    if (existing) {
      existing.consecutiveFailures++;
      existing.lastFailureTimestamp = now;
      existing.lastError = error;
    } else {
      this.snapshotFailures.set(key, {
        itemType,
        itemCode,
        consecutiveFailures: 1,
        firstFailureTimestamp: now,
        lastFailureTimestamp: now,
        lastError: error,
      });
    }

    const metric = this.snapshotFailures.get(key)!;

    // Log warning if threshold exceeded
    if (
      metric.consecutiveFailures === this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD
    ) {
      this.logger.warn(
        `⚠️  ALERT: ${metric.consecutiveFailures} consecutive snapshot save failures for ${itemType}:${itemCode}`,
        {
          metric,
          recommendation: "Check database connection and disk space",
        },
      );
    }

    // Log critical alert if high threshold exceeded
    if (metric.consecutiveFailures === this.CRITICAL_FAILURE_ALERT_THRESHOLD) {
      this.logger.error(
        `🚨 CRITICAL ALERT: ${metric.consecutiveFailures} consecutive snapshot save failures for ${itemType}:${itemCode}`,
        {
          metric,
          recommendation:
            "Immediate investigation required - historical data may be lost",
        },
      );
    }

    // Log every failure for tracking
    this.logger.error(
      `Snapshot save failed for ${itemType}:${itemCode} (${metric.consecutiveFailures} consecutive)`,
      {
        error,
        consecutiveFailures: metric.consecutiveFailures,
      },
    );
  }

  /**
   * Reset snapshot failure counter (call on successful save)
   */
  resetSnapshotFailureCounter(itemType: string, itemCode: string): void {
    const key = `${itemType}:${itemCode}`;
    const existing = this.snapshotFailures.get(key);

    if (existing && existing.consecutiveFailures > 0) {
      this.logger.log(
        `✅ Snapshot save recovered for ${itemType}:${itemCode} after ${existing.consecutiveFailures} failures`,
      );
      this.snapshotFailures.delete(key);
    }
  }

  /**
   * Track a database operation failure
   */
  trackDbOperationFailure(
    operation: string,
    context: string,
    error: string,
  ): void {
    const key = `${operation}:${context}`;
    const now = new Date();

    const existing = this.dbOperationFailures.get(key);

    if (existing) {
      existing.consecutiveFailures++;
      existing.lastFailureTimestamp = now;
      existing.lastError = error;
    } else {
      this.dbOperationFailures.set(key, {
        operation,
        context,
        consecutiveFailures: 1,
        firstFailureTimestamp: now,
        lastFailureTimestamp: now,
        lastError: error,
      });
    }

    const metric = this.dbOperationFailures.get(key)!;

    // Log warning if threshold exceeded
    if (
      metric.consecutiveFailures === this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD
    ) {
      this.logger.warn(
        `⚠️  ALERT: ${metric.consecutiveFailures} consecutive DB operation failures for ${operation}`,
        {
          metric,
          recommendation: "Check database connection and credentials",
        },
      );
    }

    // Log critical alert if high threshold exceeded
    if (metric.consecutiveFailures === this.CRITICAL_FAILURE_ALERT_THRESHOLD) {
      this.logger.error(
        `🚨 CRITICAL ALERT: ${metric.consecutiveFailures} consecutive DB operation failures for ${operation}`,
        {
          metric,
          recommendation:
            "Database may be unavailable - immediate investigation required",
        },
      );
    }
  }

  /**
   * Reset database operation failure counter (call on successful operation)
   */
  resetDbOperationFailureCounter(operation: string, context: string): void {
    const key = `${operation}:${context}`;
    const existing = this.dbOperationFailures.get(key);

    if (existing && existing.consecutiveFailures > 0) {
      this.logger.log(
        `✅ DB operation recovered for ${operation} after ${existing.consecutiveFailures} failures`,
      );
      this.dbOperationFailures.delete(key);
    }
  }

  /**
   * Get all current snapshot failure metrics (for monitoring dashboards)
   */
  getSnapshotFailureMetrics(): SnapshotFailureMetric[] {
    return Array.from(this.snapshotFailures.values());
  }

  /**
   * Get all current DB operation failure metrics (for monitoring dashboards)
   */
  getDbOperationFailureMetrics(): DbOperationFailureMetric[] {
    return Array.from(this.dbOperationFailures.values());
  }

  /**
   * Get health status based on failure metrics
   */
  getHealthStatus(): {
    healthy: boolean;
    warnings: string[];
    criticalIssues: string[];
  } {
    const warnings: string[] = [];
    const criticalIssues: string[] = [];

    // Check snapshot failures
    for (const metric of this.snapshotFailures.values()) {
      if (metric.consecutiveFailures >= this.CRITICAL_FAILURE_ALERT_THRESHOLD) {
        criticalIssues.push(
          `Critical: ${metric.consecutiveFailures} consecutive snapshot save failures for ${metric.itemType}:${metric.itemCode}`,
        );
      } else if (
        metric.consecutiveFailures >= this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD
      ) {
        warnings.push(
          `Warning: ${metric.consecutiveFailures} consecutive snapshot save failures for ${metric.itemType}:${metric.itemCode}`,
        );
      }
    }

    // Check DB operation failures
    for (const metric of this.dbOperationFailures.values()) {
      if (metric.consecutiveFailures >= this.CRITICAL_FAILURE_ALERT_THRESHOLD) {
        criticalIssues.push(
          `Critical: ${metric.consecutiveFailures} consecutive DB operation failures for ${metric.operation}`,
        );
      } else if (
        metric.consecutiveFailures >= this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD
      ) {
        warnings.push(
          `Warning: ${metric.consecutiveFailures} consecutive DB operation failures for ${metric.operation}`,
        );
      }
    }

    return {
      healthy: criticalIssues.length === 0 && warnings.length === 0,
      warnings,
      criticalIssues,
    };
  }

  /**
   * Track a cache hit
   */
  trackCacheHit(category: string, source: string): void {
    this.cacheOperations.hits++;
    this.logger.debug(`Cache hit: ${category} from ${source}`);
  }

  /**
   * Track a cache miss
   */
  trackCacheMiss(category: string, source: string): void {
    this.cacheOperations.misses++;
    this.logger.debug(`Cache miss: ${category} from ${source}`);
  }

  /**
   * Track a cache set operation
   */
  trackCacheSet(key: string): void {
    this.cacheOperations.sets++;
    this.logger.debug(`Cache set: ${key}`);
  }

  /**
   * Track a cache error
   */
  trackCacheError(error: string): void {
    this.cacheOperations.errors++;
    this.logger.error(`Cache error: ${error}`);
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): {
    hits: number;
    misses: number;
    sets: number;
    errors: number;
    hitRate: number;
    totalRequests: number;
  } {
    const totalRequests = this.cacheOperations.hits + this.cacheOperations.misses;
    const hitRate =
      totalRequests > 0
        ? (this.cacheOperations.hits / totalRequests) * 100
        : 0;

    return {
      hits: this.cacheOperations.hits,
      misses: this.cacheOperations.misses,
      sets: this.cacheOperations.sets,
      errors: this.cacheOperations.errors,
      totalRequests,
      hitRate: parseFloat(hitRate.toFixed(2)),
    };
  }

  // Cache performance metrics
  private cacheOperations = {
    hits: 0,
    misses: 0,
    sets: 0,
    errors: 0,
  };

  // Rate limiting metrics
  private rateLimitQuotaConsumed = new Map<string, number>(); // identifier -> count
  private rateLimitQuotaExhausted = new Map<string, number>(); // identifier -> count
  private rateLimitErrors = 0;

  /**
   * Track quota consumption
   * Uses simpler key structure to reduce memory usage
   */
  trackRateLimitQuotaConsumed(
    identifier: string,
    endpoint?: string,
    _itemType?: string,
  ): void {
    // Use simpler key: just identifier (IP) to reduce memory footprint
    // Endpoint is only used for logging, not for unique key generation
    const key = identifier;
    const current = this.rateLimitQuotaConsumed.get(key) || 0;
    this.rateLimitQuotaConsumed.set(key, current + 1);

    // Trigger pruning if map gets too large
    if (this.rateLimitQuotaConsumed.size > this.MAX_RATE_LIMIT_ENTRIES) {
      this.pruneRateLimitMaps();
    }

    this.logger.debug(`Rate limit quota consumed: ${identifier} (${endpoint})`);
  }

  /**
   * Track quota exhaustion
   */
  trackRateLimitQuotaExhausted(identifier: string): void {
    const current = this.rateLimitQuotaExhausted.get(identifier) || 0;
    this.rateLimitQuotaExhausted.set(identifier, current + 1);

    this.logger.warn(`Rate limit quota exhausted for: ${identifier}`);
  }

  /**
   * Track rate limit service errors
   */
  trackRateLimitError(error: string): void {
    this.rateLimitErrors++;
    this.logger.error(`Rate limit service error: ${error}`);

    // Alert if errors exceed threshold
    if (this.rateLimitErrors >= this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
      this.logger.warn(
        `⚠️  ALERT: ${this.rateLimitErrors} rate limit service errors detected`,
        {
          recommendation:
            "Check database connection and rate limit configuration",
        },
      );
    }
  }

  /**
   * Get rate limit metrics summary
   */
  getRateLimitMetrics(): {
    totalQuotaConsumed: number;
    totalQuotaExhausted: number;
    totalErrors: number;
    topConsumers: Array<{ identifier: string; count: number }>;
    topExhausted: Array<{ identifier: string; count: number }>;
    mapSizes: { consumed: number; exhausted: number };
  } {
    // Get top consumers (keys are now just identifiers)
    const topConsumers = Array.from(this.rateLimitQuotaConsumed.entries())
      .map(([identifier, count]) => ({ identifier, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top exhausted
    const topExhausted = Array.from(this.rateLimitQuotaExhausted.entries())
      .map(([identifier, count]) => ({ identifier, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalQuotaConsumed = Array.from(this.rateLimitQuotaConsumed.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    const totalQuotaExhausted = Array.from(
      this.rateLimitQuotaExhausted.values(),
    ).reduce((sum, count) => sum + count, 0);

    return {
      totalQuotaConsumed,
      totalQuotaExhausted,
      totalErrors: this.rateLimitErrors,
      topConsumers,
      topExhausted,
      mapSizes: {
        consumed: this.rateLimitQuotaConsumed.size,
        exhausted: this.rateLimitQuotaExhausted.size,
      },
    };
  }

  /**
   * Clear all metrics (useful for testing or reset)
   */
  clearAllMetrics(): void {
    this.snapshotFailures.clear();
    this.dbOperationFailures.clear();
    this.rateLimitQuotaConsumed.clear();
    this.rateLimitQuotaExhausted.clear();
    this.rateLimitErrors = 0;
    this.cacheOperations = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
    };
    this.logger.log("All metrics cleared");
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): {
    cache: {
      hits: number;
      misses: number;
      sets: number;
      errors: number;
      hitRate: number;
      totalRequests: number;
    };
    rateLimit: {
      totalQuotaConsumed: number;
      totalQuotaExhausted: number;
      totalErrors: number;
      topConsumers: Array<{ identifier: string; count: number }>;
      topExhausted: Array<{ identifier: string; count: number }>;
    };
    health: {
      healthy: boolean;
      warnings: string[];
      criticalIssues: string[];
    };
    failures: {
      snapshots: SnapshotFailureMetric[];
      dbOperations: DbOperationFailureMetric[];
    };
    timestamp: string;
  } {
    return {
      cache: this.getCacheMetrics(),
      rateLimit: this.getRateLimitMetrics(),
      health: this.getHealthStatus(),
      failures: {
        snapshots: this.getSnapshotFailureMetrics(),
        dbOperations: this.getDbOperationFailureMetrics(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
