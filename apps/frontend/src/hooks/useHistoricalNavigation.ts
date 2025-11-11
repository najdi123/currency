/**
 * useHistoricalNavigation Hook
 *
 * Manages multi-day historical date navigation with support for up to 90 days back
 */

import { useState, useCallback, useMemo } from 'react'
import { formatDateForApi, getTehranToday } from '@/lib/utils/dateUtils'

const MAX_DAYS_BACK = 90

export interface HistoricalNavigationState {
  /** Currently selected date (null means today) */
  selectedDate: Date | null
  /** Navigate to the previous day */
  goToPreviousDay: () => void
  /** Navigate to the next day (disabled if already at today) */
  goToNextDay: () => void
  /** Reset to today */
  goToToday: () => void
  /** Whether we're viewing today's data */
  isToday: boolean
  /** Number of days back from today (0 = today, 1 = yesterday, etc.) */
  daysAgo: number
  /** Formatted date string for API calls (YYYY-MM-DD) */
  formattedDate: string | null
  /** Whether we can go back further (max 90 days) */
  canGoBack: boolean
  /** Whether we can go forward (not yet at today) */
  canGoForward: boolean
}

/**
 * Get days difference between two dates (ignoring time)
 */
const getDaysDifference = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate())
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate())
  return Math.round((d1.getTime() - d2.getTime()) / oneDay)
}

/**
 * Hook to manage multi-day historical navigation
 * Uses Tehran timezone for date calculations to match backend
 * @param serverTime - Optional server time from API (actual Tehran time)
 */
export function useHistoricalNavigation(serverTime?: Date | null): HistoricalNavigationState {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Use server time if available (actual Tehran time), otherwise fall back to system calculation
  // This prevents issues when system clock is incorrect
  const today = useMemo(() => {
    if (serverTime) {
      const tehranDateStr = formatDateForApi(serverTime)
      const [year, month, day] = tehranDateStr.split('-').map(Number)
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    }
    return getTehranToday()
  }, [serverTime])

  // Calculate if we're viewing today
  const isToday = useMemo(() => {
    if (!selectedDate) return true
    return getDaysDifference(today, selectedDate) === 0
  }, [selectedDate, today])

  // Calculate days ago
  const daysAgo = useMemo(() => {
    if (!selectedDate) return 0
    return getDaysDifference(today, selectedDate)
  }, [selectedDate, today])

  // Format date for API
  const formattedDate = useMemo(() => {
    if (!selectedDate) return null
    return formatDateForApi(selectedDate)
  }, [selectedDate])

  // Check if we can go back further
  const canGoBack = useMemo(() => {
    return daysAgo < MAX_DAYS_BACK
  }, [daysAgo])

  // Check if we can go forward
  const canGoForward = useMemo(() => {
    return !isToday
  }, [isToday])

  // Navigate to previous day
  const goToPreviousDay = useCallback(() => {
    setSelectedDate((current) => {
      const dateToUse = current || today
      const newDate = new Date(dateToUse)
      newDate.setDate(newDate.getDate() - 1)

      // Check if we've exceeded the max days back
      const daysDiff = getDaysDifference(today, newDate)
      if (daysDiff >= MAX_DAYS_BACK) {
        // Can't go back further
        return current
      }

      return newDate
    })
  }, [today])

  // Navigate to next day
  const goToNextDay = useCallback(() => {
    setSelectedDate((current) => {
      if (!current) return null // Already at today

      const newDate = new Date(current)
      newDate.setDate(newDate.getDate() + 1)

      // If we're going to today, set to null
      const daysDiff = getDaysDifference(today, newDate)
      if (daysDiff <= 0) {
        return null
      }

      return newDate
    })
  }, [today])

  // Go to today
  const goToToday = useCallback(() => {
    setSelectedDate(null)
  }, [])

  return {
    selectedDate,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    isToday,
    daysAgo,
    formattedDate,
    canGoBack,
    canGoForward,
  }
}
