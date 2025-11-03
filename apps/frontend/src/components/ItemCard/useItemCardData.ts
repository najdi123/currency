import { useMemo } from 'react'
import type { ItemType } from '@/types/chart'
import {
  useGetCurrencyHistoryQuery,
  useGetDigitalCurrencyHistoryQuery,
  useGetGoldHistoryQuery,
} from '@/lib/store/services/api'
import { getSparklineData } from '@/lib/utils/mockSparklineData'

/**
 * Parameters for useItemCardData hook
 */
interface UseItemCardDataParams {
  code: string
  value: number
  change: number
  type: ItemType
}

/**
 * Custom hook to process ItemCard data and generate sparkline information
 *
 * Extracts data processing logic from the component:
 * - Fetches real 7-day historical data from API based on item type
 * - Falls back to mock data if API is unavailable
 * - Determines positive/negative change direction
 * - Calculates sparkline color based on change
 *
 * @param params - Object containing code, value, change, and type
 * @returns Processed data for rendering
 */
export function useItemCardData({ code, value, change, type }: UseItemCardDataParams) {
  // Conditionally fetch historical data based on item type
  // RTK Query automatically handles caching and deduplication
  const { data: currencyHistory } = useGetCurrencyHistoryQuery(
    { code },
    { skip: type !== 'currency' }
  )

  const { data: cryptoHistory } = useGetDigitalCurrencyHistoryQuery(
    { symbol: code },
    { skip: type !== 'crypto' }
  )

  const { data: goldHistory } = useGetGoldHistoryQuery(
    { code },
    { skip: type !== 'gold' }
  )

  // Transform real historical data to sparkline format, or use mock as fallback
  const sparklineData = useMemo(() => {
    // Select the appropriate history data based on type
    const historyData =
      type === 'currency'
        ? currencyHistory
        : type === 'crypto'
        ? cryptoHistory
        : goldHistory

    // Use real data if available and successful
    if (historyData?.success && historyData.data?.length > 0) {
      return historyData.data.map((point) => point.price)
    }

    // Fallback to mock data if API not available or failed
    return getSparklineData(code, value)
  }, [currencyHistory, cryptoHistory, goldHistory, type, code, value])

  // Determine sparkline color based on change direction
  const isPositive = change >= 0
  const sparklineColor = isPositive
    ? 'rgb(var(--success))'
    : 'rgb(var(--error))'

  return {
    sparklineData,
    isPositive,
    sparklineColor,
  }
}
