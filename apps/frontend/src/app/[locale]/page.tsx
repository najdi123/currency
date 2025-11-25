'use client'

import { lazy, Suspense, useCallback, useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageHeader } from '@/components/PageHeader'
import { SearchBar } from '@/components/SearchBar'
import { SuccessNotification } from '@/components/SuccessNotification'
import { StaleDataWarning } from '@/components/StaleDataWarning'
import { GlobalErrorDisplay } from '@/components/GlobalErrorDisplay'
import { RateLimitBanner } from '@/components/RateLimitBanner'
import { DataSection } from '@/components/DataSection'
import { CalculatorBottomNav } from '@/components/CalculatorBottomNav'
import { CalculatorDetailsModal } from '@/components/CalculatorDetailsModal'
import { useChartBottomSheet } from '@/lib/hooks/useChartBottomSheet'
import { useViewModePreference } from '@/lib/hooks/useViewModePreference'
import { useMarketData } from '@/lib/hooks/useMarketData'
import { useRefreshNotification } from '@/lib/hooks/useRefreshNotification'
import { useChartPreload } from '@/lib/hooks/useChartPreload'
import { useLastUpdatedTimestamp } from '@/lib/hooks/useLastUpdatedTimestamp'
import { useHistoricalNavigation } from '@/hooks/useHistoricalNavigation'
import { useAppSelector, useAppDispatch } from '@/lib/hooks'
import {
  selectCalculatorMode,
  selectCalculatorTotal,
  selectCalculatorItems,
  selectCalculatorDate,
  removeItem,
  clearAllItems,
  setCurrentDate,
  updateAllPrices,
} from '@/lib/store/slices/calculatorSlice'
import type { CalculatorItem } from '@/lib/store/slices/calculatorSlice'
import { generateCalculatorPDF } from '@/lib/utils/pdfGenerator'
import { loadPDFTranslations } from '@/lib/utils/pdfTranslations'
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
  const t2 = useTranslations('Chart')
  const tHistorical = useTranslations('Historical')
  const tCalc = useTranslations('Calculator')
  const tPDF = useTranslations('PDF')
  const locale = useLocale()
  const dispatch = useAppDispatch()

  // Custom hooks for state management
  const { mobileViewMode, setMobileViewMode } = useViewModePreference()

  // Calculator state from Redux
  const isCalculatorMode = useAppSelector(selectCalculatorMode)
  const calculatorTotal = useAppSelector(selectCalculatorTotal)
  const calculatorItems = useAppSelector(selectCalculatorItems)
  const calculatorDate = useAppSelector(selectCalculatorDate)

  // Local state for details modal and PDF generation
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  // Initialize historical navigation using browser's Tehran timezone calculation
  // This is independent of backend's system clock
  const historicalNav = useHistoricalNavigation()

  // Get market data for the selected date (or today if none selected)
  const marketData = useMarketData(historicalNav.selectedDate)

  // Calculate lastUpdated from market data
  const lastUpdated = useLastUpdatedTimestamp(
    marketData.currencies,
    marketData.crypto,
    marketData.gold,
    marketData.currenciesError,
    marketData.cryptoError,
    marketData.goldError
  )
  const chartSheet = useChartBottomSheet()

  // Debug: Log metadata to verify stale data detection
  console.log('[Page] Currencies metadata:', marketData.currencies?._metadata)
  console.log('[Page] Crypto metadata:', marketData.crypto?._metadata)
  console.log('[Page] Gold metadata:', marketData.gold?._metadata)

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

  // Calculator bottom nav handlers
  const handleSeeDetails = useCallback(() => {
    setDetailsModalOpen(true)
  }, [])

  const handleSaveAsPDF = useCallback(async (pdfLanguage?: string) => {
    // Clear previous error
    setPdfError(null)

    // Set loading state
    setIsGeneratingPDF(true)

    try {
      // Determine target language for PDF (can be different from current UI language)
      const targetLang = pdfLanguage || locale

      // Load translations dynamically for the target language
      const translations = await loadPDFTranslations(targetLang)

      await generateCalculatorPDF({
        items: calculatorItems,
        totalValue: calculatorTotal,
        currentDate: calculatorDate,
        locale,
        pdfLanguage: targetLang,
        translations,
      })

      // Success - PDF downloaded
      console.log('✅ PDF generated successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)

      // Set user-friendly error message
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to generate PDF. Please try again.'

      setPdfError(errorMessage)

      // Auto-clear error after 5 seconds
      setTimeout(() => setPdfError(null), 5000)
    } finally {
      // Clear loading state
      setIsGeneratingPDF(false)
    }
  }, [calculatorItems, calculatorTotal, calculatorDate, locale])

  const handleRemoveItem = useCallback((id: string) => {
    dispatch(removeItem(id))
  }, [dispatch])

  const handleClearAll = useCallback(() => {
    if (confirm('Are you sure you want to clear all items?')) {
      dispatch(clearAllItems())
    }
  }, [dispatch])

  // Helper function to get price for a calculator item from current market data
  const getPriceForItem = useCallback(
    (item: CalculatorItem): number => {
      const { type, subType } = item

      if (!subType) return item.unitPrice

      const key = subType.toLowerCase()

      switch (type) {
        case 'currency': {
          return marketData.currencies?.[key]?.value ?? item.unitPrice
        }
        case 'gold': {
          return marketData.gold?.[key]?.value ?? item.unitPrice
        }
        case 'coin': {
          return marketData.crypto?.[key]?.value ?? item.unitPrice
        }
        default:
          return item.unitPrice
      }
    },
    [marketData.currencies, marketData.crypto, marketData.gold]
  )

  // Date synchronization: Update calculator prices when date changes
  useEffect(() => {
    // Skip if not in calculator mode or no items
    if (!isCalculatorMode || calculatorItems.length === 0) return

    // Skip if market data is still loading
    if (marketData.currenciesLoading || marketData.cryptoLoading || marketData.goldLoading) return

    // Skip if no market data available
    if (!marketData.currencies && !marketData.crypto && !marketData.gold) return

    const currentFormattedDate = historicalNav.formattedDate ?? undefined

    // Update calculator date if it changed
    if (calculatorDate !== currentFormattedDate) {
      dispatch(setCurrentDate(currentFormattedDate))
    }

    // Update all item prices based on current market data
    const priceUpdates = calculatorItems.map((item) => ({
      id: item.id,
      unitPrice: getPriceForItem(item),
    }))

    // Only dispatch if there are actual price changes
    const hasChanges = priceUpdates.some((update) => {
      const item = calculatorItems.find((i) => i.id === update.id)
      return item && item.unitPrice !== update.unitPrice
    })

    if (hasChanges) {
      dispatch(updateAllPrices(priceUpdates))
    }
  }, [
    historicalNav.formattedDate,
    isCalculatorMode,
    calculatorItems,
    calculatorDate,
    marketData.currencies,
    marketData.crypto,
    marketData.gold,
    marketData.currenciesLoading,
    marketData.cryptoLoading,
    marketData.goldLoading,
    dispatch,
    getPriceForItem,
  ])

  return (
    <div className={`${isCalculatorMode ? 'h-screen flex flex-col' : 'min-h-screen'} bg-background-base`}>
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent-primary focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        {t('skipToMain')}
      </a>
      <div className={`max-w-7xl mx-auto ${isCalculatorMode ? 'flex-1 flex flex-col overflow-hidden' : ''} w-full`}>
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
          historicalNav={historicalNav}
        />

        {/* Search Bar */}
        <ErrorBoundary
          boundaryName="SearchBar"
          fallback={(_error, reset) => (
            <div className="px-3 sm:px-6 lg:px-8 mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                  {t('search.temporarilyUnavailable')}
                </p>
                <button
                  onClick={reset}
                  className="text-xs text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 underline"
                >
                  {t('search.tryAgain')}
                </button>
              </div>
            </div>
          )}
        >
          <SearchBar
            currencies={marketData.currencies ?? null}
            crypto={marketData.crypto ?? null}
            gold={marketData.gold ?? null}
            onItemClick={handleItemClick}
          />
        </ErrorBoundary>

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

        {/* Content Container - Scrollable in calculator mode */}
        <div
          id="main-content"
          className={`px-3 xl:px-4 sm:px-6 lg:px-8 ${isCalculatorMode ? 'flex-1 overflow-y-auto' : ''}`}
        >
          {/* Historical Data Error Banner - Show when historical data unavailable */}
          {!historicalNav.isToday && (marketData.currenciesError || marketData.cryptoError || marketData.goldError) &&
           !marketData.currencies && !marketData.crypto && !marketData.gold && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-red-800 dark:text-red-200">
                <div className="flex items-center gap-2">
                  <FiInfo className="text-lg flex-shrink-0" />
                  <p className="text-sm font-medium">
                    {tHistorical('noDataAvailable')}
                  </p>
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
          {!historicalNav.isToday && (marketData.currencies || marketData.crypto || marketData.gold) && (
            <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2 text-blue-800 dark:text-blue-200">
                <FiInfo className="text-lg flex-shrink-0" />
                <div className="text-sm font-medium text-center">
                  <p>{tHistorical('viewingHistoricalData', {
                    date: historicalNav.selectedDate?.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) || ''
                  })}</p>
                  {(marketData.currencies?._metadata?.historicalDate ||
                    marketData.crypto?._metadata?.historicalDate ||
                    marketData.gold?._metadata?.historicalDate) && (
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

          {/* Stale Data Warning Banner - Check if any data is marked as stale by backend */}
          {(marketData.currencies?._metadata?.isStale ||
            marketData.crypto?._metadata?.isStale ||
            marketData.gold?._metadata?.isStale) && (
            <StaleDataWarning lastUpdated={lastUpdated} onRetry={handleRefresh} />
          )}

          {/* Footer */}
          <div
            className="text-center mt-8 sm:mt-10 lg:mt-12 py-6 border-t border-border-light"
          >
            <p className="text-apple-caption text-text-secondary flex items-center justify-center gap-2">
              <FiInfo className="text-base" aria-hidden="true" />
              <span>{t('footer.autoUpdate')}</span>
            </p>
          </div>

        </div>

        {/* PDF Error Notification */}
        {pdfError && (
          <div
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-slide-up"
            role="alert"
            aria-live="assertive"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{pdfError}</span>
            <button
              onClick={() => setPdfError(null)}
              className="ml-2 hover:opacity-75"
              aria-label="Close error"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Calculator Bottom Navigation - Only shown in calculator mode */}
        {isCalculatorMode && (
          <CalculatorBottomNav
            totalValue={calculatorTotal}
            itemCount={calculatorItems.length}
            onSeeDetails={handleSeeDetails}
            onSaveAsPDF={handleSaveAsPDF}
            isGeneratingPDF={isGeneratingPDF}
          />
        )}

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
                      {t2('loadError')}
                    </h3>
                    <p className="text-text-secondary mb-4 text-sm">
                      {t2('loadErrorMessage')}
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          reset()
                          window.location.reload()
                        }}
                        className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {t2('retry')}
                      </button>
                      <button
                        onClick={chartSheet.closeChart}
                        className="bg-gray-200 dark:bg-gray-700 text-text-primary px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        {t2('close')}
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
                          {t2('loading')}
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

          {/* Calculator Details Modal */}
          <CalculatorDetailsModal
            isOpen={detailsModalOpen}
            onClose={() => setDetailsModalOpen(false)}
            items={calculatorItems}
            totalValue={calculatorTotal}
            currentDate={calculatorDate}
            onRemoveItem={handleRemoveItem}
            onClearAll={handleClearAll}
          />
        </div>
      </div>
  )
}
