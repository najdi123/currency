/**
 * Offline Banner Wrapper
 *
 * Client-side wrapper for OfflineBanner to use in server components.
 * Handles refetching all queries when connection is restored.
 */

'use client'

import { OfflineBanner } from './OfflineBanner'
import { api } from '@/lib/store/services/api'
import { useDispatch } from 'react-redux'

export function OfflineBannerWrapper() {
  const dispatch = useDispatch()

  const handleReconnect = () => {
    // Refetch all active queries when connection is restored
    dispatch(api.util.invalidateTags(['Rates']))
    console.log('🔄 Network reconnected - invalidating all cached data')
  }

  return (
    <OfflineBanner
      onReconnect={handleReconnect}
      showPoorConnectionWarning={true}
      autoHideOnReconnect={true}
      autoHideDelay={3000}
    />
  )
}
