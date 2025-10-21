import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { config } from '@/lib/config'
import {
  getErrorMessage,
  getErrorCode,
  formatError,
  isFetchBaseQueryError,
  isHttpError,
  isNetworkError,
  isConnectionError,
  isServerError,
  isClientError,
  type RtkQueryError,
} from '@/types/errors'
import { logApiError, addBreadcrumb, logPerformance } from '@/lib/errorLogger'

// TypeScript interfaces for API responses
export interface RateItem {
  value: string
  change: number
  timestamp: number
  date: string
}

export interface CurrenciesResponse {
  [key: string]: RateItem
}

export interface CryptoResponse {
  [key: string]: RateItem
}

export interface GoldResponse {
  [key: string]: RateItem
}

export interface LatestRatesResponse {
  [key: string]: RateItem
}

// Note: Error message mapping is now handled by @/types/errors module
// This provides type-safe error handling with proper type guards

// Request ID generator for tracing
let requestIdCounter = 0
const generateRequestId = (): string => {
  requestIdCounter += 1
  return `req_${Date.now()}_${requestIdCounter}`
}

// Validate API URL is configured (defensive check)
if (!config.apiUrl) {
  throw new Error(
    '❌ API URL is not configured.\n\n' +
    'Please ensure NEXT_PUBLIC_API_URL is set in your .env.local file.\n' +
    'Example: NEXT_PUBLIC_API_URL=http://localhost:4000/api'
  )
}

// Base query with timeout
const baseQuery = fetchBaseQuery({
  baseUrl: config.apiUrl,
  timeout: 30000, // 30 seconds timeout
})

// Custom base query with error interceptor and logging
const baseQueryWithInterceptor: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const requestId = generateRequestId()
  const startTime = Date.now()
  const endpoint = typeof args === 'string' ? args : args.url
  const method = typeof args === 'string' ? 'GET' : args.method || 'GET'

  // Add breadcrumb for API request
  addBreadcrumb({
    category: 'http',
    message: `API Request: ${method} ${endpoint}`,
    level: 'info',
    data: {
      endpoint,
      method,
      requestId,
    },
  })

  // Log request in development
  if (config.isDevelopment) {
    console.log(`🔵 [${requestId}] API Request:`, {
      endpoint,
      method,
      timestamp: new Date().toISOString(),
    })
  }

  // Execute the request
  const result = await baseQuery(args, api, extraOptions)
  const duration = Date.now() - startTime

  // Log response in development
  if (config.isDevelopment) {
    if (result.error) {
      console.error(`🔴 [${requestId}] API Error (${duration}ms):`, {
        endpoint,
        status: result.error.status,
        error: result.error,
        message: getErrorMessage(result.error),
        code: getErrorCode(result.error),
      })
    } else {
      console.log(`🟢 [${requestId}] API Success (${duration}ms):`, {
        endpoint,
        dataKeys: result.data ? Object.keys(result.data as object) : [],
      })
    }
  }

  // Handle errors
  if (result.error) {
    // Add error breadcrumb
    addBreadcrumb({
      category: 'http',
      message: `API Error: ${method} ${endpoint} - ${result.error.status}`,
      level: 'error',
      data: {
        endpoint,
        method,
        status: result.error.status,
        duration,
        requestId,
      },
    })

    // Log to error monitoring service
    logApiError(
      new Error(`API Error: ${getErrorMessage(result.error)}`),
      endpoint,
      method,
      typeof args === 'object' && 'body' in args ? args.body : undefined,
      duration
    )
  } else {
    // Log performance for slow requests (> 2 seconds)
    if (duration > 2000) {
      logPerformance(`API Request: ${method} ${endpoint}`, duration, {
        tags: {
          endpoint,
          method,
        },
      })
    }
  }

  return result
}

// Add retry logic with exponential backoff
const baseQueryWithRetry = retry(
  async (args: string | FetchArgs, api, extraOptions) => {
    const result = await baseQueryWithInterceptor(args, api, extraOptions)

    // Don't retry on client errors (4xx) except 429 (rate limit)
    if (result.error) {
      const status = result.error.status
      if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
        retry.fail(result.error)
      }
    }

    return result
  },
  {
    maxRetries: 3,
  }
)

// Create the API
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Rates'],
  // Configure RTK Query behavior for stale data handling
  refetchOnFocus: true, // Refetch when window gains focus
  refetchOnReconnect: true, // Refetch when network reconnects
  refetchOnMountOrArgChange: 60, // Refetch if data is older than 60 seconds
  // Keep unused data for 20 minutes - allows showing stale data when refetch fails
  keepUnusedDataFor: 1200, // 20 minutes in seconds
  endpoints: (builder) => ({
    getLatestRates: builder.query<LatestRatesResponse, void>({
      query: () => '/navasan/latest',
      providesTags: ['Rates'],
      // Keep cached data for 20 minutes even if unused
      // This allows showing stale data when network fails
      keepUnusedDataFor: 1200, // 20 minutes in seconds
    }),
    getCurrencies: builder.query<CurrenciesResponse, void>({
      query: () => '/navasan/currencies',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200,
    }),
    getCrypto: builder.query<CryptoResponse, void>({
      query: () => '/navasan/crypto',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200,
    }),
    getGold: builder.query<GoldResponse, void>({
      query: () => '/navasan/gold',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200,
    }),
  }),
})

// Export hooks for usage in components
export const {
  useGetLatestRatesQuery,
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
} = api

// Re-export typed error utilities for component use
// These provide type-safe error handling with proper type guards
export {
  getErrorMessage as getApiErrorMessage,
  getErrorCode,
  formatError,
  isFetchBaseQueryError,
  isHttpError,
  isNetworkError,
  isConnectionError,
  isServerError,
  isClientError,
  isUnauthorizedError,
  isForbiddenError,
  isNotFoundError,
  isRateLimitError,
  isParsingError,
  isTimeoutError,
} from '@/types/errors'

export type { RtkQueryError } from '@/types/errors'

export default api
