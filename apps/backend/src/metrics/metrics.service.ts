import { Injectable, Logger } from '@nestjs/common';

/**
 * Metrics Service
 *
 * Tracks operational metrics for monitoring and alerting.
 * Focuses on database operation failures and snapshot save errors.
 * Provides threshold-based alerts for consecutive failures.
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
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // Alert thresholds
  private readonly CONSECUTIVE_FAILURE_ALERT_THRESHOLD = 3;
  private readonly CRITICAL_FAILURE_ALERT_THRESHOLD = 10;

  // In-memory tracking of failures (in production, use Redis or similar)
  private snapshotFailures = new Map<string, SnapshotFailureMetric>();
  private dbOperationFailures = new Map<string, DbOperationFailureMetric>();

  /**
   * Track a snapshot save failure
   */
  trackSnapshotFailure(itemType: string, itemCode: string, error: string): void {
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
    if (metric.consecutiveFailures === this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
      this.logger.warn(
        `⚠️  ALERT: ${metric.consecutiveFailures} consecutive snapshot save failures for ${itemType}:${itemCode}`,
        {
          metric,
          recommendation: 'Check database connection and disk space',
        },
      );
    }

    // Log critical alert if high threshold exceeded
    if (metric.consecutiveFailures === this.CRITICAL_FAILURE_ALERT_THRESHOLD) {
      this.logger.error(
        `🚨 CRITICAL ALERT: ${metric.consecutiveFailures} consecutive snapshot save failures for ${itemType}:${itemCode}`,
        {
          metric,
          recommendation: 'Immediate investigation required - historical data may be lost',
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
  trackDbOperationFailure(operation: string, context: string, error: string): void {
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
    if (metric.consecutiveFailures === this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
      this.logger.warn(
        `⚠️  ALERT: ${metric.consecutiveFailures} consecutive DB operation failures for ${operation}`,
        {
          metric,
          recommendation: 'Check database connection and credentials',
        },
      );
    }

    // Log critical alert if high threshold exceeded
    if (metric.consecutiveFailures === this.CRITICAL_FAILURE_ALERT_THRESHOLD) {
      this.logger.error(
        `🚨 CRITICAL ALERT: ${metric.consecutiveFailures} consecutive DB operation failures for ${operation}`,
        {
          metric,
          recommendation: 'Database may be unavailable - immediate investigation required',
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
      } else if (metric.consecutiveFailures >= this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
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
      } else if (metric.consecutiveFailures >= this.CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
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
   * Clear all metrics (useful for testing or reset)
   */
  clearAllMetrics(): void {
    this.snapshotFailures.clear();
    this.dbOperationFailures.clear();
    this.logger.log('All metrics cleared');
  }
}
