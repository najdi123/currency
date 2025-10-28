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
    return `${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`
  }
  return value.toFixed(0)
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
  const colors = {
    line: isDark ? '#60a5fa' : '#2563eb',
    grid: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#e5e7eb' : '#374151',
    bg: isDark ? 'transparent' : 'transparent',
  }

  return {
    backgroundColor: colors.bg,
    grid: {
      left: '60px',
      right: '20px',
      top: '20px',
      bottom: '70px', // Increased to make room for zoom slider
    },
    xAxis: {
      type: 'category',
      data: dates.map(d => formatChartDate(d, timeRange)),
      axisLine: {
        lineStyle: { color: colors.grid }
      },
      axisLabel: {
        color: colors.text,
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: { color: colors.grid }
      },
      axisLabel: {
        color: colors.text,
        fontSize: 11,
        formatter: (value: number) => formatYAxisLabel(value),
      },
      splitLine: {
        lineStyle: {
          color: colors.grid,
          opacity: 0.5,
        }
      },
    },
    // Enable zoom and pan with scroll wheel, touch gestures, and slider
    dataZoom: [
      {
        type: 'inside', // Enable zoom with scroll wheel and touch gestures
        start: 0,
        end: 100,
        zoomOnMouseWheel: true, // Zoom with mouse wheel
        moveOnMouseMove: false, // Don't pan on mouse move (use drag instead)
        moveOnMouseWheel: false, // Don't pan with mouse wheel
        preventDefaultMouseMove: true,
      },
      {
        type: 'slider', // Show slider at bottom for zooming
        start: 0,
        end: 100,
        height: 20,
        bottom: 10,
        handleSize: '80%',
        handleStyle: {
          color: colors.line,
        },
        textStyle: {
          color: colors.text,
          fontSize: 10,
        },
        borderColor: colors.grid,
        fillerColor: isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(37, 99, 235, 0.2)',
        dataBackground: {
          lineStyle: {
            color: colors.grid,
          },
          areaStyle: {
            color: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.1)',
          },
        },
        selectedDataBackground: {
          lineStyle: {
            color: colors.line,
          },
          areaStyle: {
            color: isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(37, 99, 235, 0.3)',
          },
        },
      },
    ],
    series: [
      {
        data: prices,
        type: 'line',
        smooth: true,
        lineStyle: {
          color: colors.line,
          width: 2,
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
              { offset: 0, color: isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(37, 99, 235, 0.3)' },
              { offset: 1, color: isDark ? 'rgba(96, 165, 250, 0)' : 'rgba(37, 99, 235, 0)' }
            ],
          }
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderColor: colors.grid,
      textStyle: {
        color: colors.text,
      },
      formatter: (params: any) => {
        const index = params[0].dataIndex
        const point = dataPoints[index]
        if (!point) return ''

        return `
          <div style="font-size: 12px;">
            <div style="margin-bottom: 4px; font-weight: bold;">${formatChartDate(point.timestamp, timeRange)}</div>
            <div>Open: ${formatYAxisLabel(point.open)} T</div>
            <div>High: ${formatYAxisLabel(point.high)} T</div>
            <div>Low: ${formatYAxisLabel(point.low)} T</div>
            <div>Close: ${formatYAxisLabel(point.close)} T</div>
            ${point.volume ? `<div>Volume: ${formatYAxisLabel(point.volume)}</div>` : ''}
          </div>
        `
      },
    },
    animation: true,
    animationDuration: 300,
    animationEasing: 'cubicOut',
  }
}
