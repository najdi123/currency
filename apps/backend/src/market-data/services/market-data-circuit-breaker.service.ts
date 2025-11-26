import { Injectable, Logger } from '@nestjs/common';
import { CIRCUIT_BREAKER } from '../constants/market-data.constants';

/**
 * Circuit Breaker States
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Too many failures, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * MarketDataCircuitBreakerService
 *
 * Implements the Circuit Breaker pattern to prevent cascading failures
 * - Tracks API failures
 * - Opens circuit after threshold failures
 * - Implements half-open state for recovery testing
 * - Automatic circuit reset on success
 */
@Injectable()
export class MarketDataCircuitBreakerService {
  private readonly logger = new Logger(MarketDataCircuitBreakerService.name);

  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private halfOpenCallsCount: number = 0;

  /**
   * Check if circuit allows the request to proceed
   */
  canProceed(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        // Normal operation - allow request
        return true;

      case CircuitState.OPEN:
        // Check if enough time has passed to try half-open
        const timeSinceLastFailure = now - this.lastFailureTime;

        if (timeSinceLastFailure >= CIRCUIT_BREAKER.RESET_TIMEOUT) {
          this.logger.log('Circuit breaker transitioning to HALF_OPEN state');
          this.state = CircuitState.HALF_OPEN;
          this.halfOpenCallsCount = 0;
          return true;
        }

        // Circuit still open
        this.logger.warn('Circuit breaker is OPEN - rejecting request');
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests to test service health
        if (this.halfOpenCallsCount < CIRCUIT_BREAKER.HALF_OPEN_MAX_CALLS) {
          this.halfOpenCallsCount++;
          return true;
        }

        this.logger.warn(
          'Circuit breaker HALF_OPEN limit reached - rejecting request',
        );
        return false;

      default:
        return true;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.successCount++;

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Enough successes in half-open state - close circuit
        if (this.successCount >= CIRCUIT_BREAKER.HALF_OPEN_MAX_CALLS) {
          this.logger.log(
            `Circuit breaker closing - ${this.successCount} consecutive successes`,
          );
          this.close();
        }
        break;

      case CircuitState.OPEN:
        // Shouldn't happen, but if it does, close the circuit
        this.logger.warn(
          'Success recorded while circuit was OPEN - closing circuit',
        );
        this.close();
        break;

      case CircuitState.CLOSED:
        // Reset failure count on success
        if (this.failureCount > 0) {
          this.logger.debug('Resetting failure count after success');
          this.failureCount = 0;
        }
        break;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0; // Reset success count

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.failureCount >= CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
          this.logger.error(
            `Circuit breaker opening - ${this.failureCount} failures reached threshold`,
          );
          this.open();
        } else {
          this.logger.warn(
            `Circuit breaker failure ${this.failureCount}/${CIRCUIT_BREAKER.FAILURE_THRESHOLD}`,
          );
        }
        break;

      case CircuitState.HALF_OPEN:
        // Failure in half-open state - reopen circuit
        this.logger.error('Failure in HALF_OPEN state - reopening circuit');
        this.open();
        break;

      case CircuitState.OPEN:
        // Already open, just log
        this.logger.debug('Failure recorded while circuit is OPEN');
        break;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get success count (in current state)
   */
  getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Get time until circuit resets (in ms)
   * Returns 0 if circuit is not open
   */
  getTimeUntilReset(): number {
    if (this.state !== CircuitState.OPEN) {
      return 0;
    }

    const timeSinceFailure = Date.now() - this.lastFailureTime;
    const timeRemaining = CIRCUIT_BREAKER.RESET_TIMEOUT - timeSinceFailure;

    return Math.max(0, timeRemaining);
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    timeSinceLastFailure: number;
    timeUntilReset: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: Date.now() - this.lastFailureTime,
      timeUntilReset: this.getTimeUntilReset(),
    };
  }

  /**
   * Manually reset circuit breaker (for testing/admin purposes)
   */
  reset(): void {
    this.logger.log('Manually resetting circuit breaker');
    this.close();
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.successCount = 0;
    this.halfOpenCallsCount = 0;
    this.logger.error(
      `Circuit breaker OPEN - will attempt recovery in ${CIRCUIT_BREAKER.RESET_TIMEOUT}ms`,
    );
  }

  /**
   * Close the circuit
   */
  private close(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallsCount = 0;
    this.logger.log('Circuit breaker CLOSED - normal operation resumed');
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    if (!this.canProceed()) {
      if (fallback) {
        this.logger.debug('Circuit is open - using fallback');
        return fallback();
      }
      throw new Error('Circuit breaker is open and no fallback provided');
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();

      if (fallback) {
        this.logger.debug('Request failed - using fallback');
        return fallback();
      }

      throw error;
    }
  }
}
