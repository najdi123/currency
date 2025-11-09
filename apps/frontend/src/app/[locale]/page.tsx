'use client'

import { lazy, Suspense, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageHeader } from '@/components/PageHeader'
import { SuccessNotification } from '@/components/SuccessNotification'
import { StaleDataWarning } from '@/components/StaleDataWarning'
import { GlobalErrorDisplay } from '@/components/GlobalErrorDisplay'
import { RateLimitBanner } from '@/components/RateLimitBanner'
import { DataSection } from '@/components/DataSection'
import { useChartBottomSheet } from '@/lib/hooks/useChartBottomSheet'
import { useViewModePreference } from '@/lib/hooks/useViewModePreference'
import { useMarketData } from '@/lib/hooks/useMarketData'
import { useRefreshNotification } from '@/lib/hooks/useRefreshNotification'
import { useChartPreload } from '@/lib/hooks/useChartPreload'
import { useLastUpdatedTimestamp } from '@/lib/hooks/useLastUpdatedTimestamp'
import { mapItemCodeToApi } from '@/lib/utils/chartUtils'
import {
  currencyItems,
  cryptoItems,
  goldItems,
  getItemData,
  getItemName,
} from '@/lib/utils/dataItemHelpers'
import type { ItemType, SelectedChartItem } from '@/types/chart'
import { FaDollarSign, FaBitcoin } from 'react-icons/fa'
import { GiGoldBar } from 'react-icons/gi'
import { FiInfo } from 'react-icons/fi'

// Lazy load chart component to reduce initial bundle size
const ChartBottomSheet = lazy<
  React.ComponentType<{
    isOpen: boolean
    onClose: () => void
    item: SelectedChartItem | null
  }>
>(() =>
  import(
    /* webpackChunkName: "chart-bottom-sheet" */
    /* webpackPrefetch: true */
    '@/components/ChartBottomSheet'
  ).then((mod) => ({ default: mod.ChartBottomSheet }))
)

