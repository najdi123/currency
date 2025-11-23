/**
 * Date Navigation Usage Examples
 *
 * This file demonstrates various ways to use the date navigation system.
 * These are example components that show best practices.
 */

'use client'

import { useHistoricalNavigation } from './useHistoricalNavigation'
import { useDateNavigation } from './useDateNavigation'
import { formatDateForApi } from '@/lib/utils/dateUtils'

// ============================================================================
// EXAMPLE 1: Basic Navigation Component
// ============================================================================

export function BasicNavigationExample() {
  const historicalNav = useHistoricalNavigation()

  return (
    <div className="flex items-center gap-4">
      {/* Previous Day Button */}
      <button
        onClick={historicalNav.goToPreviousDay}
        disabled={!historicalNav.canGoBack}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Previous Day
      </button>

      {/* Current Date Display */}
      <div className="text-lg font-semibold">
        {historicalNav.isToday ? (
          'Today'
        ) : (
          <>
            {historicalNav.selectedDate?.toLocaleDateString()} (
            {historicalNav.daysAgo} days ago)
          </>
        )}
      </div>

      {/* Next Day / Today Button */}
      <button
        onClick={
          historicalNav.canGoForward
            ? historicalNav.goToNextDay
            : historicalNav.goToToday
        }
        disabled={historicalNav.isToday}
        className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
      >
        {historicalNav.canGoForward ? 'Next Day' : 'Today'}
      </button>
    </div>
  )
}

// ============================================================================
// EXAMPLE 2: Custom Date Picker Integration
// ============================================================================

