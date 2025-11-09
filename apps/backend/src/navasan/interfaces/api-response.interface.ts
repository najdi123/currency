export interface ApiResponseMetadata {
  isFresh: boolean;
  isStale: boolean;
  dataAge?: number; // Age in minutes
  lastUpdated: Date;
  source: 'cache' | 'api' | 'fallback' | 'snapshot';
  warning?: string;
  isHistorical?: boolean;
  historicalDate?: Date;
}

export interface ApiResponse<T> {
  data: T;
  metadata: ApiResponseMetadata;
}
