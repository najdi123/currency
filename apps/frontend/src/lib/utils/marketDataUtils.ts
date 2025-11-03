/**
 * Computed state utilities for market data
 * These functions help determine the overall state of data fetching and errors
 */

export interface MarketDataState {
  currenciesLoading: boolean
  cryptoLoading: boolean
  goldLoading: boolean
  currenciesFetching: boolean
  cryptoFetching: boolean
  goldFetching: boolean
  currenciesError: any
  cryptoError: any
  goldError: any
  currencies: any
  crypto: any
  gold: any
}

export interface ComputedMarketState {
  isRefreshing: boolean
  isFetching: boolean
  hasAllErrors: boolean
  hasStaleData: boolean
  anyError: boolean
}

/**
 * Compute the overall state of market data fetching
 */
export const computeMarketState = (state: MarketDataState): ComputedMarketState => {
  const {
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
  } = state

  return {
    isRefreshing: currenciesLoading || cryptoLoading || goldLoading,
    isFetching: currenciesFetching || cryptoFetching || goldFetching,
    hasAllErrors: !!(currenciesError && cryptoError && goldError),
    hasStaleData: !!(
      (currenciesError && currencies) ||
      (cryptoError && crypto) ||
      (goldError && gold)
    ),
    anyError: !!(currenciesError || cryptoError || goldError),
  }
}
