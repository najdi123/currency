'use client'

import { memo } from 'react'
import { DataSection } from '@/components/DataSection'
import {
  currencyItems,
  cryptoItems,
  goldItems,
} from '@/lib/utils/dataItemHelpers'
import { FaDollarSign, FaBitcoin } from 'react-icons/fa'
import { GiGoldBar } from 'react-icons/gi'
import type { ItemType } from '@/types/chart'
import type { ViewMode } from '@/lib/hooks/useViewModePreference'

interface MarketDataSectionsProps {
  /** Market data for currencies */
  currencies: Record<string, any> | undefined
  /** Market data for cryptocurrencies */
  crypto: Record<string, any> | undefined
  /** Market data for gold */
  gold: Record<string, any> | undefined
  /** Loading states */
  currenciesLoading: boolean
  cryptoLoading: boolean
  goldLoading: boolean
  /** Error states */
  currenciesError: unknown
  cryptoError: unknown
  goldError: unknown
  /** Fetching states (refreshing) */
  currenciesFetching: boolean
  cryptoFetching: boolean
  goldFetching: boolean
  /** Current view mode for mobile */
  mobileViewMode: ViewMode
  /** Callback when an item is clicked */
  onItemClick: (itemKey: string, itemType: ItemType) => void
  /** Refetch functions */
  refetchCurrencies: () => void
  refetchCrypto: () => void
  refetchGold: () => void
  /** Translation function for Home namespace */
  t: (key: string) => string
}

/**
 * Component that renders all three market data sections:
 * - Currencies
 * - Cryptocurrencies
 * - Gold & Coins
 *
 * Wrapped with React.memo for performance optimization.
 */
function MarketDataSectionsComponent({
  currencies,
  crypto,
  gold,
  currenciesLoading,
  cryptoLoading,
  goldLoading,
  currenciesError,
  cryptoError,
  goldError,
  currenciesFetching,
  cryptoFetching,
  goldFetching,
  mobileViewMode,
  onItemClick,
  refetchCurrencies,
  refetchCrypto,
  refetchGold,
  t,
}: MarketDataSectionsProps) {
  return (
    <div className="space-y-8 sm:space-y-10 lg:space-y-12">
      {/* SECTION 1: Currencies */}
      <DataSection
        title={t('sections.currencies')}
        headingId="currencies-heading"
        icon={FaDollarSign}
        items={currencyItems}
        data={currencies}
        isLoading={currenciesLoading}
        error={currenciesError}
        itemType="currency"
        accentColor="blue"
        viewMode={mobileViewMode}
        onItemClick={(key) => onItemClick(key, 'currency')}
        onRetry={refetchCurrencies}
        errorTitle={t('errors.currencies')}
        boundaryName="CurrenciesGrid"
        isRefreshing={currenciesFetching}
        category="currencies"
      />

      {/* SECTION 2: Cryptocurrencies */}
      <DataSection
        title={t('sections.crypto')}
        headingId="crypto-heading"
        icon={FaBitcoin}
        items={cryptoItems}
        data={crypto}
        isLoading={cryptoLoading}
        error={cryptoError}
        itemType="crypto"
        accentColor="purple"
        viewMode={mobileViewMode}
        onItemClick={(key) => onItemClick(key, 'crypto')}
        onRetry={refetchCrypto}
        errorTitle={t('errors.crypto')}
        boundaryName="CryptoGrid"
        isRefreshing={cryptoFetching}
        category="crypto"
      />

      {/* SECTION 3: Gold & Coins */}
      <DataSection
        title={t('sections.gold')}
        headingId="gold-heading"
        icon={GiGoldBar}
        items={goldItems}
        data={gold}
        isLoading={goldLoading}
        error={goldError}
        itemType="gold"
        accentColor="gold"
        viewMode={mobileViewMode}
        onItemClick={(key) => onItemClick(key, 'gold')}
        onRetry={refetchGold}
        errorTitle={t('errors.gold')}
        boundaryName="GoldGrid"
        isRefreshing={goldFetching}
        category="gold"
      />
    </div>
  )
}

export const MarketDataSections = memo(MarketDataSectionsComponent)
