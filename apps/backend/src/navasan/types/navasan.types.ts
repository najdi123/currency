import { ItemCategory } from '../constants/navasan.constants';

/**
 * API Response Types
 */
export interface ApiResponse<T = unknown> {
  data: T;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  isFresh: boolean;
  isStale: boolean;
  source: string;
  category?: ItemCategory;
  lastUpdated: string;
  cached: boolean;
  isHistorical?: boolean;
  historicalDate?: string;
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
  timestamp?: string;
  [key: string]: unknown;
}

export interface CryptoData {
  symbol: string;
  name?: string;
  price: number | string;
  change?: number | string;
  high?: number | string;
  low?: number | string;
  volume?: number | string;
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
  timestamp?: string;
  volume?: number | string;
  itemCode?: string;
}

export interface OhlcSnapshot {
  _id?: string;
  itemCode: string;
  category: ItemCategory;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  createdAt?: Date;
  updatedAt?: Date;
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
export interface PriceData {
  price: number | string;
  value?: number | string;
  timestamp?: string | Date;
  [key: string]: unknown;
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
