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

export interface ApiRawResponse {
  _metadata?: ApiResponseMetadata
  [key: string]: any
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

export type CoinsResponse = Record<string, RateItem> & {
  _metadata?: ApiResponseMetadata
}

export interface OhlcDataPoint {
  time: string // "08:00", "08:10"
  price: number
}

export interface OhlcResponse {
  itemCode: string
  date: string
  dateJalali: string
  open: number
  high: number
  low: number
  close: number
  change: number // Daily change percentage
  absoluteChange?: number // Absolute change in Toman (close - open) / 10
  dataPoints: OhlcDataPoint[]
  updateCount: number
  firstUpdate: string
  lastUpdate: string
}

export interface AllOhlcResponse {
  count: number
  data: OhlcResponse[]
}

// Regional variant response types
export interface RegionalVariant {
  code: string
  price: number
  change: number
  region?: string
  variant?: string
  name: string
  nameFa?: string
  nameAr?: string
}

export interface RegionalVariantsResponse {
  parentCode: string
  count: number
  variants: RegionalVariant[]
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
  tagTypes: ['Rates', 'ChartData', 'History', 'Currencies', 'DigitalCurrencies', 'Gold', 'Coins', 'Ohlc'],
  // Stale-data handling
  refetchOnFocus: false,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: false,
  keepUnusedDataFor: 1200, // 20 minutes
  endpoints: (builder) => ({
    getLatestRates: builder.query<LatestRatesResponse, void>({
      query: () => '/market-data/latest',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200,
    }),
    getCurrencies: builder.query<CurrenciesResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/market-data/currencies',
      providesTags: ['Rates', 'Currencies'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Currencies response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Metadata:', response._metadata)
          }
        }
        return response as CurrenciesResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCrypto: builder.query<CryptoResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/market-data/crypto',
      providesTags: ['Rates', 'DigitalCurrencies'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Crypto response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Metadata:', response._metadata)
          }
        }
        return response as CryptoResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getGold: builder.query<GoldResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/market-data/gold',
      providesTags: ['Rates', 'Gold'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Gold response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Metadata:', response._metadata)
          }
        }
        return response as GoldResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCoins: builder.query<CoinsResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/market-data/coins',
      providesTags: ['Rates', 'Coins'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Coins response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Metadata:', response._metadata)
          }
        }
        return response as CoinsResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    // Yesterday's data endpoints
    getCurrenciesYesterday: builder.query<CurrenciesResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/market-data/currencies/yesterday',
      providesTags: ['Rates', 'Currencies'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Currencies Yesterday response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Yesterday Metadata:', response._metadata)
          }
        }
        return response as CurrenciesResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCryptoYesterday: builder.query<CryptoResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/market-data/crypto/yesterday',
      providesTags: ['Rates', 'DigitalCurrencies'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Crypto Yesterday response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Yesterday Metadata:', response._metadata)
          }
        }
        return response as CryptoResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getGoldYesterday: builder.query<GoldResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/market-data/gold/yesterday',
      providesTags: ['Rates', 'Gold'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Gold Yesterday response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Yesterday Metadata:', response._metadata)
          }
        }
        return response as GoldResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCoinsYesterday: builder.query<CoinsResponse & { _metadata?: ApiResponseMetadata }, void>({
      query: () => '/market-data/coins/yesterday',
      providesTags: ['Rates', 'Coins'],
      keepUnusedDataFor: 1200,
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Coins Yesterday response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Yesterday Metadata:', response._metadata)
          }
        }
        return response as CoinsResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    // Historical data endpoints with date parameter (90 days back)
    // Historical data doesn't change, so cache for much longer (24 hours = 86400s)
    getCurrenciesHistorical: builder.query<CurrenciesResponse & { _metadata?: ApiResponseMetadata }, string>({
      query: (date) => `/market-data/currencies/historical?date=${date}`,
      providesTags: (_result, _error, date) => [
        { type: 'Currencies' as const, id: `historical-${date}` }
      ],
      keepUnusedDataFor: 86400, // 24 hours - historical data doesn't change
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Currencies Historical response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Historical Metadata:', response._metadata)
          }
        }
        return response as CurrenciesResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCryptoHistorical: builder.query<CryptoResponse & { _metadata?: ApiResponseMetadata }, string>({
      query: (date) => `/market-data/crypto/historical?date=${date}`,
      providesTags: (_result, _error, date) => [
        { type: 'DigitalCurrencies' as const, id: `historical-${date}` }
      ],
      keepUnusedDataFor: 86400, // 24 hours - historical data doesn't change
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Crypto Historical response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Historical Metadata:', response._metadata)
          }
        }
        return response as CryptoResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getGoldHistorical: builder.query<GoldResponse & { _metadata?: ApiResponseMetadata }, string>({
      query: (date) => `/market-data/gold/historical?date=${date}`,
      providesTags: (_result, _error, date) => [
        { type: 'Gold' as const, id: `historical-${date}` }
      ],
      keepUnusedDataFor: 86400, // 24 hours - historical data doesn't change
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Gold Historical response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Historical Metadata:', response._metadata)
          }
        }
        return response as GoldResponse & { _metadata?: ApiResponseMetadata }
      },
    }),
    getCoinsHistorical: builder.query<CoinsResponse & { _metadata?: ApiResponseMetadata }, string>({
      query: (date) => `/market-data/coins/historical?date=${date}`,
      providesTags: (_result, _error, date) => [
        { type: 'Coins' as const, id: `historical-${date}` }
      ],
      keepUnusedDataFor: 86400, // 24 hours - historical data doesn't change
      transformResponse: (response: ApiRawResponse) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[RTK Query] Coins Historical response has _metadata:', '_metadata' in response)
          if ('_metadata' in response) {
            console.log('[RTK Query] Historical Metadata:', response._metadata)
          }
        }
        return response as CoinsResponse & { _metadata?: ApiResponseMetadata }
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
        url: '/market-data/currencies',
        method: 'GET',
        // Force bypass cache by adding timestamp
        params: { _t: Date.now() }
      }),
      invalidatesTags: ['Currencies', 'Rates'],
    }),
    refreshCryptoData: builder.mutation<void, void>({
      query: () => ({
        url: '/market-data/crypto',
        method: 'GET',
        params: { _t: Date.now() }
      }),
      invalidatesTags: ['DigitalCurrencies', 'Rates'],
    }),
    refreshGoldData: builder.mutation<void, void>({
      query: () => ({
        url: '/market-data/gold',
        method: 'GET',
        params: { _t: Date.now() }
      }),
      invalidatesTags: ['Gold', 'Rates'],
    }),
    refreshCoinsData: builder.mutation<void, void>({
      query: () => ({
        url: '/market-data/coins',
        method: 'GET',
        params: { _t: Date.now() }
      }),
      invalidatesTags: ['Coins', 'Rates'],
    }),
    // Get today's OHLC for specific item
    getTodayOhlc: builder.query<OhlcResponse, string>({
      query: (itemCode) => `/market-data/ohlc/today/${itemCode}`,
      providesTags: (result, error, itemCode) => [{ type: 'Ohlc', id: itemCode }],
      keepUnusedDataFor: 600, // 10 minutes - intraday data changes frequently
    }),
    // Get today's OHLC for all items
    getAllTodayOhlc: builder.query<AllOhlcResponse, void>({
      query: () => '/market-data/ohlc/all',
      providesTags: ['Ohlc'],
      keepUnusedDataFor: 600, // 10 minutes - intraday data changes frequently
    }),
    // Get regional variants for a parent currency (e.g., usd -> usd_dubai, usd_turkey)
    getRegionalVariants: builder.query<RegionalVariantsResponse, string>({
      query: (parentCode) => `/market-data/variants/${parentCode}`,
      keepUnusedDataFor: 300, // 5 minutes - admin may add new variants
    }),
  }),
})

// Export hooks for usage in components
export const {
  useGetLatestRatesQuery,
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
  useGetCoinsQuery,
  useGetCurrenciesYesterdayQuery,
  useGetCryptoYesterdayQuery,
  useGetGoldYesterdayQuery,
  useGetCoinsYesterdayQuery,
  useGetCurrenciesHistoricalQuery,
  useGetCryptoHistoricalQuery,
  useGetGoldHistoricalQuery,
  useGetCoinsHistoricalQuery,
  useGetChartDataQuery,
  useGetCurrencyHistoryQuery,
  useGetDigitalCurrencyHistoryQuery,
  useGetGoldHistoryQuery,
  useRefreshCurrencyDataMutation,
  useRefreshCryptoDataMutation,
  useRefreshGoldDataMutation,
  useRefreshCoinsDataMutation,
  useGetTodayOhlcQuery,
  useGetAllTodayOhlcQuery,
  useGetRegionalVariantsQuery,
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
