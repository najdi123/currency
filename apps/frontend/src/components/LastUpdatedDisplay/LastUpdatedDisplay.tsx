'use client'

import { useTranslations, useLocale } from 'next-intl'
import { FiClock, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { HiCalendar } from 'react-icons/hi'
import type { HistoricalNavigationState } from '@/hooks/useHistoricalNavigation'

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

  return (
    <div className="flex items-center gap-4">
      {/* Left Navigation Button - Previous Day / Yesterday */}
      {historicalNav && (
        <button
          onClick={historicalNav.goToPreviousDay}
          disabled={!historicalNav.canGoBack || isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={historicalNav.isToday ? t('goToYesterday') || 'Go to Yesterday' : t('previousDay')}
          title={historicalNav.isToday ? t('goToYesterday') || 'Go to Yesterday' : t('previousDay')}
        >
          <FiChevronLeft className="text-base" aria-hidden="true" />
          <span className="hidden sm:inline">
            {historicalNav.isToday ? t('goToYesterday') || 'Yesterday' : t('previousDay')}
          </span>
        </button>
      )}

      {/* Last Updated Time Display */}
      <div className="flex items-center gap-3 text-text-secondary">
      <span className="relative flex h-3 w-3" aria-hidden="true">
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
            <div className="flex flex-col gap-0.5 text-apple-caption text-text-tertiary">
              <div>
                {new Intl.DateTimeFormat('fa-IR', {
                  timeZone: 'Asia/Tehran',
                  calendar: 'persian',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }).format(historicalNav && historicalNav.selectedDate ? historicalNav.selectedDate : lastUpdated)}
              </div>
              <div>
                {new Intl.DateTimeFormat('en-US', {
                  timeZone: 'Asia/Tehran',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                }).format(historicalNav && historicalNav.selectedDate ? historicalNav.selectedDate : lastUpdated)}
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

      {/* Right Navigation Button - Today / Next Day */}
      {historicalNav && (
        <button
          onClick={historicalNav.canGoForward ? historicalNav.goToNextDay : historicalNav.goToToday}
          disabled={historicalNav.isToday || isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          aria-label={historicalNav.canGoForward ? t('nextDay') : t('today')}
          title={historicalNav.canGoForward ? t('nextDay') : t('today')}
        >
          <span className="hidden sm:inline">
            {historicalNav.canGoForward ? t('nextDay') : t('today')}
          </span>
          {historicalNav.canGoForward ? (
            <FiChevronRight className="text-base" aria-hidden="true" />
          ) : (
            <HiCalendar className="text-base" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  )
}
