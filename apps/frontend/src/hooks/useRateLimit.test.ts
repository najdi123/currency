import { renderHook, waitFor } from '@testing-library/react';

// Mock fetch globally
global.fetch = jest.fn();

// Import hook after mocking fetch
import { useRateLimit } from './useRateLimit';

describe('useRateLimit', () => {
  beforeEach(() => {
    // Clear all mocks and reset modules to clear module-level cache
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset fetch mock to return a default response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const mockSuccessResponse = {
    tier: 'free' as const,
    allowed: true,
    remaining: 95,
    limit: 100,
    resetAt: '2025-12-01T00:00:00Z',
    percentage: 95,
  };

  describe('Initial Load', () => {
    it('should fetch status on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useRateLimit());

      expect(result.current.loading).toBe(true);
      expect(result.current.status).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.status).toEqual(mockSuccessResponse);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/rate-limit/status',
        expect.objectContaining({
          credentials: 'include',
        }),
      );
    });

    it('should handle loading state correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useRateLimit());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.loading).toBe(false);
    });

    it('should use cached status if available', async () => {
      // First render - populate cache
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result: result1 } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });

      // Second render - should use cache
      (global.fetch as jest.Mock).mockClear();

      const { result: result2 } = renderHook(() => useRateLimit());

      // Should have cached data immediately
      expect(result2.current.status).toEqual(mockSuccessResponse);
      expect(result2.current.loading).toBe(false);

      // Should not make new request (within cache duration)
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.status).toBeNull();
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.status).toBeNull();
    });

    it('should handle JSON parsing errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const { result } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Invalid JSON');
    });
  });

  describe('Auto-refresh', () => {
    it('should auto-refresh every 30 seconds', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      renderHook(() => useRateLimit());

      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Advance timers by 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Advance another 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });
    });

    it('should not show loading on auto-refresh', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useRateLimit());

      // Initial load complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const wasLoading = result.current.loading;

      // Trigger auto-refresh
      jest.advanceTimersByTime(30000);

      // Loading should remain false during auto-refresh
      expect(result.current.loading).toBe(false);
      expect(wasLoading).toBe(false);
    });

    it('should cleanup interval on unmount', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { unmount } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Advance timers - should not fetch after unmount
      jest.advanceTimersByTime(60000);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate simultaneous requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      // Mount multiple hooks simultaneously
      const { result: result1 } = renderHook(() => useRateLimit());
      const { result: result2 } = renderHook(() => useRateLimit());
      const { result: result3 } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
        expect(result2.current.loading).toBe(false);
        expect(result3.current.loading).toBe(false);
      });

      // Should only make one request despite multiple hooks
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // All hooks should have the same data
      expect(result1.current.status).toEqual(mockSuccessResponse);
      expect(result2.current.status).toEqual(mockSuccessResponse);
      expect(result3.current.status).toEqual(mockSuccessResponse);
    });

    it('should use cache within 5 seconds', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result: result1 } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });

      // Advance time by 4 seconds (within cache duration)
      jest.advanceTimersByTime(4000);

      // Mount new hook - should use cache
      const { result: result2 } = renderHook(() => useRateLimit());

      expect(global.fetch).toHaveBeenCalledTimes(1); // No new request
      expect(result2.current.status).toEqual(mockSuccessResponse);
    });

    it('should make new request after cache expires', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result: result1 } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Advance time by 6 seconds (beyond cache duration)
      jest.advanceTimersByTime(6000);

      // Mount new hook - should make new request
      const { result: result2 } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Manual Refetch', () => {
    it('should refetch when refetch is called', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Call refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should bypass cache on manual refetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Immediately refetch (within cache duration)
      await result.current.refetch();

      // Should make new request despite cache
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should show loading during manual refetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Start manual refetch
      const refetchPromise = result.current.refetch();

      // Should show loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await refetchPromise;

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Response Data', () => {
    it('should return correct status structure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.status).toHaveProperty('tier');
      expect(result.current.status).toHaveProperty('allowed');
      expect(result.current.status).toHaveProperty('remaining');
      expect(result.current.status).toHaveProperty('limit');
      expect(result.current.status).toHaveProperty('resetAt');
      expect(result.current.status).toHaveProperty('percentage');
    });

    it('should handle different tier responses', async () => {
      const premiumResponse = {
        ...mockSuccessResponse,
        tier: 'premium' as const,
        limit: 1000,
        remaining: 500,
        percentage: 50,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => premiumResponse,
      });

      const { result } = renderHook(() => useRateLimit());

      await waitFor(() => {
        expect(result.current.status?.tier).toBe('premium');
        expect(result.current.status?.limit).toBe(1000);
      });
    });
  });
});
