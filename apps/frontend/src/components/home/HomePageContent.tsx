'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageHeader } from '@/components/PageHeader'
import { SearchBar } from '@/components/SearchBar'
import { SuccessNotification } from '@/components/SuccessNotification'
import { StaleDataWarning } from '@/components/StaleDataWarning'
import { GlobalErrorDisplay } from '@/components/GlobalErrorDisplay'
import { HistoricalBanners } from '@/components/home/HistoricalBanners'
import { MarketDataSections } from '@/components/home/MarketDataSections'
import { PDFErrorNotification } from '@/components/notifications/PDFErrorNotification'
import { ChartLayerWithBoundary } from '@/components/Chart/ChartLayerWithBoundary'
import { CalculatorLayer } from '@/components/Calculator/CalculatorLayer'
import { useChartBottomSheet } from '@/lib/hooks/useChartBottomSheet'
import { useViewModePreference } from '@/lib/hooks/useViewModePreference'
import { useMarketData } from '@/lib/hooks/useMarketData'
import { useRefreshNotification } from '@/lib/hooks/useRefreshNotification'
import { useChartPreload } from '@/lib/hooks/useChartPreload'
import { useLastUpdatedTimestamp } from '@/lib/hooks/useLastUpdatedTimestamp'
import { useHistoricalNavigation } from '@/hooks/useHistoricalNavigation'
import { useCalculatorSync } from '@/hooks/useCalculatorSync'
import { usePDFGeneration } from '@/hooks/usePDFGeneration'
import { useAppSelector, useAppDispatch } from '@/lib/hooks'
import {
  selectCalculatorTotal,
  removeItem,
  clearAllItems,
} from '@/lib/store/slices/calculatorSlice'
import { getItemData, getItemName } from '@/lib/utils/dataItemHelpers'
import { mapItemCodeToApi } from '@/lib/utils/chartUtils'
import type { ItemType } from '@/types/chart'
import { FiInfo } from 'react-icons/fi'

/**
 * Main content component for the home page.
 * Orchestrates all the sub-components and manages state.
 */
