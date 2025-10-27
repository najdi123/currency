/**
 * Type definitions for chart feature
 */

export type TimeRange = '1d' | '1w' | '1m' | '3m' | '1y' | 'all'
export type ItemType = 'currency' | 'gold' | 'crypto'

export interface ChartDataPoint {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ChartResponse {
  data: ChartDataPoint[]
  count: number
}

export interface ChartQueryParams {
  itemCode: string
  timeRange: TimeRange
  itemType: ItemType
}

export interface SelectedChartItem {
  code: string
  name: string
  type: ItemType
  price: number
  change: number
}

export interface TimeRangeOption {
  value: TimeRange
  label: string
  labelFa: string
}

export interface TransformedChartData {
  dates: string[]
  prices: number[]
  dataPoints: ChartDataPoint[]
}