export default function Home() {
  const t = useTranslations('Home')

  // Custom hooks for state management
  const { mobileViewMode, setMobileViewMode } = useViewModePreference()
  const marketData = useMarketData()
  const chartSheet = useChartBottomSheet()

  // Debug: Log metadata to verify stale data detection
  console.log('[Page] Currencies metadata:', marketData.currencies?._metadata)
  console.log('[Page] Crypto metadata:', marketData.crypto?._metadata)
  console.log('[Page] Gold metadata:', marketData.gold?._metadata)

  const lastUpdated = useLastUpdatedTimestamp(
    marketData.currencies,
    marketData.crypto,
    marketData.gold,
    marketData.currenciesError,
    marketData.cryptoError,
    marketData.goldError
  )

  const { showSuccess, isStaleData, staleDataTime, handleRefresh } = useRefreshNotification(
    marketData.currenciesFetching,
    marketData.cryptoFetching,
    marketData.goldFetching,
    marketData.currencies,
    marketData.crypto,
    marketData.gold,
    marketData.currenciesError,
    marketData.cryptoError,
    marketData.goldError,
    marketData.refetchAll
  )

  // Preload chart component for better UX
  useChartPreload()

  // Handler for chart click - memoized to prevent unnecessary re-renders
  const handleItemClick = useCallback((itemKey: string, itemType: ItemType) => {
    const itemData = getItemData(
      itemKey,
      itemType,
      marketData.currencies,
      marketData.crypto,
      marketData.gold
    )
    if (itemData) {
      chartSheet.openChart({
        code: mapItemCodeToApi(itemKey),
        name: getItemName(itemKey, itemType, t),
        type: itemType,
        price: itemData.value,
        change: itemData.change,
      })
    }
  }, [marketData.currencies, marketData.crypto, marketData.gold, chartSheet, t])

  return (
    <div className="min-h-screen bg-background-base">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent-primary focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        {t('skipToMain')}
      </a>
      <div className="max-w-7xl mx-auto">
        {/* Main Header */}
        <PageHeader
          mobileViewMode={mobileViewMode}
          onViewModeChange={setMobileViewMode}
          onRefresh={handleRefresh}
          isRefreshing={marketData.isRefreshing}
          isFetching={marketData.isFetching}
          lastUpdated={lastUpdated}
          isLoading={
            marketData.currenciesLoading || marketData.cryptoLoading || marketData.goldLoading
          }
        />

        {/* Success Notification */}
        <SuccessNotification
          show={showSuccess}
          isStaleData={isStaleData}
          staleDataTime={staleDataTime}
        />

        {/* ARIA Live Region for Screen Readers */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {(marketData.currenciesFetching ||
            marketData.cryptoFetching ||
            marketData.goldFetching) &&
            t('aria.updating')}
          {!marketData.currenciesFetching &&
            !marketData.cryptoFetching &&
            !marketData.goldFetching &&
            lastUpdated &&
            t('aria.updated', { time: new Date(lastUpdated).toLocaleTimeString('fa-IR') })}
        </div>

        {/* Content Container */}
        <div id="main-content" className="px-3 xl:px-4 sm:px-6 lg:px-8">
          {/* Stale Data Warning Banner - Check if any data is marked as stale by backend */}
          {(marketData.currencies?._metadata?.isStale ||
            marketData.crypto?._metadata?.isStale ||
            marketData.gold?._metadata?.isStale) && (
            <StaleDataWarning lastUpdated={lastUpdated} onRetry={handleRefresh} />
          )}

          {/* Rate Limit Banner - Show when API returns 429 but we have cached data */}
          {(marketData.currenciesError || marketData.cryptoError || marketData.goldError) &&
            (marketData.currencies || marketData.crypto || marketData.gold) && (
            <RateLimitBanner />
          )}

          {/* Global Error Message - only show if no cached data at all */}
          {marketData.hasAllErrors &&
            !marketData.currencies &&
            !marketData.crypto &&
            !marketData.gold && <GlobalErrorDisplay onRetry={handleRefresh} />}

          <div className="space-y-8 sm:space-y-10 lg:space-y-12">
            {/* SECTION 1: Currencies */}
            <DataSection
              title={t('sections.currencies')}
              headingId="currencies-heading"
              icon={FaDollarSign}
              items={currencyItems}
              data={marketData.currencies}
              isLoading={marketData.currenciesLoading}
              error={marketData.currenciesError}
              itemType="currency"
              accentColor="blue"
              viewMode={mobileViewMode}
              onItemClick={(key) => handleItemClick(key, 'currency')}
              onRetry={marketData.refetchCurrencies}
              errorTitle={t('errors.currencies')}
              boundaryName="CurrenciesGrid"
              isRefreshing={marketData.currenciesFetching}
              category="currencies"
            />

            {/* SECTION 2: Cryptocurrencies */}
            <DataSection
              title={t('sections.crypto')}
              headingId="crypto-heading"
              icon={FaBitcoin}
              items={cryptoItems}
              data={marketData.crypto}
              isLoading={marketData.cryptoLoading}
              error={marketData.cryptoError}
              itemType="crypto"
              accentColor="purple"
              viewMode={mobileViewMode}
              onItemClick={(key) => handleItemClick(key, 'crypto')}
              onRetry={marketData.refetchCrypto}
              errorTitle={t('errors.crypto')}
              boundaryName="CryptoGrid"
              isRefreshing={marketData.cryptoFetching}
              category="crypto"
            />

            {/* SECTION 3: Gold & Coins */}
            <DataSection
              title={t('sections.gold')}
              headingId="gold-heading"
              icon={GiGoldBar}
              items={goldItems}
              data={marketData.gold}
              isLoading={marketData.goldLoading}
              error={marketData.goldError}
              itemType="gold"
              accentColor="gold"
              viewMode={mobileViewMode}
              onItemClick={(key) => handleItemClick(key, 'gold')}
              onRetry={marketData.refetchGold}
              errorTitle={t('errors.gold')}
              boundaryName="GoldGrid"
              isRefreshing={marketData.goldFetching}
              category="gold"
            />
          </div>

          {/* Footer */}
          <div
            className="text-center mt-8 sm:mt-10 lg:mt-12 py-6 border-t border-border-light"
          >
            <p className="text-apple-caption text-text-secondary flex items-center justify-center gap-2">
              <FiInfo className="text-base" aria-hidden="true" />
              <span>{t('footer.autoUpdate')}</span>
            </p>
          </div>

          {/* Chart Bottom Sheet - Lazy loaded for performance */}
          <ErrorBoundary
            boundaryName="ChartLazyLoad"
            fallback={(_error, reset) =>
              // Only show error UI if chart is open
              chartSheet.isOpen ? (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                  onClick={chartSheet.closeChart}
                >
                  <div
                    className="bg-surface rounded-lg p-6 shadow-xl max-w-md mx-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-center">
                      <div className="mb-4 text-red-500 text-5xl">⚠️</div>
                      <h3 className="text-lg font-semibold text-error-text mb-2">
                        {t('chart.loadError')}
                      </h3>
                      <p className="text-text-secondary mb-4 text-sm">
                        {t('chart.loadErrorMessage')}
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => {
                            reset()
                            window.location.reload()
                          }}
                          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          {t('chart.retry')}
                        </button>
                        <button
                          onClick={chartSheet.closeChart}
                          className="bg-gray-200 dark:bg-gray-700 text-text-primary px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                          {t('chart.close')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null
            }
          >
            <Suspense
              fallback={
                // Only show loading UI if chart is open
                chartSheet.isOpen ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-surface rounded-lg p-6 shadow-xl">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-text-primary text-sm">
                          {t('chart.loading')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            >
              <ChartBottomSheet
                isOpen={chartSheet.isOpen}
                onClose={chartSheet.closeChart}
                item={chartSheet.selectedItem}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
