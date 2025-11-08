import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

export interface User {
  id: string
  email: string
  role: string
  firstName?: string
  lastName?: string
  status?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isInitialized: boolean
}

// Initialize state from localStorage if available
const getInitialState = (): AuthState => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      isAuthenticated: false,
      isInitialized: false,
    }
  }

  try {
    const storedUser = localStorage.getItem('user')
    const accessToken = localStorage.getItem('accessToken')

    if (storedUser && accessToken) {
      return {
        user: JSON.parse(storedUser),
        isAuthenticated: true,
        isInitialized: true,
      }
    }
  } catch (error) {
    console.error('Error loading auth state from localStorage:', error)
  }

  return {
    user: null,
    isAuthenticated: false,
    isInitialized: true,
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: getInitialState(),
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload
      state.isAuthenticated = true
      state.isInitialized = true
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
        // Update localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(state.user))
        }
      }
    },
    clearUser: (state) => {
      state.user = null
      state.isAuthenticated = false
      state.isInitialized = true
    },
    initializeAuth: (state) => {
      // This action can be dispatched to trigger initialization
      if (typeof window !== 'undefined') {
        try {
          const storedUser = localStorage.getItem('user')
          const accessToken = localStorage.getItem('accessToken')

          if (storedUser && accessToken) {
            state.user = JSON.parse(storedUser)
            state.isAuthenticated = true
          }
        } catch (error) {
          console.error('Error initializing auth:', error)
        }
      }
      state.isInitialized = true
    },
  },
})

export const { setUser, updateUser, clearUser, initializeAuth } = authSlice.actions

// Selectors
export const selectAuth = (state: RootState) => state.auth
export const selectUser = (state: RootState) => state.auth.user
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated
export const selectIsInitialized = (state: RootState) => state.auth.isInitialized

export default authSlice.reducer
