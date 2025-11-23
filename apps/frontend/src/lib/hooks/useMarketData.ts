import { useMemo } from 'react'
import {
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
  useGetCoinsQuery,
  useGetCurrenciesHistoricalQuery,
  useGetCryptoHistoricalQuery,
  useGetGoldHistoricalQuery,
  useGetCoinsHistoricalQuery,
} from '@/lib/store/services/api'
import { computeMarketState } from '@/lib/utils/marketDataUtils'
import { formatDateForApi } from '@/lib/utils/dateUtils'

// Disable polling to prevent hitting rate limits
// Users can manually refresh using the refresh button
const POLLING_INTERVAL = 0 // Disabled - was 5 minutes (300000)

/**
 * Hook to consolidate all market data queries (currencies, crypto, gold, coins)
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

  const coinsCurrentQuery = useGetCoinsQuery(undefined, {
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

  const coinsHistoricalQuery = useGetCoinsHistoricalQuery(dateParam || '', {
    pollingInterval: POLLING_INTERVAL,
    skip: !isHistorical || !dateParam,
  })

  // Select the appropriate query result based on mode
  const currenciesQuery = isHistorical ? currenciesHistoricalQuery : currenciesCurrentQuery
  const cryptoQuery = isHistorical ? cryptoHistoricalQuery : cryptoCurrentQuery
  const goldQuery = isHistorical ? goldHistoricalQuery : goldCurrentQuery
  const coinsQuery = isHistorical ? coinsHistoricalQuery : coinsCurrentQuery

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

  const {
    data: coins,
    isLoading: coinsLoading,
    isFetching: coinsFetching,
    error: coinsError,
    refetch: refetchCoins,
  } = coinsQuery

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
    await Promise.all([refetchCurrencies(), refetchCrypto(), refetchGold(), refetchCoins()])
  }

  return {
    // Data
    currencies,
    crypto,
    gold,
    coins,
    // Loading states
    currenciesLoading,
    cryptoLoading,
    goldLoading,
    coinsLoading,
    // Fetching states
    currenciesFetching,
    cryptoFetching,
    goldFetching,
    coinsFetching,
    // Errors
    currenciesError,
    cryptoError,
    goldError,
    coinsError,
    // Refetch functions
    refetchCurrencies,
    refetchCrypto,
    refetchGold,
    refetchCoins,
    refetchAll,
    // Computed state
    ...computedState,
  }
}
