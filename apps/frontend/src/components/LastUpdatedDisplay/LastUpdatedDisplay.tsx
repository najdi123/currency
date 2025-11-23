'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { FiClock, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'
import type { HistoricalNavigationState } from '@/hooks/useHistoricalNavigation'
import { DatePicker } from '@/components/DatePicker/DatePicker'
import jalaali from 'jalaali-js'
import { fetchTehranTime } from '@/lib/utils/timeApi'
import toast from 'react-hot-toast'

interface LastUpdatedDisplayProps {
  lastUpdated: Date | null
  isFetching: boolean
  historicalNav?: HistoricalNavigationState
}

// Constants for date validation and configuration
const MIN_GREGORIAN_DATE = new Date(2011, 0, 1) // January 1, 2011
const MIN_PERSIAN_YEAR = 1390

// Toast notification configuration
const TOAST_DURATION = 4000
const TOAST_POSITION = 'top-center' as const

// Cache refresh interval (1 minute)
const TEHRAN_TIME_REFRESH_INTERVAL = 60000

// Helper function to get valid days in a Persian month
const getValidPersianDays = (year: number, month: number): number => {
  // First 6 months (Farvardin to Shahrivar) have 31 days
  if (month <= 6) return 31
  // Months 7-11 (Mehr to Bahman) have 30 days
  if (month <= 11) return 30
  // Month 12 (Esfand) has 29 or 30 days depending on leap year
  return jalaali.isLeapJalaaliYear(year) ? 30 : 29
}

// Helper to check if date is too old (before 2011)
const isTooOld = (date: Date): boolean => {
  return date.getTime() < MIN_GREGORIAN_DATE.getTime()
}

/**
 * Safely convert Persian date to Gregorian with comprehensive validation
 * Throws descriptive errors for invalid dates
 */
const safePersianToGregorian = (jy: number, jm: number, jd: number): Date => {
  // Pre-validate using jalaali-js built-in validation
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) {
    throw new Error(`Invalid Persian date: ${jy}/${jm}/${jd}`)
  }

  // Convert to Gregorian
  const gregorian = jalaali.toGregorian(jy, jm, jd)
  const date = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd)

  // Verify the conversion worked correctly (edge case check)
  if (isNaN(date.getTime())) {
    throw new Error(`Conversion resulted in invalid date: ${jy}/${jm}/${jd}`)
  }

  // Verify round-trip conversion for accuracy
  const backToPersian = jalaali.toJalaali(gregorian.gy, gregorian.gm, gregorian.gd)
  if (backToPersian.jy !== jy || backToPersian.jm !== jm || backToPersian.jd !== jd) {
    throw new Error(`Round-trip conversion mismatch for date: ${jy}/${jm}/${jd}`)
  }

  return date
}

/**
 * Safely convert Gregorian date to Persian with validation
 */
const safeGregorianToPersian = (date: Date): { jy: number; jm: number; jd: number } => {
  const gy = date.getFullYear()
  const gm = date.getMonth() + 1
  const gd = date.getDate()

  try {
    const persian = jalaali.toJalaali(gy, gm, gd)

    // Verify the conversion worked correctly
    if (!jalaali.isValidJalaaliDate(persian.jy, persian.jm, persian.jd)) {
      throw new Error(`Conversion resulted in invalid Persian date`)
    }

    return persian
  } catch (error) {
    throw new Error(`Failed to convert Gregorian date ${gy}-${gm}-${gd} to Persian`)
  }
}

/**
 * Shared validation function for date selection
 * Returns error message if validation fails, null if valid
 */
const validateDateSelection = (
  date: Date,
  tehranNow: Date
): { isValid: boolean; errorKey?: string; errorMessage?: string } => {
  // Check if date is too old (before 2011)
  if (isTooOld(date)) {
    return {
      isValid: false,
      errorKey: 'dateTooOldError',
      errorMessage: 'Date is too old. Historical data is only available from 2011 onwards.',
    }
  }

  // Check if date is in the future
  const todayStart = new Date(tehranNow.getFullYear(), tehranNow.getMonth(), tehranNow.getDate())
  const selectedStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (selectedStart > todayStart) {
    return {
      isValid: false,
      errorKey: 'futureDateError',
      errorMessage: 'This date is in the future. We don\'t have values for it.',
    }
  }

  return { isValid: true }
}

