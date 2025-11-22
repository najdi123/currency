import { Logger } from '@nestjs/common';

/**
 * Performance metrics for a specific operation
 */
export interface PerformanceMetrics {
  operation: string;
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastDuration: number;
  lastCallTime: Date;
  p50: number; // Median
  p95: number; // 95th percentile
  p99: number; // 99th percentile
}

/**
 * Performance monitor with histogram-based statistics
 * Tracks operation performance with minimal overhead
 */
export class PerformanceMonitor {
  private readonly logger = new Logger(PerformanceMonitor.name);
  private metrics = new Map<string, {
    totalCalls: number;
    totalDuration: number;
    minDuration: number;
    maxDuration: number;
    lastDuration: number;
    lastCallTime: Date;
    durations: number[]; // For percentile calculations
  }>();

  // Maximum number of duration samples to keep per operation
  private readonly maxSamples: number;

  constructor(maxSamples: number = 1000) {
    this.maxSamples = maxSamples;
  }

  /**
   * Start timing an operation
   * Returns a function to end the timing
   */
  startTiming(operation: string): () => void {
    const startTime = process.hrtime.bigint();

    return () => {
      const endTime = process.hrtime.bigint();
      const durationNs = Number(endTime - startTime);
      const durationMs = durationNs / 1_000_000; // Convert to milliseconds

      this.recordMetric(operation, durationMs);
    };
  }

  /**
   * Measure an async operation
   */
  async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const endTiming = this.startTiming(operation);
    try {
      const result = await fn();
      endTiming();
      return result;
    } catch (error) {
      endTiming();
      throw error;
    }
  }

  /**
   * Measure a synchronous operation
   */
  measureSync<T>(operation: string, fn: () => T): T {
    const endTiming = this.startTiming(operation);
    try {
      const result = fn();
      endTiming();
      return result;
    } catch (error) {
      endTiming();
      throw error;
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(operation: string, durationMs: number): void {
    let metric = this.metrics.get(operation);

    if (!metric) {
      metric = {
        totalCalls: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastDuration: 0,
        lastCallTime: new Date(),
        durations: [],
      };
      this.metrics.set(operation, metric);
    }

    metric.totalCalls++;
    metric.totalDuration += durationMs;
    metric.minDuration = Math.min(metric.minDuration, durationMs);
    metric.maxDuration = Math.max(metric.maxDuration, durationMs);
    metric.lastDuration = durationMs;
    metric.lastCallTime = new Date();

    // Keep only the most recent samples for percentile calculations
    metric.durations.push(durationMs);
    if (metric.durations.length > this.maxSamples) {
      metric.durations.shift(); // Remove oldest
    }

    // Log slow operations (> 1 second)
    if (durationMs > 1000) {
      this.logger.warn(
        `⏱️ Slow operation detected: "${operation}" took ${durationMs.toFixed(2)}ms`
      );
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getMetrics(operation: string): PerformanceMetrics | null {
    const metric = this.metrics.get(operation);
    if (!metric) return null;

    const sortedDurations = [...metric.durations].sort((a, b) => a - b);
    const p50Index = Math.floor(sortedDurations.length * 0.5);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);

    return {
      operation,
      totalCalls: metric.totalCalls,
      totalDuration: metric.totalDuration,
      averageDuration: metric.totalDuration / metric.totalCalls,
      minDuration: metric.minDuration,
      maxDuration: metric.maxDuration,
      lastDuration: metric.lastDuration,
      lastCallTime: metric.lastCallTime,
      p50: sortedDurations[p50Index] || 0,
      p95: sortedDurations[p95Index] || 0,
      p99: sortedDurations[p99Index] || 0,
    };
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.keys()).map(operation => this.getMetrics(operation)!);
  }

  /**
   * Get a summary of all metrics
   */
  getSummary(): {
    totalOperations: number;
    totalCalls: number;
    slowestOperations: { operation: string; avgDuration: number }[];
    fastestOperations: { operation: string; avgDuration: number }[];
  } {
    const allMetrics = this.getAllMetrics();

    const sortedByAvg = [...allMetrics].sort((a, b) => b.averageDuration - a.averageDuration);

    return {
      totalOperations: allMetrics.length,
      totalCalls: allMetrics.reduce((sum, m) => sum + m.totalCalls, 0),
      slowestOperations: sortedByAvg
        .slice(0, 5)
        .map(m => ({ operation: m.operation, avgDuration: m.averageDuration })),
      fastestOperations: sortedByAvg
        .slice(-5)
        .reverse()
        .map(m => ({ operation: m.operation, avgDuration: m.averageDuration })),
    };
  }

  /**
   * Log a performance report
   */
  logReport(): void {
    const summary = this.getSummary();

    this.logger.log(`📊 Performance Report:`);
    this.logger.log(`   Total Operations: ${summary.totalOperations}`);
    this.logger.log(`   Total Calls: ${summary.totalCalls}`);

    if (summary.slowestOperations.length > 0) {
      this.logger.log(`   🐌 Slowest Operations:`);
      summary.slowestOperations.forEach(op => {
        this.logger.log(`      - ${op.operation}: ${op.avgDuration.toFixed(2)}ms avg`);
      });
    }

    if (summary.fastestOperations.length > 0) {
      this.logger.log(`   ⚡ Fastest Operations:`);
      summary.fastestOperations.forEach(op => {
        this.logger.log(`      - ${op.operation}: ${op.avgDuration.toFixed(2)}ms avg`);
      });
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.logger.debug('Performance metrics cleared');
  }

  /**
   * Clear metrics for a specific operation
   */
  clearOperation(operation: string): void {
    this.metrics.delete(operation);
    this.logger.debug(`Performance metrics cleared for operation: ${operation}`);
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const allMetrics = this.getAllMetrics();
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: this.getSummary(),
      metrics: allMetrics,
    }, null, 2);
  }
}
