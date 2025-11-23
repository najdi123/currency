/**
 * useDateNavigation Hook
 *
 * Manages URL query parameters for date navigation
 * Provides seamless integration with Next.js App Router
 * Enables shareable URLs and browser back/forward support
 */

'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { formatDateForApi, getTehranToday } from '@/lib/utils/dateUtils'

const DATE_QUERY_PARAM = 'date'

export interface DateNavigationState {
  /** Currently selected date from URL (null means today) */
  selectedDate: Date | null
  /** Set a new date and update URL */
  setDate: (date: Date | null) => void
  /** Get formatted date string for API calls */
  getFormattedDate: () => string | null
  /** Check if currently viewing today */
  isToday: boolean
}

/**
 * Parse date from URL query parameter
 * Validates format and ensures date is not in the future
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Valid Date object or null
 */
function parseDateFromUrl(dateString: string | null): Date | null {
  if (!dateString) return null

  // Validate format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateString)) {
    console.warn('[useDateNavigation] Invalid date format in URL:', dateString)
    return null
  }

  try {
    // Parse as UTC to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

    // Validate it's a valid date
    if (isNaN(date.getTime())) {
      console.warn('[useDateNavigation] Invalid date value in URL:', dateString)
      return null
    }

    // Check if date is in the future
    const today = getTehranToday()
    if (date.getTime() > today.getTime()) {
      console.warn('[useDateNavigation] Future date in URL, defaulting to today:', dateString)
      return null
    }

    return date
  } catch (error) {
    console.error('[useDateNavigation] Error parsing date from URL:', error)
    return null
  }
}

/**
 * Hook to manage date navigation via URL query parameters
 * Syncs date selection with browser URL for shareable links and back/forward support
 */
export function useDateNavigation(): DateNavigationState {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Get date from URL
  const selectedDate = useMemo(() => {
    const dateParam = searchParams.get(DATE_QUERY_PARAM)
    return parseDateFromUrl(dateParam)
  }, [searchParams])

  // Check if viewing today
  const isToday = useMemo(() => {
    if (!selectedDate) return true
    const today = getTehranToday()
    return selectedDate.getTime() === today.getTime()
  }, [selectedDate])

  // Get formatted date for API calls
  const getFormattedDate = useCallback(() => {
    if (!selectedDate) return null
    return formatDateForApi(selectedDate)
  }, [selectedDate])

  /**
   * Update URL with new date
   * Removes date param if null (back to today)
   */
  const setDate = useCallback((date: Date | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (date === null) {
      // Remove date parameter to go back to today
      params.delete(DATE_QUERY_PARAM)
    } else {
      // Validate date is not in the future
      const today = getTehranToday()
      if (date.getTime() > today.getTime()) {
        console.warn('[useDateNavigation] Cannot set future date:', date)
        return
      }

      // Set date parameter
      params.set(DATE_QUERY_PARAM, formatDateForApi(date))
    }

    // Build new URL
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname

    // Update URL without reloading page
    router.push(newUrl, { scroll: false })
  }, [searchParams, pathname, router])

  return {
    selectedDate,
    setDate,
    getFormattedDate,
    isToday,
  }
}
