import { Logger } from "@nestjs/common";

/**
 * Error statistics for a specific context
 */
export interface ErrorStats {
  context: string;
  count: number;
  lastError: Error;
  lastOccurrence: Date;
  firstOccurrence: Date;
  errorType: string;
}

/**
 * Circuit Breaker Error
 * Thrown when error threshold is exceeded
 */
export class CircuitBreakerError extends Error {
  constructor(
    public readonly context: string,
    public readonly errorCount: number,
    public readonly threshold: number,
  ) {
    super(
      `Circuit breaker triggered for ${context}: ${errorCount} errors (threshold: ${threshold})`,
    );
    this.name = "CircuitBreakerError";
  }
}

/**
 * Error Tracker with Circuit Breaker Pattern
 * Tracks errors by context and triggers circuit breaker when threshold exceeded
 */
export class ErrorTracker {
  private readonly logger = new Logger(ErrorTracker.name);
  private errors = new Map<
    string,
    {
      count: number;
      lastError: Error;
      lastOccurrence: Date;
      firstOccurrence: Date;
    }
  >();

  // Circuit breaker threshold (consecutive errors before tripping)
  private readonly circuitBreakerThreshold: number;

  // Time window for error counting (ms)
  private readonly errorWindowMs: number;

  constructor(
    circuitBreakerThreshold: number = 5,
    errorWindowMs: number = 60000, // 1 minute
  ) {
    this.circuitBreakerThreshold = circuitBreakerThreshold;
    this.errorWindowMs = errorWindowMs;
  }

  /**
   * Track an error occurrence
   * @throws CircuitBreakerError if threshold exceeded
   */
  trackError(context: string, error: Error): void {
    const now = new Date();
    const existing = this.errors.get(context);

    if (existing) {
      // Check if we're still within the error window
      const timeSinceFirst = now.getTime() - existing.firstOccurrence.getTime();

      if (timeSinceFirst > this.errorWindowMs) {
        // Reset counter if outside window
        this.errors.set(context, {
          count: 1,
          lastError: error,
          lastOccurrence: now,
          firstOccurrence: now,
        });
      } else {
        // Increment counter within window
        existing.count++;
        existing.lastError = error;
        existing.lastOccurrence = now;
        this.errors.set(context, existing);

        // Check circuit breaker threshold
        if (existing.count >= this.circuitBreakerThreshold) {
          this.logger.error(
            `🔴 Circuit breaker TRIGGERED for "${context}": ` +
              `${existing.count} consecutive errors in ${timeSinceFirst}ms ` +
              `(threshold: ${this.circuitBreakerThreshold})`,
          );
          throw new CircuitBreakerError(
            context,
            existing.count,
            this.circuitBreakerThreshold,
          );
        }

        if (existing.count >= 3) {
          this.logger.warn(
            `⚠️ Multiple errors for "${context}": ${existing.count} errors, ` +
              `last: ${error.message}`,
          );
        }
      }
    } else {
      // First error for this context
      this.errors.set(context, {
        count: 1,
        lastError: error,
        lastOccurrence: now,
        firstOccurrence: now,
      });
    }
  }

  /**
   * Reset error counter for a context (call after successful operation)
   */
  resetError(context: string): void {
    const existing = this.errors.get(context);
    if (existing && existing.count > 1) {
      this.logger.log(
        `✅ Recovered from errors in "${context}" (had ${existing.count} errors)`,
      );
    }
    this.errors.delete(context);
  }

  /**
   * Get error statistics for a specific context
   */
  getErrorStats(context: string): ErrorStats | null {
    const stats = this.errors.get(context);
    if (!stats) return null;

    return {
      context,
      ...stats,
      errorType: stats.lastError.constructor.name,
    };
  }

  /**
   * Get all error statistics
   */
  getAllErrorStats(): ErrorStats[] {
    return Array.from(this.errors.entries()).map(([context, stats]) => ({
      context,
      ...stats,
      errorType: stats.lastError.constructor.name,
    }));
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalContexts: number;
    totalErrors: number;
    criticalContexts: string[];
    recentErrors: ErrorStats[];
  } {
    const allStats = this.getAllErrorStats();

    return {
      totalContexts: allStats.length,
      totalErrors: allStats.reduce((sum, s) => sum + s.count, 0),
      criticalContexts: allStats
        .filter((s) => s.count >= 3)
        .map((s) => s.context),
      recentErrors: allStats
        .sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime())
        .slice(0, 5),
    };
  }

  /**
   * Clear all error tracking data
   */
  clear(): void {
    this.errors.clear();
    this.logger.debug("Error tracking data cleared");
  }

  /**
   * Check if context is in error state
   */
  hasErrors(context: string): boolean {
    return this.errors.has(context);
  }

  /**
   * Get error count for context
   */
  getErrorCount(context: string): number {
    return this.errors.get(context)?.count || 0;
  }
}