export function CustomDatePickerExample() {
  const { selectedDate, setDate } = useDateNavigation()

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value
    if (dateValue) {
      const [year, month, day] = dateValue.split('-').map(Number)
      const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      setDate(date)
    } else {
      setDate(null) // Reset to today
    }
  }

  return (
    <div className="flex items-center gap-4">
      <label htmlFor="date-picker" className="font-medium">
        Select Date:
      </label>
      <input
        id="date-picker"
        type="date"
        value={selectedDate ? formatDateForApi(selectedDate) : ''}
        onChange={handleDateChange}
        max={formatDateForApi(new Date())} // Prevent future dates
        className="px-3 py-2 border rounded"
      />
      {selectedDate && (
        <button
          onClick={() => setDate(null)}
          className="px-3 py-1 bg-gray-200 rounded text-sm"
        >
          Clear (Today)
        </button>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 3: Date Navigation with Data Fetching
// ============================================================================

export function DataFetchingExample() {
  const historicalNav = useHistoricalNavigation()

  // Simulate data fetching (replace with actual hook)
  const isLoading = false
  const hasError = false

  return (
    <div className="space-y-4">
      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={historicalNav.goToPreviousDay}
          disabled={!historicalNav.canGoBack || isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          ← Previous
        </button>

        <div className="text-center">
          <div className="text-sm text-gray-600">
            {historicalNav.isToday ? 'Current Data' : 'Historical Data'}
          </div>
          <div className="font-semibold">
            {historicalNav.selectedDate?.toLocaleDateString() ||
              new Date().toLocaleDateString()}
          </div>
        </div>

        <button
          onClick={historicalNav.goToNextDay}
          disabled={!historicalNav.canGoForward || isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Next →
        </button>
      </div>

      {/* Data Display */}
      <div className="border rounded p-4">
        {isLoading ? (
          <div className="text-center py-8">Loading data...</div>
        ) : hasError ? (
          <div className="text-center py-8 text-red-600">
            Error loading data for this date
            <button
              onClick={historicalNav.goToToday}
              className="block mx-auto mt-2 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Back to Today
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            Data for {historicalNav.formattedDate || 'today'}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// EXAMPLE 4: Shareable Link Generator
// ============================================================================

export function ShareableLinkExample() {
  const { selectedDate } = useDateNavigation()

  const getShareableUrl = () => {
    if (typeof window === 'undefined') return ''
    return window.location.href
  }

  const copyToClipboard = async () => {
    const url = getShareableUrl()
    try {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="space-y-3">
      <div className="font-medium">Share This View:</div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={getShareableUrl()}
          readOnly
          className="flex-1 px-3 py-2 border rounded bg-gray-50"
        />
        <button
          onClick={copyToClipboard}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Copy Link
        </button>
      </div>
      {selectedDate && (
        <div className="text-sm text-gray-600">
          This link will show data for{' '}
          {selectedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 5: Quick Date Shortcuts
// ============================================================================

export function QuickDateShortcutsExample() {
  const { setDate } = useDateNavigation()

  const goToYesterday = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    setDate(yesterday)
  }

  const goToLastWeek = () => {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    setDate(lastWeek)
  }

  const goToLastMonth = () => {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    setDate(lastMonth)
  }

  const goToToday = () => {
    setDate(null)
  }

  return (
    <div className="space-y-2">
      <div className="font-medium">Quick Navigation:</div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={goToToday}
          className="px-3 py-1.5 bg-green-500 text-white rounded text-sm"
        >
          Today
        </button>
        <button
          onClick={goToYesterday}
          className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm"
        >
          Yesterday
        </button>
        <button
          onClick={goToLastWeek}
          className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm"
        >
          Last Week
        </button>
        <button
          onClick={goToLastMonth}
          className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm"
        >
          Last Month
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// EXAMPLE 6: Keyboard Navigation Support
// ============================================================================

export function KeyboardNavigationExample() {
  const historicalNav = useHistoricalNavigation()

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && historicalNav.canGoBack) {
      e.preventDefault()
      historicalNav.goToPreviousDay()
    } else if (e.key === 'ArrowRight' && historicalNav.canGoForward) {
      e.preventDefault()
      historicalNav.goToNextDay()
    } else if (e.key === 'Home') {
      e.preventDefault()
      historicalNav.goToToday()
    }
  }

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="p-6 border-2 border-dashed border-gray-300 rounded focus:border-blue-500 focus:outline-none"
    >
      <div className="text-center mb-4">
        <div className="font-medium mb-2">Keyboard Navigation Enabled</div>
        <div className="text-sm text-gray-600 space-y-1">
          <div>← Arrow Left: Previous Day</div>
          <div>→ Arrow Right: Next Day</div>
          <div>Home: Go to Today</div>
        </div>
      </div>

      <div className="text-center text-lg font-semibold">
        {historicalNav.selectedDate?.toLocaleDateString() || 'Today'}
      </div>

      <div className="text-center text-sm text-gray-500 mt-2">
        Click here and use arrow keys to navigate
      </div>
    </div>
  )
}

// ============================================================================
// EXAMPLE 7: Date Range Display with Context
// ============================================================================

export function DateContextExample() {
  const historicalNav = useHistoricalNavigation()

  const getContextualMessage = () => {
    if (historicalNav.isToday) {
      return 'Viewing current live data'
    }

    const { daysAgo } = historicalNav

    if (daysAgo === 1) {
      return "Viewing yesterday's data"
    }

    if (daysAgo <= 7) {
      return `Viewing data from ${daysAgo} days ago (this week)`
    }

    if (daysAgo <= 30) {
      return `Viewing data from ${daysAgo} days ago (this month)`
    }

    return `Viewing data from ${daysAgo} days ago`
  }

  const getStatusColor = () => {
    if (historicalNav.isToday) return 'bg-green-100 text-green-800'
    if (historicalNav.daysAgo <= 7) return 'bg-blue-100 text-blue-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className={`p-4 rounded ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{getContextualMessage()}</div>
          {!historicalNav.isToday && (
            <div className="text-sm opacity-75">
              {historicalNav.selectedDate?.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          )}
        </div>

        {!historicalNav.isToday && (
          <button
            onClick={historicalNav.goToToday}
            className="px-3 py-1.5 bg-white/50 hover:bg-white/80 rounded text-sm"
          >
            Back to Today
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// EXAMPLE 8: Loading State During Navigation
// ============================================================================

export function LoadingStateExample() {
  const historicalNav = useHistoricalNavigation()

  // This would typically come from your data fetching hook
  const isFetching = false

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={historicalNav.goToPreviousDay}
          disabled={!historicalNav.canGoBack || isFetching}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 flex items-center gap-2"
        >
          {isFetching && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          Previous
        </button>

        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            {isFetching && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <span className="font-semibold">
              {historicalNav.selectedDate?.toLocaleDateString() || 'Today'}
            </span>
          </div>
        </div>

        <button
          onClick={historicalNav.goToNextDay}
          disabled={!historicalNav.canGoForward || isFetching}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 flex items-center gap-2"
        >
          Next
          {isFetching && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
        </button>
      </div>

      {isFetching && (
        <div className="text-center text-sm text-gray-600">
          Loading data for {historicalNav.formattedDate || 'today'}...
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXAMPLE 9: Accessibility-First Navigation
// ============================================================================

export function AccessibleNavigationExample() {
  const historicalNav = useHistoricalNavigation()

  return (
    <nav
      aria-label="Date navigation"
      className="flex items-center justify-between p-4 bg-white rounded border"
    >
      <button
        onClick={historicalNav.goToPreviousDay}
        disabled={!historicalNav.canGoBack}
        aria-label={`Go to previous day${!historicalNav.canGoBack ? ' (limit reached)' : ''}`}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <span aria-hidden="true">←</span>
        <span className="sr-only">Previous day</span>
      </button>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-center"
      >
        <div className="text-sm text-gray-600">
          {historicalNav.isToday ? 'Current data' : 'Historical data'}
        </div>
        <time
          dateTime={
            historicalNav.formattedDate || new Date().toISOString().split('T')[0]
          }
          className="font-semibold"
        >
          {historicalNav.selectedDate?.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }) || 'Today'}
        </time>
      </div>

      <button
        onClick={historicalNav.goToNextDay}
        disabled={!historicalNav.canGoForward}
        aria-label={`Go to next day${!historicalNav.canGoForward ? ' (at today)' : ''}`}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <span aria-hidden="true">→</span>
        <span className="sr-only">Next day</span>
      </button>
    </nav>
  )
}
