import type { ChartDataPoint, TimeRange, ItemType, TransformedChartData } from '@/types/chart'
import type { EChartsOption } from 'echarts'

/**
 * Map internal item codes to API codes
 * This is a simple mapping that uppercases codes for the backend
 * The backend will then map them to the appropriate Navasan API codes
 */
export const mapItemCodeToApi = (internalCode: string): string => {
  // Special case: usd_sell should stay as USD_SELL
  if (internalCode === 'usd_sell') {
    return 'USD_SELL'
  }
  // For all other codes, just uppercase them
  // e.g., 'sekkeh' → 'SEKKEH', 'btc' → 'BTC', '18ayar' → '18AYAR'
  return internalCode.toUpperCase()
}

/**
 * Transform chart data for ECharts
 */
export const transformChartData = (data: ChartDataPoint[]): TransformedChartData => {
  const dates = data.map(d => d.timestamp)
  const prices = data.map(d => d.close)

  return {
    dates,
    prices,
    dataPoints: data,
  }
}

/**
 * Format date based on time range
 */
export const formatChartDate = (timestamp: string, timeRange: TimeRange): string => {
  const date = new Date(timestamp)

  switch (timeRange) {
    case '1d':
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(date)

    case '1w':
    case '1m':
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
      }).format(date)

    case '3m':
    case '1y':
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
      }).format(date)

    case 'all':
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short'
      }).format(date)

    default:
      return new Intl.DateTimeFormat('en-US').format(date)
  }
}

/**
 * Format Y-axis labels with K/M/B suffixes
 */
export const formatYAxisLabel = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toFixed(0)
}

/**
 * Format tooltip values with at least 2 decimal places
 * Shows full precision for small numbers, K/M/B for large numbers
 */
export const formatTooltipValue = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    // For thousands, show with commas and 2 decimal places
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  // For smaller numbers, always show at least 2 decimal places
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Get ECharts option configuration
 */
export const getEChartsOption = (
  dates: string[],
  prices: number[],
  dataPoints: ChartDataPoint[],
  timeRange: TimeRange,
  itemName: string,
  isDark: boolean
): EChartsOption => {
  // Use Apple design token colors - SF Blue with subtle variations
  const colors = {
    line: isDark ? 'rgb(10, 132, 255)' : 'rgb(0, 122, 255)',      // --accent-primary
    grid: isDark ? 'rgb(58, 58, 60)' : 'rgb(229, 229, 234)',      // --border-light
    text: isDark ? 'rgb(235, 235, 245)' : 'rgb(60, 60, 67)',      // --text-secondary
    bg: 'transparent',
  }

  // Calculate dynamic Y-axis range with 5% padding for better visibility
  const dataMin = Math.min(...prices)
  const dataMax = Math.max(...prices)
  const range = dataMax - dataMin
  const padding = range * 0.05 // 5% padding on each side

  // Calculate min/max with padding, ensuring we don't go below 0
  const yAxisMin = Math.max(0, Math.floor(dataMin - padding))
  const yAxisMax = Math.ceil(dataMax + padding)

  return {
    backgroundColor: colors.bg,
    grid: {
      left: '60px',
      right: '20px',
      top: '20px',
      bottom: '70px',
    },
    xAxis: {
      type: 'category',
      data: dates.map(d => formatChartDate(d, timeRange)),
      axisLine: {
        show: false, // Clean Apple style - no axis lines
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: colors.text,
        fontSize: 11,
        fontFamily: 'Vazirmatn, -apple-system, sans-serif',
      },
    },
    yAxis: {
      type: 'value',
      min: yAxisMin,
      max: yAxisMax,
      axisLine: {
        show: false, // Clean Apple style - no axis lines
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: colors.text,
        fontSize: 11,
        fontFamily: 'Vazirmatn, -apple-system, sans-serif',
        formatter: (value: number) => formatYAxisLabel(value),
      },
      splitLine: {
        lineStyle: {
          color: colors.grid,
          opacity: 0.3, // Very subtle grid lines
          type: 'solid',
        }
      },
    },
    // Enable zoom and pan with scroll wheel, touch gestures, and slider
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: false,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 10,
        handleSize: '80%',
        handleStyle: {
          color: colors.line,
          borderWidth: 0,
        },
        textStyle: {
          color: colors.text,
          fontSize: 10,
          fontFamily: 'Vazirmatn, -apple-system, sans-serif',
        },
        borderColor: 'transparent',
        fillerColor: isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.15)',
        dataBackground: {
          lineStyle: {
            color: colors.grid,
            width: 1,
          },
          areaStyle: {
            color: isDark ? 'rgba(10, 132, 255, 0.05)' : 'rgba(0, 122, 255, 0.05)',
          },
        },
        selectedDataBackground: {
          lineStyle: {
            color: colors.line,
            width: 1,
          },
          areaStyle: {
            color: isDark ? 'rgba(10, 132, 255, 0.2)' : 'rgba(0, 122, 255, 0.2)',
          },
        },
      },
    ],
    series: [
      {
        data: prices,
        type: 'line',
        smooth: true,
        symbol: 'none', // Clean line without dots
        lineStyle: {
          color: colors.line,
          width: 2.5,
        },
        itemStyle: {
          color: colors.line,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? 'rgba(10, 132, 255, 0.25)' : 'rgba(0, 122, 255, 0.25)' },
              { offset: 1, color: isDark ? 'rgba(10, 132, 255, 0)' : 'rgba(0, 122, 255, 0)' }
            ],
          }
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      borderColor: colors.grid,
      borderWidth: 1,
      textStyle: {
        color: colors.text,
        fontFamily: 'Vazirmatn, -apple-system, sans-serif',
      },
      padding: [12, 16],
      formatter: (params: any) => {
        const index = params[0].dataIndex
        const point = dataPoints[index]
        if (!point) return ''

        return `
          <div style="font-size: 12px; line-height: 1.6;">
            <div style="margin-bottom: 6px; font-weight: 600; color: ${isDark ? '#FFFFFF' : '#000000'};">${formatChartDate(point.timestamp, timeRange)}</div>
            <div>Open: ${formatTooltipValue(point.open)} T</div>
            <div>High: ${formatTooltipValue(point.high)} T</div>
            <div>Low: ${formatTooltipValue(point.low)} T</div>
            <div style="font-weight: 600;">Close: ${formatTooltipValue(point.close)} T</div>
            ${point.volume ? `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid ${colors.grid};">Volume: ${formatTooltipValue(point.volume)}</div>` : ''}
          </div>
        `
      },
    },
    animation: true,
    animationDuration: 200, // Faster, Apple-style
    animationEasing: 'cubicOut',
  }
}
