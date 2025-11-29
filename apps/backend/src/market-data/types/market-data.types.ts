import { ItemCategory } from '../constants/market-data.constants';

/**
 * Market Data Types
 * Provider-agnostic types for market data operations
 */

/**
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  data: T;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  isFresh: boolean;
  isStale: boolean;
  source: 'api' | 'cache' | 'fallback' | 'snapshot' | 'ohlc_permanent' | string;
  category?: ItemCategory;
  lastUpdated: Date | string;
  dataAge?: number; // Age in minutes
  cached?: boolean;
  isHistorical?: boolean;
  historicalDate?: Date | string;
  warning?: string;
  completeness?: {
    successCount: number;
    totalCount: number;
    percentage: number;
  };
}

/**
 * Price item structure (common format across providers)
 */
export interface PriceItem {
  value: string;
  change?: number;
  utc?: string;
  date?: string;
  dt?: string;
}

/**
 * Market data response (key-value pairs of price items)
 */
export type MarketDataResponse = Record<string, PriceItem>;

/**
 * Enrichment metadata added to responses
 */
export interface EnrichmentMetadata {
  source: string;
  enrichedAt: string;
  [key: string]: unknown;
}

/**
 * Market data response with enrichment metadata
 */
export interface MarketDataWithMetadata {
  data: MarketDataResponse;
  _metadata: EnrichmentMetadata;
}

/**
 * Currency Data Types
 */
export interface CurrencyData {
  code: string;
  name?: string;
  price: number | string;
  change?: number | string;
  high?: number | string;
  low?: number | string;
  updatedAt?: Date;
  timestamp?: string;
  [key: string]: unknown;
}

export interface CryptoData {
  code: string;
  symbol: string;
  name?: string;
  price: number | string;
  priceIrt?: number;
  change?: number | string;
  change24h?: number | string;
  high?: number | string;
  low?: number | string;
  volume?: number | string;
  updatedAt?: Date;
  timestamp?: string;
  [key: string]: unknown;
}

export interface GoldData {
  code: string;
  name?: string;
  price: number | string;
  change?: number | string;
  high?: number | string;
  low?: number | string;
  updatedAt?: Date;
  timestamp?: string;
  [key: string]: unknown;
}

export type ItemData = CurrencyData | CryptoData | GoldData;

/**
 * OHLC Data Types
 */
export interface OhlcData {
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  timestamp?: string | Date;
  volume?: number | string;
  itemCode?: string;
  change?: number;
}

/**
 * OHLC Data Point from API (Navasan format)
 * Used for chart data points from external APIs
 * Compatible with OhlcData for ease of use
 */
export interface NavasanOHLCDataPoint {
  timestamp?: number | string | Date; // Unix timestamp or Date
  date?: string; // Persian date YYYY-MM-DD
  open: number | string; // Opening price
  high: number | string; // Highest price
  low: number | string; // Lowest price
  close: number | string; // Closing price
  volume?: number | string;
  itemCode?: string;
  change?: number;
}

export interface AggregatedOhlcData {
  itemCode: string;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: Date;
}

/**
 * Historical Data Types
 */
export interface HistoricalDataPoint {
  timestamp: string | Date;
  date?: string | Date;
  price?: number | string;
  value?: number | string;
  [key: string]: unknown;
}

/**
 * Price Snapshot Types
 */
export interface PriceSnapshotData {
  category: string;
  data: MarketDataResponse;
  timestamp: Date;
  source: string;
  metadata?: Record<string, unknown>;
}

/**
 * Transform Options
 */
export interface TransformOptions {
  isFresh?: boolean;
  isStale?: boolean;
  source?: string;
  category?: ItemCategory;
  isHistorical?: boolean;
  historicalDate?: Date;
}

/**
 * Error Response
 */
export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    timestamp: string;
  };
  metadata?: {
    category?: ItemCategory;
    source: string;
  };
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Cache Data (generic for anything stored in cache)
 */
export type CacheData = Record<string, unknown>;

/**
 * Force fetch result
 */
export interface ForceFetchResult {
  success: boolean;
  error?: string;
}

/**
 * Fetch with cache result
 */
export interface FetchResult {
  data: MarketDataResponse;
  metadata: ResponseMetadata;
}
