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
  goldError: any
) => {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    // Only update timestamp if no errors and at least one dataset is available
    if (!currenciesError && !cryptoError && !goldError && (currencies || crypto || gold)) {
      setLastUpdated(new Date())
    }
  }, [currencies, crypto, gold, currenciesError, cryptoError, goldError])

  return lastUpdated
}