export function HomePageContent() {
  const t = useTranslations('Home')
  const t2 = useTranslations('Chart')
  const tCalc = useTranslations('Calculator')
  const dispatch = useAppDispatch()

  // Custom hooks for state management
  const { mobileViewMode, setMobileViewMode } = useViewModePreference()

  // Local state for details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)

  // Initialize historical navigation using browser's Tehran timezone calculation
  const historicalNav = useHistoricalNavigation()

  // Get market data for the selected date (or today if none selected)
  const marketData = useMarketData(historicalNav.selectedDate)

  // Calculator state with date synchronization
  const { isCalculatorMode, calculatorItems, calculatorDate } = useCalculatorSync({
    marketData: {
      currencies: marketData.currencies,
      crypto: marketData.crypto,
      gold: marketData.gold,
      currenciesLoading: marketData.currenciesLoading,
      cryptoLoading: marketData.cryptoLoading,
      goldLoading: marketData.goldLoading,
    },
    formattedDate: historicalNav.formattedDate,
  })

  // Calculator total from Redux
  const calculatorTotal = useAppSelector(selectCalculatorTotal)

  // PDF generation hook
  const { isGeneratingPDF, pdfError, handleSaveAsPDF, clearPdfError } = usePDFGeneration({
    items: calculatorItems,
    totalValue: calculatorTotal,
    currentDate: calculatorDate,
  })

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
  const handleItemClick = useCallback(
    (itemKey: string, itemType: ItemType) => {
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
    },
    [marketData.currencies, marketData.crypto, marketData.gold, chartSheet, t]
  )

  // Calculator bottom nav handlers
  const handleSeeDetails = useCallback(() => {
    setDetailsModalOpen(true)
  }, [])

  const handleCloseDetails = useCallback(() => {
    setDetailsModalOpen(false)
  }, [])

  const handleRemoveItem = useCallback(
    (id: string) => {
      dispatch(removeItem(id))
    },
    [dispatch]
  )

  const handleClearAll = useCallback(() => {
    if (confirm(tCalc('confirmClearAll'))) {
      dispatch(clearAllItems())
    }
  }, [dispatch, tCalc])

  return (
    <div
      className={`${isCalculatorMode ? 'h-screen flex flex-col' : 'min-h-screen'} bg-background-base`}
    >
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent-primary focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        {t('skipToMain')}
      </a>

      {/* Scrollable content area in calculator mode - includes header */}
      <div className={`${isCalculatorMode ? 'flex-1 overflow-y-auto' : ''}`}>
        <div className="max-w-7xl mx-auto w-full">
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

          {/* Content Container */}
          <div id="main-content" className="px-3 xl:px-4 sm:px-6 lg:px-8">
            {/* Historical Data Banners */}
            <HistoricalBanners
              historicalNav={historicalNav}
              currenciesError={marketData.currenciesError}
              cryptoError={marketData.cryptoError}
              goldError={marketData.goldError}
              currencies={marketData.currencies}
              crypto={marketData.crypto}
              gold={marketData.gold}
            />

            {/* Global Error Message - only show if no cached data at all */}
            {marketData.hasAllErrors &&
              !marketData.currencies &&
              !marketData.crypto &&
              !marketData.gold && <GlobalErrorDisplay onRetry={handleRefresh} />}

            {/* Market Data Sections */}
            <MarketDataSections
              currencies={marketData.currencies}
              crypto={marketData.crypto}
              gold={marketData.gold}
              currenciesLoading={marketData.currenciesLoading}
              cryptoLoading={marketData.cryptoLoading}
              goldLoading={marketData.goldLoading}
              currenciesError={marketData.currenciesError}
              cryptoError={marketData.cryptoError}
              goldError={marketData.goldError}
              currenciesFetching={marketData.currenciesFetching}
              cryptoFetching={marketData.cryptoFetching}
              goldFetching={marketData.goldFetching}
              mobileViewMode={mobileViewMode}
              onItemClick={handleItemClick}
              refetchCurrencies={marketData.refetchCurrencies}
              refetchCrypto={marketData.refetchCrypto}
              refetchGold={marketData.refetchGold}
              t={t}
            />

            {/* Stale Data Warning Banner - Check if any data is marked as stale by backend */}
            {(marketData.currencies?._metadata?.isStale ||
              marketData.crypto?._metadata?.isStale ||
              marketData.gold?._metadata?.isStale) && (
              <StaleDataWarning lastUpdated={lastUpdated} onRetry={handleRefresh} />
            )}

            {/* Footer */}
            <div className="text-center mt-8 sm:mt-10 lg:mt-12 py-6 border-t border-border-light">
              <p className="text-apple-caption text-text-secondary flex items-center justify-center gap-2">
                <FiInfo className="text-base" aria-hidden="true" />
                <span>{t('footer.autoUpdate')}</span>
              </p>
            </div>
          </div>
          {/* End of main-content */}
        </div>
        {/* End of max-w-7xl wrapper */}
      </div>
      {/* End of scrollable area */}

      {/* PDF Error Notification */}
      {pdfError && <PDFErrorNotification error={pdfError} onDismiss={clearPdfError} />}

      {/* Calculator Layer */}
      <CalculatorLayer
        isCalculatorMode={isCalculatorMode}
        calculatorItems={calculatorItems}
        calculatorTotal={calculatorTotal}
        calculatorDate={calculatorDate}
        detailsModalOpen={detailsModalOpen}
        isGeneratingPDF={isGeneratingPDF}
        onSeeDetails={handleSeeDetails}
        onCloseDetails={handleCloseDetails}
        onSaveAsPDF={handleSaveAsPDF}
        onRemoveItem={handleRemoveItem}
        onClearAll={handleClearAll}
      />

      {/* Chart Bottom Sheet - Lazy loaded for performance */}
      <ChartLayerWithBoundary
        isOpen={chartSheet.isOpen}
        onClose={chartSheet.closeChart}
        selectedItem={chartSheet.selectedItem}
        t2={t2}
      />
    </div>
  )
}
