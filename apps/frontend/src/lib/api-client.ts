/**
 * API Client with Rate Limit Error Handling
 *
 * Features:
 * - Intercepts 429 (Too Many Requests) responses
 * - Dispatches custom events for global error handling
 * - Extracts rate limit headers
 * - Provides structured error responses
 * - Type-safe error handling
 */

export interface RateLimitInfo {
  retryAfter: number; // seconds
  resetAt: string; // ISO date
  limit: number;
  remaining: number;
}

export class RateLimitError extends Error {
  retryAfter: number;
  resetAt: string;
  limit: number;
  remaining: number;
  data?: any; // Stale data if included in response

  constructor(info: RateLimitInfo & { data?: any }) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
    this.retryAfter = info.retryAfter;
    this.resetAt = info.resetAt;
    this.limit = info.limit;
    this.remaining = info.remaining;
    this.data = info.data;
  }
}

export interface ApiClientOptions extends RequestInit {
  skipRateLimitCheck?: boolean;
}

/**
 * Enhanced fetch wrapper with rate limit handling
 *
 * @param url - The URL to fetch
 * @param options - Fetch options with additional skipRateLimitCheck flag
 * @returns Response or throws RateLimitError
 */
export async function apiClient(url: string, options?: ApiClientOptions): Promise<Response> {
  const { skipRateLimitCheck, ...fetchOptions } = options || {};

  const response = await fetch(url, {
    credentials: 'include',
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  // Check for rate limit error (429)
  if (response.status === 429 && !skipRateLimitCheck) {
    // Extract rate limit info from headers
    const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
    const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0', 10);
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10);
    const resetAt = response.headers.get('X-RateLimit-Reset') || new Date().toISOString();

    let data;
    try {
      const json = await response.json();
      data = json.data; // Backend may include stale data
    } catch (e) {
      // No JSON data available
    }

    const rateLimitInfo: RateLimitInfo & { data?: any } = {
      retryAfter,
      resetAt,
      limit,
      remaining,
      data,
    };

    // Dispatch custom event for global handling
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('rate-limit-exceeded', {
          detail: rateLimitInfo,
        })
      );
    }

    throw new RateLimitError(rateLimitInfo);
  }

  return response;
}

/**
 * Helper to make GET requests with rate limit handling
 */
export async function apiGet<T>(url: string, options?: ApiClientOptions): Promise<T> {
  const response = await apiClient(url, {
    method: 'GET',
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API GET failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Helper to make POST requests with rate limit handling
 */
export async function apiPost<T>(url: string, body?: any, options?: ApiClientOptions): Promise<T> {
  const response = await apiClient(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API POST failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Helper to make PUT requests with rate limit handling
 */
export async function apiPut<T>(url: string, body?: any, options?: ApiClientOptions): Promise<T> {
  const response = await apiClient(url, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API PUT failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Helper to make DELETE requests with rate limit handling
 */
export async function apiDelete<T>(url: string, options?: ApiClientOptions): Promise<T> {
  const response = await apiClient(url, {
    method: 'DELETE',
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API DELETE failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Global rate limit event listener setup
 * Call this once in your app initialization (e.g., in layout or _app)
 */
export function setupRateLimitListener(
  onRateLimitExceeded?: (info: RateLimitInfo & { data?: any }) => void
) {
  if (typeof window === 'undefined') return;

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<RateLimitInfo & { data?: any }>;
    if (onRateLimitExceeded) {
      onRateLimitExceeded(customEvent.detail);
    }
  };

  window.addEventListener('rate-limit-exceeded', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('rate-limit-exceeded', handler);
  };
}
