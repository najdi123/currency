'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { FiClock, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'
import type { HistoricalNavigationState } from '@/hooks/useHistoricalNavigation'
import { DatePicker } from '@/components/DatePicker/DatePicker'

interface LastUpdatedDisplayProps {
  lastUpdated: Date | null
  isFetching: boolean
  historicalNav?: HistoricalNavigationState
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
  const [persianYear, setPersianYear] = useState<number>(1403)

  // State for Gregorian date dropdowns
  const [gregorianDay, setGregorianDay] = useState<number>(1)
  const [gregorianMonth, setGregorianMonth] = useState<number>(1)
  const [gregorianYear, setGregorianYear] = useState<number>(2025)

  // Update dropdown states when selectedDate changes
  useEffect(() => {
    const date = historicalNav?.selectedDate ?? lastUpdated
    if (!date) return

    // Update Persian dropdowns
    const persianFormatter = new Intl.DateTimeFormat('en-u-nu-latn-ca-persian', {
      timeZone: 'Asia/Tehran',
      calendar: 'persian',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    const persianParts = persianFormatter.formatToParts(date)
    const pYear = parseInt(persianParts.find(p => p.type === 'year')?.value || '1403')
    const pMonth = parseInt(persianParts.find(p => p.type === 'month')?.value || '1')
    const pDay = parseInt(persianParts.find(p => p.type === 'day')?.value || '1')
    setPersianYear(pYear)
    setPersianMonth(pMonth)
    setPersianDay(pDay)

    // Update Gregorian dropdowns
    setGregorianYear(date.getFullYear())
    setGregorianMonth(date.getMonth() + 1)
    setGregorianDay(date.getDate())
  }, [historicalNav?.selectedDate, lastUpdated])

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
    // Create a date object from Persian calendar values
    // We'll use a simple approximation by creating a date in Gregorian and adjusting
    // For production, use a proper Persian calendar library like @persian-tools/persian-tools

    // Create a date string in Persian format that Intl can parse
    const persianDateString = `${persianYear}/${persianMonth.toString().padStart(2, '0')}/${persianDay.toString().padStart(2, '0')}`

    // Use Intl to parse Persian date to Gregorian
    // This is approximate - for accurate conversion use a library
    try {
      // Create a date by approximating Persian to Gregorian
      // Persian year 1403 ≈ Gregorian 2024/2025
      const gregorianYear = persianYear + 621
      const gregorianDate = new Date(gregorianYear, persianMonth - 1, persianDay)

      if (historicalNav) {
        historicalNav.setDate(gregorianDate)
      }
      setActiveDropdown(null)
    } catch (error) {
      console.error('Error converting Persian date:', error)
    }
  }

  // Handle applying the Gregorian date from dropdowns
  const handleApplyGregorianDate = () => {
    try {
      const gregorianDate = new Date(gregorianYear, gregorianMonth - 1, gregorianDay)

      if (historicalNav) {
        historicalNav.setDate(gregorianDate)
      }
      setActiveDropdown(null)
    } catch (error) {
      console.error('Error creating Gregorian date:', error)
    }
  }

  return (
    <div className="flex items-center gap-4" role="region" aria-label={t('lastUpdated')}>
      {/* Left Navigation Button - Previous Day / Yesterday */}
   {historicalNav && (
  <button
    onClick={historicalNav.goToPreviousDay}
    disabled={!historicalNav.canGoBack || isFetching}
    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

    <span className="hidden sm:inline">
      {historicalNav.isToday ? t('goToYesterday') || 'Yesterday' : t('previousDay')}
    </span>
  </button>
)}

      {/* Last Updated Time Display */}
      <div className="flex items-center gap-3 text-text-secondary" aria-busy={isFetching}>
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
            <div className="flex flex-col gap-1 text-apple-caption text-text-tertiary relative">
              {/* Persian Date - Day/Month/Year Dropdowns */}
              <div
                className="flex gap-1 items-center"
                dir={locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'}
                onClick={() => setActiveDropdown('persian')}
              >
                <select
                  value={persianYear}
                  onChange={(e) => setPersianYear(parseInt(e.target.value))}
                  className="bg-transparent border border-border-light hover:border-accent rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-text-tertiary text-xs"
                  dir="ltr"
                >
                  {Array.from({ length: 50 }, (_, i) => 1403 - i).map(year => (
                    <option key={year} value={year}>{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(year) : year}</option>
                  ))}
                </select>
                <span className="text-text-tertiary">/</span>
                <select
                  value={persianMonth}
                  onChange={(e) => setPersianMonth(parseInt(e.target.value))}
                  className="bg-transparent border border-border-light hover:border-accent rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-text-tertiary text-xs"
                  dir="ltr"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(month).padStart(2, '۰') : month.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="text-text-tertiary">/</span>
                <select
                  value={persianDay}
                  onChange={(e) => setPersianDay(parseInt(e.target.value))}
                  className="bg-transparent border border-border-light hover:border-accent rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-text-tertiary text-xs"
                  dir="ltr"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>
                      {locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(day).padStart(2, '۰') : day.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gregorian Date - Day/Month/Year Dropdowns */}
              <div
                className="flex gap-1 items-center"
                onClick={() => setActiveDropdown('gregorian')}
              >
                <select
                  value={gregorianYear}
                  onChange={(e) => setGregorianYear(parseInt(e.target.value))}
                  className="bg-transparent border border-border-light hover:border-accent rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-text-tertiary text-xs"
                >
                  {Array.from({ length: 50 }, (_, i) => 2025 - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <span className="text-text-tertiary">-</span>
                <select
                  value={gregorianMonth}
                  onChange={(e) => setGregorianMonth(parseInt(e.target.value))}
                  className="bg-transparent border border-border-light hover:border-accent rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-text-tertiary text-xs"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>{month.toString().padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="text-text-tertiary">-</span>
                <select
                  value={gregorianDay}
                  onChange={(e) => setGregorianDay(parseInt(e.target.value))}
                  className="bg-transparent border border-border-light hover:border-accent rounded px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent text-text-tertiary text-xs"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons - Shows when dropdown is active */}
              {activeDropdown && (
                <div className="absolute top-full left-0 mt-1 flex gap-2 z-10">
                  <button
                    onClick={() => activeDropdown === 'persian' ? handleApplyPersianDate() : handleApplyGregorianDate()}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-all shadow-lg whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    aria-label="Go to selected date"
                  >
                    {t('go')}
                  </button>
                  <button
                    onClick={() => handleOpenPicker(activeDropdown)}
                    className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-all shadow-lg whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                    aria-label={activeDropdown === 'persian' ? t('openDatePickerPersian') : t('openDatePickerGregorian')}
                  >
                    {t('openDatePicker')}
                  </button>
                </div>
              )}
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

      {/* Right Navigation Button - Today / Next Day */}
     {historicalNav && (
  <button
    onClick={historicalNav.canGoForward ? historicalNav.goToNextDay : historicalNav.goToToday}
    disabled={historicalNav.isToday || isFetching}
    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
    aria-label={historicalNav.canGoForward ? t('nextDay') : t('today')}
    title={historicalNav.canGoForward ? t('nextDay') : t('today')}
    aria-disabled={historicalNav.isToday || isFetching}
  >
    <span className="hidden sm:inline">
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
