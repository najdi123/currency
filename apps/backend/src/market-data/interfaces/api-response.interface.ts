/**
 * Market Data API Response Type Definitions
 */

/**
 * Base structure for all price items from API
 * All items (currency, crypto, gold) share this structure
 */
export interface PriceItem {
  value: string; // Price value as string (e.g., "50000")
  change: number | null; // Price change amount (null when no previous data available)
  utc: string; // UTC timestamp (e.g., "2024-01-15T10:30:00.000Z")
  date: string; // Persian date (e.g., "1402/10/25")
  dt: string; // Time string (e.g., "10:30:00")
}

/**
 * Currency Response
 */
export interface CurrencyResponse {
  usd_sell?: PriceItem;
  eur?: PriceItem;
  gbp?: PriceItem;
  cad?: PriceItem;
  aud?: PriceItem;
}

/**
 * Cryptocurrency Response
 */
export interface CryptoResponse {
  usdt?: PriceItem;
  btc?: PriceItem;
  eth?: PriceItem;
}

/**
 * Gold Response
 */
export interface GoldResponse {
  sekkeh?: PriceItem;
  bahar?: PriceItem;
  nim?: PriceItem;
  rob?: PriceItem;
  gerami?: PriceItem;
  "18ayar"?: PriceItem;
}

/**
 * Combined response when fetching all items
 */
export interface AllItemsResponse
  extends CurrencyResponse,
    CryptoResponse,
    GoldResponse {}

/**
 * Union type for any market data response
 */
export type MarketDataResponse =
  | CurrencyResponse
  | CryptoResponse
  | GoldResponse
  | AllItemsResponse;

/**
 * OHLC Data Point
 */
export interface OHLCDataPoint {
  timestamp: number; // Unix timestamp
  date: string; // Persian date YYYY-MM-DD
  open: number | string; // Opening price (can be number or string)
  high: number | string; // Highest price
  low: number | string; // Lowest price
  close: number | string; // Closing price
}

/**
 * API Metadata returned from successful API calls
 */
export interface ApiMetadata {
  statusCode: number;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

/**
 * Response metadata
 */
export interface ApiResponseMetadata {
  isFresh: boolean;
  isStale: boolean;
  dataAge?: number; // Age in minutes
  lastUpdated: Date;
  source: "cache" | "api" | "fallback" | "snapshot" | "ohlc-snapshot" | "ohlc_permanent";
  warning?: string;
  isHistorical?: boolean;
  historicalDate?: Date | string;
  completeness?: {
    successCount: number;
    totalCount: number;
    percentage: number;
    failedItems?: string[];
  };
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  metadata: ApiResponseMetadata;
}

// Legacy exports for backwards compatibility
export type NavasanPriceItem = PriceItem;
export type NavasanCurrencyResponse = CurrencyResponse;
export type NavasanCryptoResponse = CryptoResponse;
export type NavasanGoldResponse = GoldResponse;
export type NavasanAllResponse = AllItemsResponse;
export type NavasanResponse = MarketDataResponse;
export type NavasanOHLCDataPoint = OHLCDataPoint;
export type NavasanApiMetadata = ApiMetadata;
