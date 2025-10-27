export interface ChartDataPoint {
  timestamp: string; // ISO 8601 date string
  open: number; // Opening price in Toman
  high: number; // Highest price in Toman
  low: number; // Lowest price in Toman
  close: number; // Closing price in Toman
  volume: number; // Trading volume
}

export interface ChartResponse {
  data: ChartDataPoint[];
  count: number;
}
