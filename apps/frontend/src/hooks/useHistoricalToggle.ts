/**
 * useHistoricalToggle Hook
 *
 * Manages state for toggling between today's data and yesterday's data
 */

import { useState, useCallback } from 'react'

export interface HistoricalToggleState {
  /** Whether we're currently viewing yesterday's data */
  showYesterday: boolean
  /** Toggle to yesterday's data */
  showYesterdayData: () => void
  /** Toggle back to today's data */
  showTodayData: () => void
  /** Toggle between today and yesterday */
  toggleHistorical: () => void
}

/**
 * Hook to manage historical data toggle state
 */
export function useHistoricalToggle(): HistoricalToggleState {
  const [showYesterday, setShowYesterday] = useState(false)

  const showYesterdayData = useCallback(() => {
    setShowYesterday(true)
  }, [])

  const showTodayData = useCallback(() => {
    setShowYesterday(false)
  }, [])

  const toggleHistorical = useCallback(() => {
    setShowYesterday((prev) => !prev)
  }, [])

  return {
    showYesterday,
    showYesterdayData,
    showTodayData,
    toggleHistorical,
  }
}
