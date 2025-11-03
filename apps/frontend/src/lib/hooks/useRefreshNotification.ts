import { useState, useEffect, useRef } from 'react'

const SUCCESS_NOTIFICATION_DURATION = 1500 // 1.5 seconds
const STALE_NOTIFICATION_DURATION = 3000 // 3 seconds for stale data warning

/**
 * Hook to manage the manual refresh notification logic
 * Shows a success notification after manual refresh completes
 * Distinguishes between fresh data and stale/cached data
 */
export const useRefreshNotification = (
  currenciesFetching: boolean,
  cryptoFetching: boolean,
  goldFetching: boolean,
  currencies: any,
  crypto: any,
  gold: any,
  currenciesError: any,
  cryptoError: any,
  goldError: any,
  refetchAll: () => Promise<void>
) => {
  const [showSuccess, setShowSuccess] = useState(false)
  const [isStaleData, setIsStaleData] = useState(false)
  const [staleDataTime, setStaleDataTime] = useState<Date | null>(null)
  const isManualRefresh = useRef(false)

  // Check if any of the data is stale
  const checkIfStale = () => {
    // Check metadata from any of the data sources
    const currencyMetadata = currencies?._metadata
    const cryptoMetadata = crypto?._metadata
    const goldMetadata = gold?._metadata

    // If any metadata indicates stale data
    const isStale =
      currencyMetadata?.isStale || cryptoMetadata?.isStale || goldMetadata?.isStale

    // Get the oldest lastUpdated timestamp
    const timestamps = [
      currencyMetadata?.lastUpdated,
      cryptoMetadata?.lastUpdated,
      goldMetadata?.lastUpdated,
    ].filter(Boolean)

    const oldestTimestamp = timestamps.length > 0
      ? new Date(Math.min(...timestamps.map((t) => new Date(t).getTime())))
      : null

    return { isStale, lastUpdated: oldestTimestamp }
  }

  // Show success notification after manual refresh completes
  useEffect(() => {
    // Only show notification if:
    // 1. Manual refresh was triggered
    // 2. Not currently fetching
    // 3. Data successfully loaded (at least one dataset available)
    const wasManualRefresh = isManualRefresh.current
    const notFetching = !currenciesFetching && !cryptoFetching && !goldFetching
    const hasData = currencies || crypto || gold

    if (wasManualRefresh && notFetching && hasData) {
      // Reset manual refresh flag
      isManualRefresh.current = false

      // Check if data is stale
      const { isStale, lastUpdated } = checkIfStale()

      if (!currenciesError && !cryptoError && !goldError && !isStale) {
        // Fresh data - show quick success
        setIsStaleData(false)
        setShowSuccess(true)

        const timer = setTimeout(() => {
          setShowSuccess(false)
        }, SUCCESS_NOTIFICATION_DURATION)

        return () => clearTimeout(timer)
      } else if (hasData && isStale) {
        // Stale data - show warning with timestamp
        setIsStaleData(true)
        setStaleDataTime(lastUpdated)
        setShowSuccess(true)

        const timer = setTimeout(() => {
          setShowSuccess(false)
          setIsStaleData(false)
          setStaleDataTime(null)
        }, STALE_NOTIFICATION_DURATION)

        return () => clearTimeout(timer)
      }
    }
  }, [
    currenciesFetching,
    cryptoFetching,
    goldFetching,
    currencies,
    crypto,
    gold,
    currenciesError,
    cryptoError,
    goldError,
  ])

  const handleRefresh = async () => {
    isManualRefresh.current = true
    await refetchAll()
  }

  return {
    showSuccess,
    isStaleData,
    staleDataTime,
    handleRefresh,
  }
}
