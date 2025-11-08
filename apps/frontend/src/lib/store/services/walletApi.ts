import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { config } from '@/lib/config'

// TypeScript interfaces for wallet API
export type CurrencyType = 'fiat' | 'crypto' | 'gold'
export type TransactionDirection = 'credit' | 'debit'
export type TransactionReason = 'deposit' | 'withdrawal' | 'transfer' | 'adjustment'

export interface WalletBalance {
  id: string
  userId: string
  currencyType: CurrencyType
  currencyCode: string
  amount: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  currencyType: CurrencyType
  currencyCode: string
  direction: TransactionDirection
  amount: string
  reason: TransactionReason
  balanceAfter: string
  processedBy?: string
  requestId?: string
  idempotencyKey?: string
  meta?: {
    adminId?: string
    adminEmail?: string
  }
  createdAt: string
}

export interface WalletResponse {
  userId: string
  balances: WalletBalance[]
}

export interface TransactionsResponse {
  transactions: Transaction[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface AllWalletsResponse {
  wallets: Array<{
    userId: string
    email?: string
    balances: WalletBalance[]
  }>
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface GetTransactionsParams {
  page?: number
  pageSize?: number
  currencyCode?: string
  direction?: TransactionDirection
}

export interface AdjustBalanceRequest {
  currencyType: CurrencyType
  currencyCode: string
  direction: TransactionDirection
  amount: string
  reason: TransactionReason
  requestId?: string
  idempotencyKey?: string
}

export interface AdjustBalanceResponse {
  transaction: Transaction
  newBalance: WalletBalance
}

export interface User {
  id: string
  email: string
  role: string
  firstName?: string
  lastName?: string
  status: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface UsersListResponse {
  users: User[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
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

// Add retry logic with exponential backoff
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

// Create the wallet API
export const walletApi = createApi({
  reducerPath: 'walletApi',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Wallet', 'Transactions', 'AllWallets', 'Users'],
  refetchOnFocus: false,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: false,
  keepUnusedDataFor: 300, // 5 minutes
  endpoints: (builder) => ({
    // Get current user's wallet (returns array directly)
    getMyWallet: builder.query<WalletBalance[], void>({
      query: () => '/wallets/me',
      providesTags: ['Wallet'],
    }),

    // Get current user's transactions
    getMyTransactions: builder.query<TransactionsResponse, GetTransactionsParams>({
      query: (params) => ({
        url: '/wallets/me/transactions',
        params: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          ...(params.currencyCode && { currencyCode: params.currencyCode }),
          ...(params.direction && { direction: params.direction }),
        },
      }),
      providesTags: ['Transactions'],
    }),

    // Get all wallets (Admin only)
    getAllWallets: builder.query<AllWalletsResponse, { page?: number; pageSize?: number }>({
      query: (params) => ({
        url: '/wallets',
        params: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
        },
      }),
      providesTags: ['AllWallets'],
    }),

    // Get user's wallet by ID (Admin or self)
    getUserWallet: builder.query<WalletBalance[], string>({
      query: (userId) => `/wallets/${userId}`,
      providesTags: (_result, _error, userId) => [{ type: 'Wallet', id: userId }],
    }),

    // Get user's transactions by ID (Admin or self)
    getUserTransactions: builder.query<
      TransactionsResponse,
      { userId: string } & GetTransactionsParams
    >({
      query: ({ userId, ...params }) => ({
        url: `/wallets/${userId}/transactions`,
        params: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          ...(params.currencyCode && { currencyCode: params.currencyCode }),
          ...(params.direction && { direction: params.direction }),
        },
      }),
      providesTags: (_result, _error, { userId }) => [{ type: 'Transactions', id: userId }],
    }),

    // Adjust balance (Admin only)
    adjustBalance: builder.mutation<
      AdjustBalanceResponse,
      { userId: string } & AdjustBalanceRequest
    >({
      query: ({ userId, ...body }) => ({
        url: `/wallets/${userId}/balance`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'Wallet', id: userId },
        { type: 'Transactions', id: userId },
        'AllWallets',
      ],
    }),

    // List all users (Admin only)
    listUsers: builder.query<UsersListResponse, { page?: number; pageSize?: number }>({
      query: (params) => ({
        url: '/users',
        params: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
        },
      }),
      providesTags: ['Users'],
    }),

    // Get user by ID (Admin only)
    getUserById: builder.query<User, string>({
      query: (userId) => `/users/${userId}`,
      providesTags: (_result, _error, userId) => [{ type: 'Users', id: userId }],
    }),
  }),
})

// Export hooks for usage in components
export const {
  useGetMyWalletQuery,
  useGetMyTransactionsQuery,
  useGetAllWalletsQuery,
  useGetUserWalletQuery,
  useGetUserTransactionsQuery,
  useAdjustBalanceMutation,
  useListUsersQuery,
  useGetUserByIdQuery,
} = walletApi

export default walletApi
