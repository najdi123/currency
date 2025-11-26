'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { FiInfo } from 'react-icons/fi'
import { RateLimitBanner } from '@/components/RateLimitBanner'
import type { HistoricalNavigationState } from '@/hooks/useHistoricalNavigation'

interface HistoricalBannersProps {
  /** Historical navigation state */
  historicalNav: HistoricalNavigationState
  /** Whether currencies data has an error */
  currenciesError: unknown
  /** Whether crypto data has an error */
  cryptoError: unknown
  /** Whether gold data has an error */
  goldError: unknown
  /** Currencies data (undefined if not loaded) */
  currencies: Record<string, any> | undefined
  /** Crypto data (undefined if not loaded) */
  crypto: Record<string, any> | undefined
  /** Gold data (undefined if not loaded) */
  gold: Record<string, any> | undefined
}

/**
 * Component that displays various banners related to historical data viewing:
 * - Error banner when historical data is unavailable
 * - Info banner when viewing historical data successfully
 * - Rate limit banner when API errors occur but cached data exists
 */
function HistoricalBannersComponent({
  historicalNav,
  currenciesError,
  cryptoError,
  goldError,
  currencies,
  crypto,
  gold,
}: HistoricalBannersProps) {
  const tHistorical = useTranslations('Historical')

  const hasAnyError = currenciesError || cryptoError || goldError
  const hasAnyData = currencies || crypto || gold
  const hasNoData = !currencies && !crypto && !gold

  return (
    <>
      {/* Historical Data Error Banner - Show when historical data unavailable */}
      {!historicalNav.isToday && hasAnyError && hasNoData && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-red-800 dark:text-red-200">
            <div className="flex items-center gap-2">
              <FiInfo className="text-lg flex-shrink-0" aria-hidden="true" />
              <p className="text-sm font-medium">{tHistorical('noDataAvailable')}</p>
            </div>
            <button
              onClick={historicalNav.goToToday}
              className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {tHistorical('backToToday')}
            </button>
          </div>
        </div>
      )}

      {/* Historical Data Banner - Show when viewing historical data successfully */}
      {!historicalNav.isToday && hasAnyData && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-center gap-2 text-blue-800 dark:text-blue-200">
            <FiInfo className="text-lg flex-shrink-0" aria-hidden="true" />
            <div className="text-sm font-medium text-center">
              <p>
                {tHistorical('viewingHistoricalData', {
                  date:
                    historicalNav.selectedDate?.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) || '',
                })}
              </p>
              {(currencies?._metadata?.historicalDate ||
                crypto?._metadata?.historicalDate ||
                gold?._metadata?.historicalDate) && (
                <p className="text-xs mt-1 opacity-80">
                  {historicalNav.daysAgo === 1
                    ? tHistorical('viewingYesterdayData')
                    : tHistorical('daysAgoLabel', { count: historicalNav.daysAgo })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rate Limit Banner - Show when API returns 429 but we have cached data */}
      {hasAnyError && hasAnyData && <RateLimitBanner />}
    </>
  )
}

export const HistoricalBanners = memo(HistoricalBannersComponent)
