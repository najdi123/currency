import { useMemo } from 'react'
import {
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
  useGetCurrenciesHistoricalQuery,
  useGetCryptoHistoricalQuery,
  useGetGoldHistoricalQuery,
} from '@/lib/store/services/api'
import { computeMarketState } from '@/lib/utils/marketDataUtils'
import { formatDateForApi } from '@/lib/utils/dateUtils'

// Disable polling to prevent hitting rate limits
// Users can manually refresh using the refresh button
const POLLING_INTERVAL = 0 // Disabled - was 5 minutes (300000)

/**
 * Hook to consolidate all market data queries (currencies, crypto, gold)
 * Provides unified state and refetch functions
 *
 * Note: Polling is disabled to prevent 429 rate limit errors.
 * Users can manually refresh data using the refresh button.
 *
 * @param selectedDate - Date to fetch data for (null = today/current)
 */
export const useMarketData = (selectedDate: Date | null = null) => {
  // Determine if we're fetching historical data
  const isHistorical = selectedDate !== null
  const dateParam = isHistorical ? formatDateForApi(selectedDate) : ''

  // Current data queries (always enabled when not historical)
  const currenciesCurrentQuery = useGetCurrenciesQuery(undefined, {
    pollingInterval: POLLING_INTERVAL,
    skip: isHistorical,
  })

  const cryptoCurrentQuery = useGetCryptoQuery(undefined, {
    pollingInterval: POLLING_INTERVAL,
    skip: isHistorical,
  })

  const goldCurrentQuery = useGetGoldQuery(undefined, {
    pollingInterval: POLLING_INTERVAL,
    skip: isHistorical,
  })

  // Historical data queries (enabled when historical date selected)
  const currenciesHistoricalQuery = useGetCurrenciesHistoricalQuery(dateParam || '', {
    pollingInterval: POLLING_INTERVAL,
    skip: !isHistorical || !dateParam,
  })

  const cryptoHistoricalQuery = useGetCryptoHistoricalQuery(dateParam || '', {
    pollingInterval: POLLING_INTERVAL,
    skip: !isHistorical || !dateParam,
  })

  const goldHistoricalQuery = useGetGoldHistoricalQuery(dateParam || '', {
    pollingInterval: POLLING_INTERVAL,
    skip: !isHistorical || !dateParam,
  })

  // Select the appropriate query result based on mode
  const currenciesQuery = isHistorical ? currenciesHistoricalQuery : currenciesCurrentQuery
  const cryptoQuery = isHistorical ? cryptoHistoricalQuery : cryptoCurrentQuery
  const goldQuery = isHistorical ? goldHistoricalQuery : goldCurrentQuery

  const {
    data: currencies,
    isLoading: currenciesLoading,
    isFetching: currenciesFetching,
    error: currenciesError,
    refetch: refetchCurrencies,
  } = currenciesQuery

  const {
    data: crypto,
    isLoading: cryptoLoading,
    isFetching: cryptoFetching,
    error: cryptoError,
    refetch: refetchCrypto,
  } = cryptoQuery

  const {
    data: gold,
    isLoading: goldLoading,
    isFetching: goldFetching,
    error: goldError,
    refetch: refetchGold,
  } = goldQuery

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
