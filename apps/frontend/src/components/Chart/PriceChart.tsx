'use client'

import { useMemo, lazy, memo, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { useGetChartDataQuery } from '@/lib/store/services/api'
import type { TimeRange, ItemType } from '@/types/chart'
import { transformChartData, getEChartsOption } from '@/lib/utils/chartUtils'
import { ChartLoadingState } from './ChartLoadingState'
import { ChartErrorState } from './ChartErrorState'
import { ChartEmptyState } from './ChartEmptyState'
import { getErrorMessage } from '@/types/errors'

const ReactECharts = lazy(() => import('echarts-for-react'))

interface PriceChartProps {
  itemCode: string
  itemType: ItemType
  timeRange: TimeRange
  itemName: string
}

const PriceChartComponent: React.FC<PriceChartProps> = ({
  itemCode,
  itemType,
  timeRange,
  itemName,
}) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const { data, isLoading, error, refetch } = useGetChartDataQuery({
    itemCode,
    timeRange,
    itemType,
  })

  const chartOption = useMemo(() => {
    if (!data?.data?.length) return null

    const transformed = transformChartData(data.data)
    return getEChartsOption(
      transformed.dates,
      transformed.prices,
      transformed.dataPoints,
      timeRange,
      itemName,
      isDark
    )
  }, [data, timeRange, itemName, isDark])

  if (isLoading) {
    return <ChartLoadingState />
  }

  // Memoize retry handler to prevent recreation on every render
  const handleRetry = useCallback(() => {
    refetch()
  }, [refetch])

  if (error) {
    // Provide user-friendly error messages in Persian
    const errorMessage = error && 'status' in error && error.status === 404
      ? 'این سرویس هنوز در بک‌اند پیاده‌سازی نشده است. لطفاً از توسعه‌دهنده بک‌اند بخواهید endpoint نمودار را اضافه کند.'
      : error && 'status' in error && error.status === 'FETCH_ERROR'
      ? 'خطا در اتصال به سرور. لطفاً مطمئن شوید که سرور بک‌اند روی پورت 4000 در حال اجرا است.'
      : getErrorMessage(error)

    return (
      <ChartErrorState
        message={errorMessage}
        onRetry={handleRetry}
      />
    )
  }

  if (!data?.data?.length) {
    return <ChartEmptyState />
  }

  // Explicit guard for TypeScript - should never be null here due to above checks
  if (!chartOption) {
    return <ChartEmptyState />
  }

  return (
    <div className="w-full h-[400px] min-h-[400px]" dir="ltr" role="img" aria-label={`نمودار قیمت ${itemName}`}>
      <ReactECharts
        option={chartOption}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
// Only re-render when props actually change
export const PriceChart = memo(PriceChartComponent, (prevProps, nextProps) => {
  return (
    prevProps.itemCode === nextProps.itemCode &&
    prevProps.itemType === nextProps.itemType &&
    prevProps.timeRange === nextProps.timeRange &&
    prevProps.itemName === nextProps.itemName
  )
})
