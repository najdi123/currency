import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { config } from '@/lib/config'

// TypeScript interfaces for admin API
// Note: These must match backend enum values exactly
export type ItemCategory = 'currencies' | 'crypto' | 'gold'
export type ItemSource = 'api' | 'manual'
export type ItemVariant = 'sell' | 'buy'
export type ItemRegion = 'turkey' | 'dubai' | 'herat'

export interface ManagedItem {
  _id: string
  code: string
  ohlcCode: string
  parentCode?: string
  name: string // English name
  nameFa?: string // Farsi name
  nameAr?: string // Arabic name
  variant: ItemVariant
  region?: ItemRegion
  category: ItemCategory
  icon?: string
  displayOrder: number
  isActive: boolean
  source: ItemSource
  hasApiData: boolean
  isOverridden: boolean
  overridePrice?: number
  overrideChange?: number
  overrideBy?: string
  overrideAt?: string
  overrideDuration?: number
  overrideExpiresAt?: string
  lastApiUpdate?: string
  createdAt: string
  updatedAt: string
  // Current price data from ohlc_permanent
  currentPrice?: number
  currentChange?: number
  priceTimestamp?: string
}

export interface ManagedItemsResponse {
  items: ManagedItem[]
  total: number
}

export interface CreateManagedItemRequest {
  code: string
  ohlcCode?: string
  parentCode?: string
  name: string // English name
  nameFa?: string // Farsi name
  nameAr?: string // Arabic name
  variant?: ItemVariant
  region?: ItemRegion
  category: ItemCategory
  icon?: string
  displayOrder?: number
  isActive?: boolean
  source?: ItemSource
  overridePrice?: number
}

export interface UpdateManagedItemRequest {
  name?: string
  nameFa?: string
  nameAr?: string
  parentCode?: string
  icon?: string
  displayOrder?: number
  isActive?: boolean
}

export interface SetOverrideRequest {
  price: number
  change?: number
  duration?: number
  isIndefinite?: boolean
}

export interface GroupedItem {
  parent: ManagedItem
  variants: ManagedItem[]
}

export interface DiagnoseResponse {
  itemCode: string
  ohlcPermanent: {
    exists: boolean
    latestTimestamp?: string
    sampleData?: {
      open: number
      high: number
      low: number
      close: number
    }
  }
  managedItem: {
    exists: boolean
    data?: ManagedItem
  }
  priceSnapshots: {
    count: number
    latestTimestamp?: string
  }
}

// Base query with auth token injection
const baseQuery = fetchBaseQuery({
  baseUrl: config.apiUrl,
  timeout: 30000,
  credentials: 'omit',
  prepareHeaders: (headers) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    if (!headers.has('accept')) headers.set('accept', 'application/json')
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    return headers
  },
  fetchFn: (input, init) => {
    const initWithNext: RequestInit & { next?: { revalidate?: number } } = {
      ...init,
      cache: 'no-store',
      next: { revalidate: 0 },
    }
    return fetch(input as RequestInfo, initWithNext)
  },
})

// Base query with automatic token refresh
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions)

  // If we get a 401 error, try to refresh the token
  if (result.error && result.error.status === 401) {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null

    if (refreshToken) {
      // Try to refresh the token
      const refreshResult = await baseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      )

      if (refreshResult.data) {
        const { accessToken, refreshToken: newRefreshToken } = refreshResult.data as any

        // Store new tokens
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)
        }

        // Retry the original request with new token
        result = await baseQuery(args, api, extraOptions)
      } else {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          window.location.href = '/login'
        }
      }
    }
  }

  return result
}

// Add retry logic
const baseQueryWithRetry = retry(
  async (args: string | FetchArgs, api, extraOptions) => {
    const result = await baseQueryWithReauth(args, api, extraOptions)

    // Don't retry on client errors (4xx)
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

// Create the admin API
export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['ManagedItems', 'ManagedItem'],
  refetchOnFocus: false,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: false,
  keepUnusedDataFor: 300, // 5 minutes
  endpoints: (builder) => ({
    // Get all managed items
    getManagedItems: builder.query<ManagedItemsResponse, { category?: ItemCategory; activeOnly?: boolean } | void>({
      query: (params) => ({
        url: '/admin/items',
        params: params ? {
          ...(params.category && { category: params.category }),
          ...(params.activeOnly !== undefined && { activeOnly: params.activeOnly }),
        } : undefined,
      }),
      providesTags: ['ManagedItems'],
    }),

    // Get single managed item by code
    getManagedItem: builder.query<ManagedItem, string>({
      query: (code) => `/admin/items/${code}`,
      providesTags: (_result, _error, code) => [{ type: 'ManagedItem', id: code }],
    }),

    // Get items grouped by parent
    getItemsByParent: builder.query<GroupedItem, string>({
      query: (parentCode) => `/admin/items/group/${parentCode}`,
      providesTags: (_result, _error, parentCode) => [{ type: 'ManagedItem', id: `group-${parentCode}` }],
    }),

    // Create new managed item
    createManagedItem: builder.mutation<ManagedItem, CreateManagedItemRequest>({
      query: (body) => ({
        url: '/admin/items',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ManagedItems'],
    }),

    // Update managed item
    updateManagedItem: builder.mutation<ManagedItem, { code: string } & UpdateManagedItemRequest>({
      query: ({ code, ...body }) => ({
        url: `/admin/items/${code}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { code }) => [
        'ManagedItems',
        { type: 'ManagedItem', id: code },
      ],
    }),

    // Delete managed item
    deleteManagedItem: builder.mutation<void, string>({
      query: (code) => ({
        url: `/admin/items/${code}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ManagedItems'],
    }),

    // Set price override
    setOverride: builder.mutation<ManagedItem, { code: string } & SetOverrideRequest>({
      query: ({ code, ...body }) => ({
        url: `/admin/items/${code}/override`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { code }) => [
        'ManagedItems',
        { type: 'ManagedItem', id: code },
      ],
    }),

    // Clear price override
    clearOverride: builder.mutation<ManagedItem, string>({
      query: (code) => ({
        url: `/admin/items/${code}/override`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, code) => [
        'ManagedItems',
        { type: 'ManagedItem', id: code },
      ],
    }),

    // Diagnose data for an item
    diagnoseItem: builder.query<DiagnoseResponse, string>({
      query: (itemCode) => `/admin/data/diagnose/${itemCode}`,
    }),
  }),
})

// Export hooks for usage in components
export const {
  useGetManagedItemsQuery,
  useGetManagedItemQuery,
  useGetItemsByParentQuery,
  useCreateManagedItemMutation,
  useUpdateManagedItemMutation,
  useDeleteManagedItemMutation,
  useSetOverrideMutation,
  useClearOverrideMutation,
  useDiagnoseItemQuery,
} = adminApi

export default adminApi
