/**
 * Navasan API Response Type Definitions
 *
 * These interfaces define the exact structure of responses from the Navasan API.
 * They replace unsafe Record<string, unknown> types with proper type checking.
 */

/**
 * Base structure for all Navasan price items
 * All items (currency, crypto, gold) share this structure
 */
export interface NavasanPriceItem {
  value: string; // Price value as string (e.g., "50000")
  change: number | null; // Price change amount (null when no previous data available)
  utc: string; // UTC timestamp (e.g., "2024-01-15T10:30:00.000Z")
  date: string; // Persian date (e.g., "1402/10/25")
  dt: string; // Time string (e.g., "10:30:00")
}

/**
 * Navasan Currency Response
 * Includes major currencies: usd_sell, eur, gbp, cad, aud
 */
export interface NavasanCurrencyResponse {
  usd_sell?: NavasanPriceItem;
  eur?: NavasanPriceItem;
  gbp?: NavasanPriceItem;
  cad?: NavasanPriceItem;
  aud?: NavasanPriceItem;
}

/**
 * Navasan Cryptocurrency Response
 * Includes: usdt, btc, eth
 */
export interface NavasanCryptoResponse {
  usdt?: NavasanPriceItem;
  btc?: NavasanPriceItem;
  eth?: NavasanPriceItem;
}

/**
 * Navasan Gold Response
 * Includes: sekkeh, bahar, nim, rob, gerami, 18ayar
 * Note: Gold coins (except 18ayar) are returned in thousands of tomans
 */
export interface NavasanGoldResponse {
  sekkeh?: NavasanPriceItem;
  bahar?: NavasanPriceItem;
  nim?: NavasanPriceItem;
  rob?: NavasanPriceItem;
  gerami?: NavasanPriceItem;
  "18ayar"?: NavasanPriceItem;
}

/**
 * Combined response when fetching all items
 */
export interface NavasanAllResponse
  extends NavasanCurrencyResponse,
    NavasanCryptoResponse,
    NavasanGoldResponse {}

/**
 * Union type for any Navasan response
 */
export type NavasanResponse =
  | NavasanCurrencyResponse
  | NavasanCryptoResponse
  | NavasanGoldResponse
  | NavasanAllResponse;

/**
 * OHLC Data Point from Navasan API
 */
export interface NavasanOHLCDataPoint {
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
export interface NavasanApiMetadata {
  statusCode: number;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}
