import { useMemo } from 'react'
import {
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
} from '@/lib/store/services/api'
import { computeMarketState } from '@/lib/utils/marketDataUtils'

// Disable polling to prevent hitting rate limits
// Users can manually refresh using the refresh button
const POLLING_INTERVAL = 0 // Disabled - was 5 minutes (300000)

/**
 * Hook to consolidate all market data queries (currencies, crypto, gold)
 * Provides unified state and refetch functions
 *
 * Note: Polling is disabled to prevent 429 rate limit errors.
 * Users can manually refresh data using the refresh button.
 */
export const useMarketData = () => {
  const {
    data: currencies,
    isLoading: currenciesLoading,
    isFetching: currenciesFetching,
    error: currenciesError,
    refetch: refetchCurrencies,
  } = useGetCurrenciesQuery(undefined, {
    pollingInterval: POLLING_INTERVAL,
  })

  const {
    data: crypto,
    isLoading: cryptoLoading,
    isFetching: cryptoFetching,
    error: cryptoError,
    refetch: refetchCrypto,
  } = useGetCryptoQuery(undefined, {
    pollingInterval: POLLING_INTERVAL,
  })

  const {
    data: gold,
    isLoading: goldLoading,
    isFetching: goldFetching,
    error: goldError,
    refetch: refetchGold,
  } = useGetGoldQuery(undefined, {
    pollingInterval: POLLING_INTERVAL,
  })

  // Memoize computed state to prevent unnecessary re-renders
  const computedState = useMemo(
    () =>
      computeMarketState({
        currenciesLoading,
        cryptoLoading,
        goldLoading,
        currenciesFetching,
        cryptoFetching,
        goldFetching,
        currenciesError,
        cryptoError,
        goldError,
        currencies,
        crypto,
        gold,
      }),
    [
      currenciesLoading,
      cryptoLoading,
      goldLoading,
      currenciesFetching,
      cryptoFetching,
      goldFetching,
      currenciesError,
      cryptoError,
      goldError,
      currencies,
      crypto,
      gold,
    ]
  )

  const refetchAll = async () => {
    await Promise.all([refetchCurrencies(), refetchCrypto(), refetchGold()])
  }

  return {
    // Data
    currencies,
    crypto,
    gold,
    // Loading states
    currenciesLoading,
    cryptoLoading,
    goldLoading,
    // Fetching states
    currenciesFetching,
    cryptoFetching,
    goldFetching,
    // Errors
    currenciesError,
    cryptoError,
    goldError,
    // Refetch functions
    refetchCurrencies,
    refetchCrypto,
    refetchGold,
    refetchAll,
    // Computed state
    ...computedState,
  }
}
