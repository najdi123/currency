import { configureStore } from '@reduxjs/toolkit'
import api from './services/api'
import authApi from './services/authApi'
import walletApi from './services/walletApi'
import adminApi from './services/adminApi'
import authReducer from './slices/authSlice'
import calculatorReducer from './slices/calculatorSlice'

export const makeStore = () => {
  return configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      [authApi.reducerPath]: authApi.reducer,
      [walletApi.reducerPath]: walletApi.reducer,
      [adminApi.reducerPath]: adminApi.reducer,
      auth: authReducer,
      calculator: calculatorReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .concat(api.middleware)
        .concat(authApi.middleware)
        .concat(walletApi.middleware)
        .concat(adminApi.middleware),
  })
}

// Infer types from makeStore
export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
