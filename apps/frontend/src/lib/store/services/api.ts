import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { config } from '@/lib/config'
import {
  getErrorMessage,
  getErrorCode,
  isFetchBaseQueryError,
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
  source: 'cache' | 'api' | 'fallback' | 'snapshot'
  warning?: string
  isHistorical?: boolean // True when data is from historical queries
  historicalDate?: Date | string // Date for historical data queries
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

// Base query with timeout + headers + no-cache + (optional) auth/cookies
const baseQuery = fetchBaseQuery({
  baseUrl: config.apiUrl,
  timeout: 30000, // 30s
  // If you use cookie-based auth to your API, switch to 'include'
  credentials: 'omit', // 'include' | 'same-origin' | 'omit'
  prepareHeaders: (headers, { type }) => {
    // Accept JSON by default
    if (!headers.has('accept')) headers.set('accept', 'application/json')
    // Only set content-type when we're actually sending a JSON body
    if (type === 'mutation' && !headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    return headers
  },
  // Disable Next.js caching globally for these requests
  fetchFn: (input, init) => {
    const initWithNext: RequestInit & { next?: { revalidate?: number } } = {
      ...init,
      cache: 'no-store',
      next: { revalidate: 0 },
    }
    return fetch(input as RequestInfo, initWithNext)
  },
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

    logApiError(
      new Error(`API Error: ${getErrorMessage(result.error)}`),
      endpoint,
      method,
      typeof args === 'object' && 'body' in args ? (args as FetchArgs).body : undefined,
      duration
    )
  } else {
    // Log performance for slow requests (> 2 seconds)
    if (duration > 2000) {
      logPerformance(`API Request: ${method} ${endpoint}`, duration, {
        tags: { endpoint, method },
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
    if (result.error) {
      const status = result.error.status
      if (typeof status === 'number' && status >= 400 && status < 500) {
        retry.fail(result.error)
      }
    }

    return result
  },
  { maxRetries: 1 }
)

// Create the API
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Rates', 'ChartData', 'History', 'Currencies', 'DigitalCurrencies', 'Gold'],
  // Stale-data handling
  refetchOnFocus: false,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: false,
  keepUnusedDataFor: 1200, // 20 minutes
  endpoints: (builder) => ({
    getLatestRates: builder.query<LatestRatesResponse, void>({
      query: () => '/navasan/latest',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200,
    }),
    getCurrencies: builder.query<CurrenciesResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/currencies',
      providesTags: ['Rates', 'Currencies'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Currencies response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Metadata:', response._metadata)
        }
        return response as CurrenciesResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCrypto: builder.query<CryptoResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/crypto',
      providesTags: ['Rates', 'DigitalCurrencies'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Crypto response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Metadata:', response._metadata)
        }
        return response as CryptoResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getGold: builder.query<GoldResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/gold',
      providesTags: ['Rates', 'Gold'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Gold response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Metadata:', response._metadata)
        }
        return response as GoldResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    // Yesterday's data endpoints
    getCurrenciesYesterday: builder.query<CurrenciesResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/currencies/yesterday',
      providesTags: ['Rates', 'Currencies'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Currencies Yesterday response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Yesterday Metadata:', response._metadata)
        }
        return response as CurrenciesResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCryptoYesterday: builder.query<CryptoResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/crypto/yesterday',
      providesTags: ['Rates', 'DigitalCurrencies'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Crypto Yesterday response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Yesterday Metadata:', response._metadata)
        }
        return response as CryptoResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getGoldYesterday: builder.query<GoldResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/navasan/gold/yesterday',
      providesTags: ['Rates', 'Gold'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Gold Yesterday response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Yesterday Metadata:', response._metadata)
        }
        return response as GoldResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    // Historical data endpoints with date parameter (90 days back)
    getCurrenciesHistorical: builder.query<CurrenciesResponse & { _metadata?: ApiResponseMetadata }, string>({
      query: (date) => `/navasan/currencies/historical?date=${date}`,
      providesTags: (_result, _error, date) => [
        { type: 'Currencies' as const, id: `historical-${date}` },
        'Rates'
      ],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Currencies Historical response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Historical Metadata:', response._metadata)
        }
        return response as CurrenciesResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCryptoHistorical: builder.query<CryptoResponse & { _metadata?: ApiResponseMetadata }, string>({
      query: (date) => `/navasan/crypto/historical?date=${date}`,
      providesTags: (_result, _error, date) => [
        { type: 'DigitalCurrencies' as const, id: `historical-${date}` },
        'Rates'
      ],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Crypto Historical response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Historical Metadata:', response._metadata)
        }
        return response as CryptoResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getGoldHistorical: builder.query<GoldResponse & { _metadata?: ApiResponseMetadata }, string>({
      query: (date) => `/navasan/gold/historical?date=${date}`,
      providesTags: (_result, _error, date) => [
        { type: 'Gold' as const, id: `historical-${date}` },
        'Rates'
      ],
      keepUnusedDataFor: 1200,
      transformResponse: (response: any) => {
        console.log('[RTK Query] Gold Historical response has _metadata:', '_metadata' in response)
        if ('_metadata' in response) {
          console.log('[RTK Query] Historical Metadata:', response._metadata)
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
        { type: 'ChartData' as const, id: `${arg.itemCode}-${arg.timeRange}-${arg.itemType}` },
      ],
      keepUnusedDataFor: 600,
    }),
    // Historical data endpoints for sparklines (7-day data)
    getCurrencyHistory: builder.query<HistoricalPriceResponse, { code: string }>({
      query: ({ code }) => `/currencies/code/${code}/history?days=7`,
      providesTags: (_result, _error, { code }) => [{ type: 'History' as const, id: `currency-${code}` }],
      keepUnusedDataFor: 1200,
    }),
    getDigitalCurrencyHistory: builder.query<HistoricalPriceResponse, { symbol: string }>({
      query: ({ symbol }) => `/digital-currencies/symbol/${symbol}/history?days=7`,
      providesTags: (_result, _error, { symbol }) => [{ type: 'History' as const, id: `crypto-${symbol}` }],
      keepUnusedDataFor: 1200,
    }),
    getGoldHistory: builder.query<HistoricalPriceResponse, { code: string }>({
      query: ({ code }) => `/gold/code/${code}/history?days=7`,
      providesTags: (_result, _error, { code }) => [{ type: 'History' as const, id: `gold-${code}` }],
      keepUnusedDataFor: 1200,
    }),
    // Manual refresh mutations - force fresh data fetch
    refreshCurrencyData: builder.mutation<void, void>({
      query: () => ({
        url: '/navasan/currencies',
        method: 'GET',
        // Force bypass cache by adding timestamp
        params: { _t: Date.now() }
      }),
      invalidatesTags: ['Currencies', 'Rates'],
    }),
    refreshCryptoData: builder.mutation<void, void>({
      query: () => ({
        url: '/navasan/crypto',
        method: 'GET',
        params: { _t: Date.now() }
      }),
      invalidatesTags: ['DigitalCurrencies', 'Rates'],
    }),
    refreshGoldData: builder.mutation<void, void>({
      query: () => ({
        url: '/navasan/gold',
        method: 'GET',
        params: { _t: Date.now() }
      }),
      invalidatesTags: ['Gold', 'Rates'],
    }),
  }),
})

// Export hooks for usage in components
export const {
  useGetLatestRatesQuery,
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
  useGetCurrenciesYesterdayQuery,
  useGetCryptoYesterdayQuery,
  useGetGoldYesterdayQuery,
  useGetCurrenciesHistoricalQuery,
  useGetCryptoHistoricalQuery,
  useGetGoldHistoricalQuery,
  useGetChartDataQuery,
  useGetCurrencyHistoryQuery,
  useGetDigitalCurrencyHistoryQuery,
  useGetGoldHistoryQuery,
  useRefreshCurrencyDataMutation,
  useRefreshCryptoDataMutation,
  useRefreshGoldDataMutation,
} = api

// Re-export typed error utilities for component use
export {
  getErrorMessage as getApiErrorMessage,
  getErrorCode,
  isFetchBaseQueryError,
  isServerError,
  isClientError,
} from '@/types/errors'

export type { RtkQueryError } from '@/types/errors'

export default api
