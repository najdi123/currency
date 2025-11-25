import { useEffect, useState, useCallback, useRef } from 'react';
import { apiUrl } from '@/lib/config';

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  windowStart: string;
  windowEnd: string;
  showStaleData: boolean;
  percentage: number;
  maxRequestsPerWindow: number;
  windowDurationHours: number;
}

interface UseRateLimitReturn {
  status: RateLimitStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Global cache for request deduplication
let cachedStatus: RateLimitStatus | null = null;
let cacheTimestamp = 0;
let ongoingRequest: Promise<RateLimitStatus | null> | null = null;
const CACHE_DURATION = 5000; // 5 seconds cache to prevent duplicate requests

/**
 * Hook to fetch and monitor rate limit status (2-hour window system)
 *
 * Features:
 * - Fetches current rate limit status from backend
 * - Displays quota within current 2-hour window (20 requests per window)
 * - Auto-refreshes every 30 seconds
 * - Provides loading and error states
 * - Exposes refetch function for manual updates
 * - Deduplicates requests across multiple component instances
 * - Only shows loading spinner on initial fetch, not on auto-refresh
 */
export function useRateLimit(): UseRateLimitReturn {
  const [status, setStatus] = useState<RateLimitStatus | null>(cachedStatus);
  const [loading, setLoading] = useState(!cachedStatus); // Only load if no cache
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(!cachedStatus);

  const fetchStatus = useCallback(async (isManualRefetch = false) => {
    try {
      // Only show loading spinner on initial load or manual refetch
      if (isInitialLoad.current || isManualRefetch) {
        setLoading(true);
      }
      setError(null);

      // Check cache first (prevent duplicate requests within 5 seconds)
      const now = Date.now();
      if (cachedStatus && now - cacheTimestamp < CACHE_DURATION && !isManualRefetch) {
        setStatus(cachedStatus);
        setLoading(false);
        return;
      }

      // If there's an ongoing request, wait for it instead of creating a new one
      if (ongoingRequest && !isManualRefetch) {
        const data = await ongoingRequest;
        if (data) {
          setStatus(data);
        }
        setLoading(false);
        return;
      }

      // Create new request
      ongoingRequest = (async () => {
        const response = await fetch(`${apiUrl}/rate-limit/status`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch rate limit status');
        }

        const data = await response.json();

        // Update global cache
        cachedStatus = data;
        cacheTimestamp = Date.now();

        return data;
      })();

      const data = await ongoingRequest;
      setStatus(data);
      isInitialLoad.current = false;
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      console.error('Rate limit status fetch error:', err);
    } finally {
      setLoading(false);
      ongoingRequest = null;
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Auto-refresh every 30 seconds (will use cache if within 5 seconds)
    const interval = setInterval(() => fetchStatus(), 30000);

    return () => clearInterval(interval);
  }, []); // Empty deps - fetchStatus is stable with useCallback

  return {
    status,
    loading,
    error,
    refetch: () => fetchStatus(true), // Manual refetch bypasses cache
  };
}
