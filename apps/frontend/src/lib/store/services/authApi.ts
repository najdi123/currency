import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { config } from '@/lib/config'

// TypeScript interfaces for authentication
export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    email: string
    role: string
    firstName?: string
    lastName?: string
  }
}

export interface RegisterRequest {
  email: string
  password: string
  firstName?: string
  lastName?: string
  role?: 'admin' | 'user'
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfileRequest {
  firstName?: string
  lastName?: string
}

export interface User {
  id: string
  email: string
  role: string
  firstName?: string
  lastName?: string
  status: string
  createdAt?: string
  updatedAt?: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface MessageResponse {
  message: string
}

// Base query with auth token injection
const baseQuery = fetchBaseQuery({
  baseUrl: config.apiUrl,
  credentials: 'omit',
  prepareHeaders: (headers) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    return headers
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
        const { accessToken, refreshToken: newRefreshToken } = refreshResult.data as AuthResponse

        // Store new tokens
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)
        }

        // Retry the original request with new token
        result = await baseQuery(args, api, extraOptions)
      } else {
        // Refresh failed, logout user
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')

          // Redirect to login only if not already there
          if (window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
        }
      }
    }
  }

  return result
}

// Create the authentication API
export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Profile'],
  endpoints: (builder) => ({
    // Login endpoint
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (typeof window !== 'undefined') {
            localStorage.setItem('accessToken', data.accessToken)
            localStorage.setItem('refreshToken', data.refreshToken)
            localStorage.setItem('user', JSON.stringify(data.user))
          }
        } catch (error) {
          // Error handling is done in the component
          console.error('Login failed:', error)
        }
      },
      invalidatesTags: ['User', 'Profile'],
    }),

    // Logout endpoint
    logout: builder.mutation<MessageResponse, RefreshTokenRequest>({
      query: (body) => ({
        url: '/auth/logout',
        method: 'POST',
        body,
      }),
      async onQueryStarted(arg, { queryFulfilled }) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
        }
        try {
          await queryFulfilled
        } catch (error) {
          // Even if the API call fails, we've cleared local storage
          console.error('Logout API failed:', error)
        }
      },
      invalidatesTags: ['User', 'Profile'],
    }),

    // Refresh token endpoint
    refreshToken: builder.mutation<AuthResponse, RefreshTokenRequest>({
      query: (body) => ({
        url: '/auth/refresh',
        method: 'POST',
        body,
      }),
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (typeof window !== 'undefined') {
            localStorage.setItem('accessToken', data.accessToken)
            localStorage.setItem('refreshToken', data.refreshToken)
            if (data.user) {
              localStorage.setItem('user', JSON.stringify(data.user))
            }
          }
        } catch (error) {
          console.error('Token refresh failed:', error)
        }
      },
    }),

    // Get current user profile
    getProfile: builder.query<User, void>({
      query: () => '/profile/me',
      providesTags: ['Profile'],
    }),

    // Update user profile
    updateProfile: builder.mutation<User, UpdateProfileRequest>({
      query: (body) => ({
        url: '/profile/me',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Profile'],
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('user')
            if (storedUser) {
              const user = JSON.parse(storedUser)
              localStorage.setItem('user', JSON.stringify({ ...user, ...data }))
            }
          }
        } catch (error) {
          console.error('Profile update failed:', error)
        }
      },
    }),

    // Change password
    changePassword: builder.mutation<MessageResponse, ChangePasswordRequest>({
      query: (body) => ({
        url: '/auth/change-password',
        method: 'POST',
        body,
      }),
    }),

    // Register new user (admin only)
    register: builder.mutation<User, RegisterRequest>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),
  }),
})

// Export hooks for usage in components
export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useRegisterMutation,
} = authApi

export default authApi