export const LastUpdatedDisplay = ({
  lastUpdated,
  isFetching,
  historicalNav,
}: LastUpdatedDisplayProps) => {
  const t = useTranslations('PageHeader')
  const locale = useLocale()

  // State to track which date picker is open
  const [openPicker, setOpenPicker] = useState<'persian' | 'gregorian' | null>(null)

  // State to track which dropdown group is active (to show the button)
  const [activeDropdown, setActiveDropdown] = useState<'persian' | 'gregorian' | null>(null)

  // State for Persian date dropdowns
  const [persianDay, setPersianDay] = useState<number>(1)
  const [persianMonth, setPersianMonth] = useState<number>(1)
  const [persianYear, setPersianYear] = useState<number>(1404)

  // State for Gregorian date dropdowns
  const [gregorianDay, setGregorianDay] = useState<number>(1)
  const [gregorianMonth, setGregorianMonth] = useState<number>(1)
  const [gregorianYear, setGregorianYear] = useState<number>(2025)

  // Cache Tehran time to avoid race conditions in validation
  const [tehranNow, setTehranNow] = useState<Date>(new Date())

  // Get current Persian and Gregorian years dynamically
  const currentGregorianYear = tehranNow.getFullYear()
  const currentPersianYear = useMemo(() => {
    const persianDate = jalaali.toJalaali(
      tehranNow.getFullYear(),
      tehranNow.getMonth() + 1,
      tehranNow.getDate()
    )
    return persianDate.jy
  }, [tehranNow])

  // Memoize year options to prevent recreation on every render
  // Limit Persian years to supported range (1390 onwards)
  const persianYearOptions = useMemo(() => {
    const yearCount = currentPersianYear - MIN_PERSIAN_YEAR + 1
    return Array.from({ length: yearCount }, (_, i) => currentPersianYear - i)
  }, [currentPersianYear])

  // Limit Gregorian years to supported range (2011 onwards)
  const gregorianYearOptions = useMemo(() => {
    const minYear = MIN_GREGORIAN_DATE.getFullYear()
    const yearCount = currentGregorianYear - minYear + 1
    return Array.from({ length: yearCount }, (_, i) => currentGregorianYear - i)
  }, [currentGregorianYear])

  // Memoize month options (static, but good for consistency)
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])

  // Memoize Persian day options based on selected year and month
  const persianDayOptions = useMemo(
    () => Array.from({ length: getValidPersianDays(persianYear, persianMonth) }, (_, i) => i + 1),
    [persianYear, persianMonth]
  )

  // Memoize Gregorian day options (always 31 for simplicity)
  const gregorianDayOptions = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])

  // Fetch Tehran time once on mount and refresh periodically
  useEffect(() => {
    let isMounted = true

    // Initial fetch
    fetchTehranTime()
      .then((time) => {
        if (isMounted) setTehranNow(time)
      })
      .catch(() => {
        if (isMounted) setTehranNow(new Date())
      })

    // Refresh every minute
    const interval = setInterval(() => {
      fetchTehranTime()
        .then((time) => {
          if (isMounted) setTehranNow(time)
        })
        .catch(() => {
          if (isMounted) setTehranNow(new Date())
        })
    }, TEHRAN_TIME_REFRESH_INTERVAL)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Keyboard shortcuts for date navigation
  // Memoize the handler to prevent recreation on every render
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!historicalNav) return

    // Only activate shortcuts when no input/textarea/select is focused
    const activeElement = document.activeElement
    if (
      activeElement?.tagName === 'INPUT' ||
      activeElement?.tagName === 'TEXTAREA' ||
      activeElement?.tagName === 'SELECT'
    ) {
      return
    }

    // Ctrl/Cmd + Left Arrow = Previous Day
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
      e.preventDefault()
      if (historicalNav.canGoBack && !isFetching) {
        historicalNav.goToPreviousDay()
      }
    }

    // Ctrl/Cmd + Right Arrow = Next Day / Today
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
      e.preventDefault()
      if (!historicalNav.isToday && !isFetching) {
        if (historicalNav.canGoForward) {
          historicalNav.goToNextDay()
        } else {
          historicalNav.goToToday()
        }
      }
    }

    // Ctrl/Cmd + T = Go to Today
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
      e.preventDefault()
      if (!historicalNav.isToday && !isFetching) {
        historicalNav.goToToday()
      }
    }
  }, [historicalNav, isFetching])

  useEffect(() => {
    if (!historicalNav) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historicalNav, handleKeyDown])

  // Update dropdown states when selectedDate changes
  useEffect(() => {
    const date = historicalNav?.selectedDate ?? lastUpdated
    if (!date) return

    try {
      // Convert Gregorian to Persian using safe conversion
      const persian = safeGregorianToPersian(date)

      setPersianYear(persian.jy)
      setPersianMonth(persian.jm)
      setPersianDay(persian.jd)

      // Update Gregorian dropdowns
      setGregorianYear(date.getFullYear())
      setGregorianMonth(date.getMonth() + 1)
      setGregorianDay(date.getDate())
    } catch (error) {
      console.error('[LastUpdatedDisplay] Failed to convert date:', error)
      // Keep existing values on error
    }
  }, [historicalNav?.selectedDate, lastUpdated])

  // Auto-adjust Persian day when year or month changes to prevent invalid dates
  useEffect(() => {
    const maxDay = getValidPersianDays(persianYear, persianMonth)
    if (persianDay > maxDay) {
      setPersianDay(maxDay)
    }
  }, [persianYear, persianMonth]) // Removed persianDay to prevent infinite loop

  // Handle date selection from picker
  const handleDateSelect = (date: Date) => {
    if (historicalNav) {
      historicalNav.setDate(date)
    }
  }

  // Handle opening the date picker from button
  const handleOpenPicker = (type: 'persian' | 'gregorian') => {
    setOpenPicker(type)
    setActiveDropdown(null) // Hide button after opening picker
  }

  // Handle applying the Persian date from dropdowns
  const handleApplyPersianDate = () => {
    // Dismiss any existing toasts to prevent spam
    toast.dismiss()

    try {
      // Convert Persian date to Gregorian using safe conversion with comprehensive validation
      const gregorianDate = safePersianToGregorian(persianYear, persianMonth, persianDay)

      // Use shared validation function
      const validation = validateDateSelection(gregorianDate, tehranNow)
      if (!validation.isValid) {
        toast.error(t(validation.errorKey!) || validation.errorMessage!, {
          duration: TOAST_DURATION,
          position: TOAST_POSITION,
          icon: validation.errorKey === 'futureDateError' ? '🔮' : '📅',
        })
        return
      }

      if (historicalNav) {
        historicalNav.setDate(gregorianDate)
      }
      setActiveDropdown(null)
    } catch (error) {
      console.error('Error converting Persian date:', error)

      // Granular error handling
      if (error instanceof RangeError) {
        toast.error(t('invalidPersianDate') || 'Invalid Persian date. Please check your selection.', {
          duration: TOAST_DURATION,
          position: TOAST_POSITION,
          icon: '❌',
        })
      } else {
        toast.error(t('dateConversionError') || 'Error converting date. Please try again.', {
          duration: TOAST_DURATION,
          position: TOAST_POSITION,
          icon: '⚠️',
        })
      }
    }
  }

  // Handle applying the Gregorian date from dropdowns
  const handleApplyGregorianDate = () => {
    // Dismiss any existing toasts to prevent spam
    toast.dismiss()

    try {
      // Validate Gregorian date (basic check for invalid dates like Feb 30)
      const gregorianDate = new Date(gregorianYear, gregorianMonth - 1, gregorianDay)

      // Check if the date is valid (e.g., not Feb 30)
      if (
        gregorianDate.getFullYear() !== gregorianYear ||
        gregorianDate.getMonth() !== gregorianMonth - 1 ||
        gregorianDate.getDate() !== gregorianDay
      ) {
        toast.error(t('invalidGregorianDate') || 'Invalid date. Please check your selection.', {
          duration: TOAST_DURATION,
          position: TOAST_POSITION,
          icon: '❌',
        })
        return
      }

      // Use shared validation function
      const validation = validateDateSelection(gregorianDate, tehranNow)
      if (!validation.isValid) {
        toast.error(t(validation.errorKey!) || validation.errorMessage!, {
          duration: TOAST_DURATION,
          position: TOAST_POSITION,
          icon: validation.errorKey === 'futureDateError' ? '🔮' : '📅',
        })
        return
      }

      if (historicalNav) {
        historicalNav.setDate(gregorianDate)
      }
      setActiveDropdown(null)
    } catch (error) {
      console.error('Error creating Gregorian date:', error)

      // Granular error handling
      if (error instanceof RangeError) {
        toast.error(t('invalidGregorianDate') || 'Invalid date. Please check your selection.', {
          duration: TOAST_DURATION,
          position: TOAST_POSITION,
          icon: '❌',
        })
      } else {
        toast.error(t('dateConversionError') || 'Error setting date. Please try again.', {
          duration: TOAST_DURATION,
          position: TOAST_POSITION,
          icon: '⚠️',
        })
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-3" role="region" aria-label={t('lastUpdated')}>
      {/* Desktop: Horizontal layout with buttons on sides, Mobile: Vertical with buttons below */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        {/* Left Navigation Button - Desktop only (hidden on mobile) */}
        {historicalNav && (
          <button
            onClick={historicalNav.goToPreviousDay}
            disabled={!historicalNav.canGoBack || isFetching}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label={historicalNav.isToday ? t('goToYesterday') || 'Go to Yesterday' : t('previousDay')}
            title={historicalNav.isToday ? t('goToYesterday') || 'Go to Yesterday' : t('previousDay')}
            aria-disabled={!historicalNav.canGoBack || isFetching}
          >
            {/* Conditional Arrow: Flip in Farsi */}
            {locale === 'fa' || locale === 'ar' ? (
              <FiChevronRight className="text-base" aria-hidden="true" />
            ) : (
              <FiChevronLeft className="text-base" aria-hidden="true" />
            )}
            <span>
              {historicalNav.isToday ? t('goToYesterday') || 'Yesterday' : t('previousDay')}
            </span>
          </button>
        )}

        {/* Last Updated Time Display */}
        <div className="flex items-center gap-3 text-text-secondary" aria-busy={isFetching}>
          <div className="flex flex-col justify-center items-center">
            <span className="relative flex h-3 w-3" aria-hidden="true" role="status" aria-label={isFetching ? t('loading') || 'Loading' : t('dataReady') || 'Data ready'}>
              {isFetching ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                </>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </>
              )}
            </span>

            <FiClock className="text-base flex-shrink-0 mt-1" aria-hidden="true" />
          </div>
          <div className="flex flex-col items-start gap-0.5" aria-live="polite">
            <div className="text-apple-footnote text-text-tertiary">
              {historicalNav && !historicalNav.isToday ? t('historicalDataTime') : t('lastUpdated')}
            </div>
            {lastUpdated ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-0.5">
                  <time
                    dateTime={lastUpdated.toISOString()}
                    className="text-xl sm:text-2xl font-semibold text-text-primary tabular-nums"
                  >
                    {new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
                      timeZone: 'Asia/Tehran',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    }).format(lastUpdated)}
                  </time>
                  <span className="text-[10px] text-text-tertiary">
                    {t('tehranTime')}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-apple-caption text-text-tertiary relative min-h-[52px]">

    {/* Action Buttons - Shows when dropdown is active - Fixed position to prevent layout shift */}
                  <div className={`absolute bottom-16 ${locale === 'fa' || locale === 'ar' ? 'left-0' : 'right-0'} mt-1 flex gap-2 z-10 transition-opacity duration-200`} style={{ opacity: activeDropdown ? 1 : 0, pointerEvents: activeDropdown ? 'auto' : 'none' }}>
                    <button
                      onClick={() => activeDropdown === 'persian' ? handleApplyPersianDate() : handleApplyGregorianDate()}
                      className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition-all shadow-lg whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      aria-label="Go to selected date"
                      tabIndex={activeDropdown ? 0 : -1}
                    >
                      {t('go')}
                    </button>
                    <button
                      onClick={() => activeDropdown && handleOpenPicker(activeDropdown)}
                      className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-all shadow-lg whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                      aria-label={activeDropdown === 'persian' ? t('openDatePickerPersian') : t('openDatePickerGregorian')}
                      tabIndex={activeDropdown ? 0 : -1}
                    >
                      {t('openDatePicker')}
                    </button>
                  </div>

                  {/* Persian Date - Day/Month/Year Dropdowns */}
                  <div
                    className={`flex gap-1 items-center transition-all duration-200 px-2 py-1 rounded-md ${
                      activeDropdown === 'persian' ? 'bg-accent/10 ring-1 ring-accent/30' : ''
                    }`}
                    dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'}
                    onClick={() => setActiveDropdown('persian')}
                  >
                    <select
                      value={persianYear}
                      onChange={(e) => setPersianYear(parseInt(e.target.value))}
                      className={`bg-transparent border rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-xs transition-colors ${
                        activeDropdown === 'persian'
                          ? 'border-accent text-text-primary font-medium'
                          : 'border-border-light hover:border-accent text-text-tertiary'
                      }`}
                      dir="ltr"
                      aria-label={t('selectPersianYear') || 'Select Persian year'}
                    >
                      {persianYearOptions.map(year => (
                        <option key={year} value={year}>{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(year) : year}</option>
                      ))}
                    </select>
                    <span className={`transition-colors ${activeDropdown === 'persian' ? 'text-accent' : 'text-text-tertiary'}`}>/</span>
                    <select
                      value={persianMonth}
                      onChange={(e) => setPersianMonth(parseInt(e.target.value))}
                      className={`bg-transparent border rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-xs transition-colors ${
                        activeDropdown === 'persian'
                          ? 'border-accent text-text-primary font-medium'
                          : 'border-border-light hover:border-accent text-text-tertiary'
                      }`}
                      dir="ltr"
                      aria-label={t('selectPersianMonth') || 'Select Persian month'}
                    >
                      {monthOptions.map(month => (
                        <option key={month} value={month}>
                          {locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(month).padStart(2, '۰') : month.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className={`transition-colors ${activeDropdown === 'persian' ? 'text-accent' : 'text-text-tertiary'}`}>/</span>
                    <select
                      value={persianDay}
                      onChange={(e) => setPersianDay(parseInt(e.target.value))}
                      className={`bg-transparent border rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-xs transition-colors ${
                        activeDropdown === 'persian'
                          ? 'border-accent text-text-primary font-medium'
                          : 'border-border-light hover:border-accent text-text-tertiary'
                      }`}
                      dir="ltr"
                      aria-label={t('selectPersianDay') || 'Select Persian day'}
                    >
                      {persianDayOptions.map(day => (
                        <option key={day} value={day}>
                          {locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(day).padStart(2, '۰') : day.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Gregorian Date - Day/Month/Year Dropdowns */}
                  <div
                    className={`flex gap-1 items-center transition-all duration-200 px-2 py-1 rounded-md ${
                      activeDropdown === 'gregorian' ? 'bg-accent/10 ring-1 ring-accent/30' : ''
                    }`}
                    onClick={() => setActiveDropdown('gregorian')}
                  >
                    <select
                      value={gregorianYear}
                      onChange={(e) => setGregorianYear(parseInt(e.target.value))}
                      className={`bg-transparent border rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-xs transition-colors ${
                        activeDropdown === 'gregorian'
                          ? 'border-accent text-text-primary font-medium'
                          : 'border-border-light hover:border-accent text-text-tertiary'
                      }`}
                      aria-label={t('selectGregorianYear') || 'Select year'}
                    >
                      {gregorianYearOptions.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <span className={`transition-colors ${activeDropdown === 'gregorian' ? 'text-accent' : 'text-text-tertiary'}`}>-</span>
                    <select
                      value={gregorianMonth}
                      onChange={(e) => setGregorianMonth(parseInt(e.target.value))}
                      className={`bg-transparent border rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-xs transition-colors ${
                        activeDropdown === 'gregorian'
                          ? 'border-accent text-text-primary font-medium'
                          : 'border-border-light hover:border-accent text-text-tertiary'
                      }`}
                      aria-label={t('selectGregorianMonth') || 'Select month'}
                    >
                      {monthOptions.map(month => (
                        <option key={month} value={month}>{month.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <span className={`transition-colors ${activeDropdown === 'gregorian' ? 'text-accent' : 'text-text-tertiary'}`}>-</span>
                    <select
                      value={gregorianDay}
                      onChange={(e) => setGregorianDay(parseInt(e.target.value))}
                      className={`bg-transparent border rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-xs transition-colors ${
                        activeDropdown === 'gregorian'
                          ? 'border-accent text-text-primary font-medium'
                          : 'border-border-light hover:border-accent text-text-tertiary'
                      }`}
                      aria-label={t('selectGregorianDay') || 'Select day'}
                    >
                      {gregorianDayOptions.map(day => (
                        <option key={day} value={day}>{day.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>

              
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <div className="text-xl sm:text-2xl font-semibold text-text-primary">
                  --:--
                </div>
                <span className="text-[10px] text-text-tertiary">
                  {t('tehranTime')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Navigation Button - Desktop only (hidden on mobile) */}
        {historicalNav && (
          <button
            onClick={historicalNav.canGoForward ? historicalNav.goToNextDay : historicalNav.goToToday}
            disabled={historicalNav.isToday || isFetching}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label={historicalNav.canGoForward ? t('nextDay') : t('today')}
            title={historicalNav.canGoForward ? t('nextDay') : t('today')}
            aria-disabled={historicalNav.isToday || isFetching}
          >
            <span>
              {historicalNav.canGoForward ? t('nextDay') : t('today')}
            </span>

            {/* Arrow flips in Farsi: Next Day = left arrow in RTL */}
            {historicalNav.canGoForward ? (
              locale === 'fa' || locale === 'ar' ? (
                <FiChevronLeft className="text-base" aria-hidden="true" />
              ) : (
                <FiChevronRight className="text-base" aria-hidden="true" />
              )
            ) : (
              <HiCalendar className="text-base" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Navigation Buttons Row - Mobile only (shown below the time/date) */}
      {historicalNav && (
        <div className="flex sm:hidden items-center gap-5">
          {/* Left Navigation Button - Previous Day / Yesterday */}
          <button
            onClick={historicalNav.goToPreviousDay}
            disabled={!historicalNav.canGoBack || isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label={historicalNav.isToday ? t('goToYesterday') || 'Go to Yesterday' : t('previousDay')}
            title={historicalNav.isToday ? t('goToYesterday') || 'Go to Yesterday' : t('previousDay')}
            aria-disabled={!historicalNav.canGoBack || isFetching}
          >
            {/* Conditional Arrow: Flip in Farsi */}
            {locale === 'fa' || locale === 'ar' ? (
              <FiChevronRight className="text-base" aria-hidden="true" />
            ) : (
              <FiChevronLeft className="text-base" aria-hidden="true" />
            )}

            {/* Show full text on mobile */}
            <span>
              {historicalNav.isToday ? t('goToYesterday') || 'Yesterday' : t('previousDay')}
            </span>
          </button>

          {/* Right Navigation Button - Today / Next Day */}
          <button
            onClick={historicalNav.canGoForward ? historicalNav.goToNextDay : historicalNav.goToToday}
            disabled={historicalNav.isToday || isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label={historicalNav.canGoForward ? t('nextDay') : t('today')}
            title={historicalNav.canGoForward ? t('nextDay') : t('today')}
            aria-disabled={historicalNav.isToday || isFetching}
          >
            {/* Show full text on mobile */}
            <span>
              {historicalNav.canGoForward ? t('nextDay') : t('today')}
            </span>

            {/* Arrow flips in Farsi: Next Day = left arrow in RTL */}
            {historicalNav.canGoForward ? (
              locale === 'fa' || locale === 'ar' ? (
                <FiChevronLeft className="text-base" aria-hidden="true" />
              ) : (
                <FiChevronRight className="text-base" aria-hidden="true" />
              )
            ) : (
              <HiCalendar className="text-base" aria-hidden="true" />
            )}
          </button>
        </div>
      )}

      {/* Date Pickers */}
      {historicalNav && (
        <>
          <DatePicker
            selectedDate={historicalNav.selectedDate}
            onDateSelect={handleDateSelect}
            onClose={() => setOpenPicker(null)}
            isOpen={openPicker === 'persian'}
            calendarType="persian"
          />
          <DatePicker
            selectedDate={historicalNav.selectedDate}
            onDateSelect={handleDateSelect}
            onClose={() => setOpenPicker(null)}
            isOpen={openPicker === 'gregorian'}
            calendarType="gregorian"
          />
        </>
      )}
    </div>
  )
}
