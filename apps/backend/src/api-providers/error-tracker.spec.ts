import { ErrorTracker, CircuitBreakerError } from './error-tracker';

describe('ErrorTracker', () => {
  let errorTracker: ErrorTracker;

  beforeEach(() => {
    errorTracker = new ErrorTracker(3, 60000); // 3 errors in 60 seconds
  });

  describe('trackError', () => {
    it('should track first error without throwing', () => {
      const error = new Error('Test error');
      expect(() => errorTracker.trackError('test-context', error)).not.toThrow();
      expect(errorTracker.getErrorCount('test-context')).toBe(1);
    });

    it('should increment error count for same context', () => {
      const error = new Error('Test error');
      errorTracker.trackError('test-context', error);
      errorTracker.trackError('test-context', error);
      expect(errorTracker.getErrorCount('test-context')).toBe(2);
    });

    it('should throw CircuitBreakerError when threshold exceeded', () => {
      const error = new Error('Test error');
      errorTracker.trackError('test-context', error);
      errorTracker.trackError('test-context', error);

      expect(() => errorTracker.trackError('test-context', error)).toThrow(CircuitBreakerError);
    });

    it('should reset counter after error window expires', (done) => {
      const tracker = new ErrorTracker(3, 100); // 100ms window
      const error = new Error('Test error');

      tracker.trackError('test-context', error);
      tracker.trackError('test-context', error);

      // Wait for window to expire
      setTimeout(() => {
        tracker.trackError('test-context', error);
        expect(tracker.getErrorCount('test-context')).toBe(1);
        done();
      }, 150);
    });

    it('should track errors for different contexts independently', () => {
      const error = new Error('Test error');

      errorTracker.trackError('context-1', error);
      errorTracker.trackError('context-1', error);
      errorTracker.trackError('context-2', error);

      expect(errorTracker.getErrorCount('context-1')).toBe(2);
      expect(errorTracker.getErrorCount('context-2')).toBe(1);
    });
  });

  describe('resetError', () => {
    it('should clear error counter for context', () => {
      const error = new Error('Test error');
      errorTracker.trackError('test-context', error);
      errorTracker.trackError('test-context', error);

      errorTracker.resetError('test-context');

      expect(errorTracker.getErrorCount('test-context')).toBe(0);
      expect(errorTracker.hasErrors('test-context')).toBe(false);
    });

    it('should not throw if context does not exist', () => {
      expect(() => errorTracker.resetError('non-existent')).not.toThrow();
    });
  });

  describe('getErrorStats', () => {
    it('should return null for non-existent context', () => {
      expect(errorTracker.getErrorStats('non-existent')).toBeNull();
    });

    it('should return error statistics', () => {
      const error = new Error('Test error');
      errorTracker.trackError('test-context', error);

      const stats = errorTracker.getErrorStats('test-context');

      expect(stats).not.toBeNull();
      expect(stats?.context).toBe('test-context');
      expect(stats?.count).toBe(1);
      expect(stats?.lastError).toBe(error);
      expect(stats?.errorType).toBe('Error');
      expect(stats?.firstOccurrence).toBeInstanceOf(Date);
      expect(stats?.lastOccurrence).toBeInstanceOf(Date);
    });
  });

  describe('getAllErrorStats', () => {
    it('should return empty array when no errors tracked', () => {
      expect(errorTracker.getAllErrorStats()).toEqual([]);
    });

    it('should return all error statistics', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorTracker.trackError('context-1', error1);
      errorTracker.trackError('context-2', error2);

      const allStats = errorTracker.getAllErrorStats();

      expect(allStats).toHaveLength(2);
      expect(allStats.map(s => s.context)).toContain('context-1');
      expect(allStats.map(s => s.context)).toContain('context-2');
    });
  });

  describe('getSummary', () => {
    it('should return summary with zero counts when no errors', () => {
      const summary = errorTracker.getSummary();

      expect(summary.totalContexts).toBe(0);
      expect(summary.totalErrors).toBe(0);
      expect(summary.criticalContexts).toEqual([]);
      expect(summary.recentErrors).toEqual([]);
    });

    it('should return accurate summary statistics', () => {
      const tracker = new ErrorTracker(10, 60000); // Higher threshold to avoid circuit breaker
      const error = new Error('Test error');

      tracker.trackError('context-1', error);
      tracker.trackError('context-1', error);
      tracker.trackError('context-1', error);
      tracker.trackError('context-2', error);

      const summary = tracker.getSummary();

      expect(summary.totalContexts).toBe(2);
      expect(summary.totalErrors).toBe(4);
      expect(summary.criticalContexts).toContain('context-1');
      expect(summary.recentErrors.length).toBeGreaterThan(0);
    });

    it('should limit recent errors to 5', () => {
      const error = new Error('Test error');

      for (let i = 0; i < 10; i++) {
        errorTracker.trackError(`context-${i}`, error);
      }

      const summary = errorTracker.getSummary();

      expect(summary.recentErrors).toHaveLength(5);
    });
  });

  describe('clear', () => {
    it('should clear all error tracking data', () => {
      const error = new Error('Test error');

      errorTracker.trackError('context-1', error);
      errorTracker.trackError('context-2', error);

      errorTracker.clear();

      expect(errorTracker.getAllErrorStats()).toEqual([]);
      expect(errorTracker.getSummary().totalContexts).toBe(0);
    });
  });

  describe('hasErrors', () => {
    it('should return false when context has no errors', () => {
      expect(errorTracker.hasErrors('test-context')).toBe(false);
    });

    it('should return true when context has errors', () => {
      const error = new Error('Test error');
      errorTracker.trackError('test-context', error);

      expect(errorTracker.hasErrors('test-context')).toBe(true);
    });
  });

  describe('CircuitBreakerError', () => {
    it('should have correct error properties', () => {
      const error = new CircuitBreakerError('test-context', 5, 3);

      expect(error.name).toBe('CircuitBreakerError');
      expect(error.context).toBe('test-context');
      expect(error.errorCount).toBe(5);
      expect(error.threshold).toBe(3);
      expect(error.message).toContain('Circuit breaker triggered');
      expect(error.message).toContain('test-context');
      expect(error.message).toContain('5');
      expect(error.message).toContain('3');
    });
  });
});
