/**
 * Type Guards for Runtime Validation
 *
 * These type guards provide runtime validation of API responses.
 * They ensure type safety by checking that data matches expected structures
 * before it's used in the application.
 */

import { PriceItem, OhlcData } from "../types/market-data.types";

/**
 * Check if a value is a valid PriceItem
 */
export function isPriceItem(data: unknown): data is PriceItem {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  const item = data as Record<string, unknown>;

  // Check required field exists
  if (!("value" in item)) {
    return false;
  }

  // Check field types
  return typeof item.value === "string";
}

/**
 * Check if response is a valid currency response
 */
export function isCurrencyResponse(
  data: unknown,
): data is Record<string, PriceItem> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  const response = data as Record<string, unknown>;

  // Must have at least one currency field
  const currencyFields = ["usd_sell", "eur", "gbp", "cad", "aud", "usd", "aed"];
  const hasAnyCurrency = currencyFields.some((field) => field in response);

  if (!hasAnyCurrency) {
    return false;
  }

  // All present currency fields must be valid PriceItems
  for (const field of currencyFields) {
    if (field in response && !isPriceItem(response[field])) {
      return false;
    }
  }

  return true;
}

/**
 * Check if response is a valid crypto response
 */
export function isCryptoResponse(data: unknown): data is Record<string, PriceItem> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  const response = data as Record<string, unknown>;

  // Must have at least one crypto field
  const cryptoFields = ["usdt", "btc", "eth", "bnb", "xrp"];
  const hasAnyCrypto = cryptoFields.some((field) => field in response);

  if (!hasAnyCrypto) {
    return false;
  }

  // All present crypto fields must be valid PriceItems
  for (const field of cryptoFields) {
    if (field in response && !isPriceItem(response[field])) {
      return false;
    }
  }

  return true;
}

/**
 * Check if response is a valid gold response
 */
export function isGoldResponse(data: unknown): data is Record<string, PriceItem> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  const response = data as Record<string, unknown>;

  // Must have at least one gold field
  const goldFields = ["sekkeh", "bahar", "nim", "rob", "gerami", "18ayar", "gold_18k"];
  const hasAnyGold = goldFields.some((field) => field in response);

  if (!hasAnyGold) {
    return false;
  }

  // All present gold fields must be valid PriceItems
  for (const field of goldFields) {
    if (field in response && !isPriceItem(response[field])) {
      return false;
    }
  }

  return true;
}

/**
 * Check if data is a valid OHLC data point
 */
export function isOHLCDataPoint(data: unknown): data is OhlcData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  const point = data as Record<string, unknown>;

  // Check required fields exist
  if (
    !("open" in point) ||
    !("high" in point) ||
    !("low" in point) ||
    !("close" in point)
  ) {
    return false;
  }

  // Price fields can be number or string
  const priceFields = [point.open, point.high, point.low, point.close];
  for (const price of priceFields) {
    const isValidNumber = typeof price === "number" && !isNaN(price);
    const isValidString =
      typeof price === "string" && !isNaN(parseFloat(price));
    if (!isValidNumber && !isValidString) {
      return false;
    }
  }

  return true;
}

/**
 * Check if array contains valid OHLC data points
 */
export function isOHLCDataArray(data: unknown): data is OhlcData[] {
  if (!Array.isArray(data)) {
    return false;
  }

  // Empty arrays are valid
  if (data.length === 0) {
    return true;
  }

  // All items must be valid OHLC data points
  return data.every((item) => isOHLCDataPoint(item));
}

/**
 * Validate and extract price items from a response
 * Returns an array of validated price items
 */
export function extractPriceItems(data: unknown): PriceItem[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  const response = data as Record<string, unknown>;
  const items: PriceItem[] = [];

  for (const key in response) {
    if (isPriceItem(response[key])) {
      items.push(response[key] as PriceItem);
    }
  }

  return items;
}

/**
 * Safe type assertion for market data response
 * Throws error with detailed message if validation fails
 */
export function assertMarketDataResponse(
  data: unknown,
  expectedFields: string[],
  context: string,
): asserts data is Record<string, PriceItem> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${context}: Invalid response structure - expected object`);
  }

  const response = data as Record<string, unknown>;

  // Check all expected fields are present
  for (const field of expectedFields) {
    if (!(field in response)) {
      throw new Error(`${context}: Missing required field "${field}"`);
    }

    if (!isPriceItem(response[field])) {
      throw new Error(`${context}: Invalid structure for field "${field}"`);
    }
  }
}

// Legacy exports for backwards compatibility
export const isNavasanPriceItem = isPriceItem;
export const assertNavasanResponse = assertMarketDataResponse;
