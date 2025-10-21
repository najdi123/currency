'use client'
import { useRef, useEffect } from 'react'
import { Provider } from 'react-redux'
import { setupListeners } from '@reduxjs/toolkit/query'
import { makeStore, AppStore } from './store'
import { errorLogger } from './errorLogger'

export default function StoreProvider({
  children
}: {
  children: React.ReactNode
}) {
  const storeRef = useRef<AppStore | null>(null)
  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore()
  }

  useEffect(() => {
    // Initialize error logger
    errorLogger.init()

    // Set up RTK Query listeners for refetchOnFocus and refetchOnReconnect
    // This enables automatic refetching when:
    // - User switches back to the tab (refetchOnFocus)
    // - Network connection is restored (refetchOnReconnect)
    if (storeRef.current) {
      const unsubscribe = setupListeners(storeRef.current.dispatch)

      console.log('✅ RTK Query listeners configured (refetchOnFocus, refetchOnReconnect)')

      return () => {
        unsubscribe()
      }
    }
  }, [])

  return <Provider store={storeRef.current}>{children}</Provider>
}
