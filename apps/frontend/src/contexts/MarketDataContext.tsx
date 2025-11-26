'use client'

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useMarketData } from '@/lib/hooks/useMarketData'
import { useRefreshNotification } from '@/lib/hooks/useRefreshNotification'
import { useLastUpdatedTimestamp } from '@/lib/hooks/useLastUpdatedTimestamp'
import { useHistoricalNavigation, type HistoricalNavigationState } from '@/hooks/useHistoricalNavigation'
import { useChartBottomSheet } from '@/lib/hooks/useChartBottomSheet'
import { useViewModePreference } from '@/lib/hooks/useViewModePreference'
import { getItemData, getItemName } from '@/lib/utils/dataItemHelpers'
import { mapItemCodeToApi } from '@/lib/utils/chartUtils'
import type { ItemType, SelectedChartItem } from '@/types/chart'

/**
 * Market data from RTK Query
 */
interface MarketDataState {
  currencies: Record<string, any> | undefined
  crypto: Record<string, any> | undefined
  gold: Record<string, any> | undefined
  coins: Record<string, any> | undefined
  currenciesLoading: boolean
  cryptoLoading: boolean
  goldLoading: boolean
  coinsLoading: boolean
  currenciesFetching: boolean
  cryptoFetching: boolean
  goldFetching: boolean
  coinsFetching: boolean
  currenciesError: unknown
  cryptoError: unknown
  goldError: unknown
  coinsError: unknown
  isRefreshing: boolean
  isFetching: boolean
  hasAllErrors: boolean
  refetchCurrencies: () => void
  refetchCrypto: () => void
  refetchGold: () => void
  refetchCoins: () => void
  refetchAll: () => Promise<void>
}

/**
 * Chart bottom sheet state
 */
interface ChartSheetState {
  isOpen: boolean
  selectedItem: SelectedChartItem | null
  openChart: (item: SelectedChartItem) => void
  closeChart: () => void
}

/**
 * Refresh notification state
 */
interface RefreshNotificationState {
  showSuccess: boolean
  isStaleData: boolean
  staleDataTime: Date | null
  handleRefresh: () => Promise<void>
}

/**
 * View mode preference
 */
type ViewMode = 'single' | 'dual'

interface ViewModeState {
  mobileViewMode: ViewMode
  setMobileViewMode: (mode: ViewMode) => void
}

/**
 * Complete market data context value
 */
interface MarketDataContextValue {
  // Raw market data
  marketData: MarketDataState
  // Historical navigation
  historicalNav: HistoricalNavigationState
  // Chart bottom sheet
  chartSheet: ChartSheetState
  // Refresh notification
  refreshNotification: RefreshNotificationState
  // View mode
  viewMode: ViewModeState
  // Computed values
  lastUpdated: Date | null
  // Handlers
  handleItemClick: (itemKey: string, itemType: ItemType) => void
  // Locale
  locale: string
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null)

/**
 * Hook to access market data context
 * @throws Error if used outside of MarketDataProvider
 */
export function useMarketDataContext(): MarketDataContextValue {
  const context = useContext(MarketDataContext)
  if (!context) {
    throw new Error('useMarketDataContext must be used within a MarketDataProvider')
  }
  return context
}

interface MarketDataProviderProps {
  children: ReactNode
}

/**
 * Provider component that manages all market data state
 * Centralizes data fetching and state management for the home page
 */
export function MarketDataProvider({ children }: MarketDataProviderProps) {
  const t = useTranslations('Home')
  const locale = useLocale()

  // View mode preference
  const { mobileViewMode, setMobileViewMode } = useViewModePreference()

  // Historical navigation using browser's Tehran timezone calculation
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

  // Chart bottom sheet state
  const chartSheet = useChartBottomSheet()

  // Refresh notification state
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

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<MarketDataContextValue>(
    () => ({
      marketData,
      historicalNav,
      chartSheet,
      refreshNotification: {
        showSuccess,
        isStaleData,
        staleDataTime,
        handleRefresh,
      },
      viewMode: {
        mobileViewMode,
        setMobileViewMode,
      },
      lastUpdated,
      handleItemClick,
      locale,
    }),
    [
      marketData,
      historicalNav,
      chartSheet,
      showSuccess,
      isStaleData,
      staleDataTime,
      handleRefresh,
      mobileViewMode,
      setMobileViewMode,
      lastUpdated,
      handleItemClick,
      locale,
    ]
  )

  return (
    <MarketDataContext.Provider value={contextValue}>
      {children}
    </MarketDataContext.Provider>
  )
}
