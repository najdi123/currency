import { useState, useEffect } from 'react'

/**
 * Hook to manage the last updated timestamp
 * Updates automatically when data is successfully fetched
 */
export const useLastUpdatedTimestamp = (
  currencies: any,
  crypto: any,
  gold: any,
  currenciesError: any,
  cryptoError: any,
  goldError: any,
  coins?: any,
  coinsError?: any
) => {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    // Only update timestamp if no errors and at least one dataset is available
    if (!currenciesError && !cryptoError && !goldError && !coinsError && (currencies || crypto || gold || coins)) {
      setLastUpdated(new Date())
    }
  }, [currencies, crypto, gold, coins, currenciesError, cryptoError, goldError, coinsError])

  return lastUpdated
}
