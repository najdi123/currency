export interface ApiResponseMetadata {
  isFresh: boolean;
  isStale: boolean;
  dataAge?: number; // Age in minutes
  lastUpdated: Date;
  source: 'cache' | 'api' | 'fallback' | 'snapshot' | 'ohlc-snapshot';
  warning?: string;
  isHistorical?: boolean;
  historicalDate?: Date | string;
}

export interface ApiResponse<T> {
  data: T;
  metadata: ApiResponseMetadata;
}
