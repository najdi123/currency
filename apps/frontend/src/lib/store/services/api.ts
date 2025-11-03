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
import type { ChartResponse, ChartQueryParams, HistoricalPriceResponse } from '@/types/chart'

// TypeScript interfaces for API responses
export interface RateItem {
  value: number
  change: number
  timestamp: number
  date: string
}

export interface ApiResponseMetadata {
  isFresh: boolean
  isStale: boolean
  dataAge?: number // Age in minutes
  lastUpdated: Date | string
  source: 'cache' | 'api' | 'fallback'
  warning?: string
}

export interface ApiResponse<T> {
  data: T
  metadata: ApiResponseMetadata
}

export type CurrenciesResponse = Record<string, RateItem> & {
  _metadata?: ApiResponseMetadata
}

export type CryptoResponse = Record<string, RateItem> & {
  _metadata?: ApiResponseMetadata
}

export type GoldResponse = Record<string, RateItem> & {
  _metadata?: ApiResponseMetadata
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
// Reduced retries to prevent error loops when rate-limited
const baseQueryWithRetry = retry(
  async (args: string | FetchArgs, api, extraOptions) => {
    const result = await baseQueryWithInterceptor(args, api, extraOptions)

    // Don't retry on any client errors (4xx) including 429 (rate limit)
    // This prevents retry loops when API quota is exhausted
    if (result.error) {
      const status = result.error.status
      if (typeof status === 'number' && status >= 400 && status < 500) {
        retry.fail(result.error)
      }
    }

    return result
  },
  {
    maxRetries: 1, // Reduced from 3 to prevent excessive retries when rate-limited
  }
)

// Create the API
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Rates', 'ChartData', 'History'],
  // Configure RTK Query behavior for stale data handling
  // Disable refetch on focus to prevent excessive API calls when rate-limited
  refetchOnFocus: false, // Don't refetch when window gains focus (prevents 429 errors)
  refetchOnReconnect: true, // Refetch when network reconnects
  refetchOnMountOrArgChange: false, // Don't auto-refetch, rely on manual refresh
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
    getCurrencies: builder.query<CurrenciesResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/currencies',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        // Backend sends: { ...currencyData, _metadata: {...} }
        // Just return as-is, _metadata is already at root level
        console.log('[RTK Query] Currencies response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Metadata:', response._metadata)
        }
        return response as CurrenciesResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCrypto: builder.query<CryptoResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/crypto',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        // Backend sends: { ...cryptoData, _metadata: {...} }
        // Just return as-is, _metadata is already at root level
        console.log('[RTK Query] Crypto response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Metadata:', response._metadata)
        }
        return response as CryptoResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getGold: builder.query<GoldResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/gold',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        // Backend sends: { ...goldData, _metadata: {...} }
        // Just return as-is, _metadata is already at root level
        console.log('[RTK Query] Gold response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Metadata:', response._metadata)
        }
        return response as GoldResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getChartData: builder.query<ChartResponse, ChartQueryParams>({
      query: ({ itemCode, timeRange, itemType }) => ({
        url: `/chart/${itemCode}`,
        params: { timeRange, itemType },
      }),
      providesTags: (_result, _error, arg) => [
        { type: 'ChartData' as const, id: `${arg.itemCode}-${arg.timeRange}-${arg.itemType}` }
      ],
      keepUnusedDataFor: 600,
    }),
    // Historical data endpoints for sparklines (7-day data)
    getCurrencyHistory: builder.query<HistoricalPriceResponse, { code: string }>({
      query: ({ code }) => `/currencies/code/${code}/history?days=7`,
      providesTags: (result, error, { code }) => [
        { type: 'History' as const, id: `currency-${code}` }
      ],
      keepUnusedDataFor: 1200, // 20 minutes cache
    }),
    getDigitalCurrencyHistory: builder.query<HistoricalPriceResponse, { symbol: string }>({
      query: ({ symbol }) => `/digital-currencies/symbol/${symbol}/history?days=7`,
      providesTags: (result, error, { symbol }) => [
        { type: 'History' as const, id: `crypto-${symbol}` }
      ],
      keepUnusedDataFor: 1200,
    }),
    getGoldHistory: builder.query<HistoricalPriceResponse, { code: string }>({
      query: ({ code }) => `/gold/code/${code}/history?days=7`,
      providesTags: (result, error, { code }) => [
        { type: 'History' as const, id: `gold-${code}` }
      ],
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
  useGetChartDataQuery,
  useGetCurrencyHistoryQuery,
  useGetDigitalCurrencyHistoryQuery,
  useGetGoldHistoryQuery,
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
