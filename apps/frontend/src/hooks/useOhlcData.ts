import { useGetTodayOhlcQuery } from '@/lib/store/services/api'

interface UseOhlcDataOptions {
  itemCode: string
  enabled?: boolean
}

/**
 * useOhlcData - Custom hook for fetching OHLC data for a specific item
 *
 * Features:
 * - Fetches today's OHLC data from the backend
 * - Provides loading, error states
 * - Allows conditional fetching via enabled flag
 * - Returns null values when no data available
 * - Optimized with RTK Query caching
 *
 * @param options - Configuration options
 * @param options.itemCode - Item code to fetch OHLC data for (e.g., "usd_sell")
 * @param options.enabled - Whether to enable the query (default: true)
 *
 * @returns Object containing OHLC data and query states
 */
export const useOhlcData = (options: UseOhlcDataOptions) => {
  const { itemCode, enabled = true } = options

  const { data, isLoading, isError, error, refetch } = useGetTodayOhlcQuery(itemCode, {
    skip: !enabled || !itemCode,
  })

  return {
    ohlc: data || null,
    dailyChangePercent: data?.change || null,
    dataPoints: data?.dataPoints || [],
    hasData: !!data,
    isLoading,
    isError,
    error,
    refetch,
  }
}
