import { configureStore } from '@reduxjs/toolkit'
import api from './services/api'
import authApi from './services/authApi'
import walletApi from './services/walletApi'
import authReducer from './slices/authSlice'

export const makeStore = () => {
  return configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
      [authApi.reducerPath]: authApi.reducer,
      [walletApi.reducerPath]: walletApi.reducer,
      auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .concat(api.middleware)
        .concat(authApi.middleware)
        .concat(walletApi.middleware),
  })
}

// Infer types from makeStore
export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
