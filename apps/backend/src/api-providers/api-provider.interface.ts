/**
 * API Provider Interface
 *
 * Defines the contract that all API providers must implement.
 * This allows switching between different data sources (PersianAPI, Navasan, etc.)
 * without changing business logic.
 */

export interface FetchParams {
  limit?: number;
  page?: number;
  format?: "json" | "xml";
}

export interface RateLimitStatus {
  remaining: number;
  reset: Date;
  total: number;
}

export interface CurrencyData {
  code: string; // e.g., 'usd_sell'
  name: string; // Display name
  price: number; // Current price
  change?: number; // 24h change amount
  changePercent?: number; // 24h change percentage
  high?: number; // 24h high
  low?: number; // 24h low
  updatedAt: Date; // Last update timestamp
  category?: string; // e.g., 'major', 'minor'
}

export interface CryptoData {
  code: string; // e.g., 'btc'
  name: string; // e.g., 'Bitcoin'
  symbol: string; // e.g., 'BTC'
  price: number; // Current price in USD
  priceIrt: number; // Price in Iranian Rial (raw from API, converted to Toman at display time)
  high24h?: number;
  low24h?: number;
  change1h?: number; // 1 hour change %
  change24h?: number; // 24 hour change %
  change7d?: number; // 7 day change %
  marketCap?: number;
  volume24h?: number;
  updatedAt: Date;
}

export interface GoldData {
  code: string; // e.g., 'sekkeh'
  name: string; // e.g., 'سکه امامی'
  price: number; // Current price
  high?: number; // Daily high
  low?: number; // Daily low
  updatedAt: Date;
  category?: string; // e.g., 'coin', 'bar'
}

export interface CoinData {
  code: string; // e.g., 'bahar'
  name: string;
  price: number;
  high?: number;
  low?: number;
  updatedAt: Date;
}

export interface AvailableItem {
  code: string;
  name: string;
  type: "currency" | "crypto" | "gold" | "coin";
  category?: string;
}

export interface AvailableItems {
  currencies: AvailableItem[];
  crypto: AvailableItem[];
  gold: AvailableItem[];
  coins: AvailableItem[];
}

export interface ApiProviderMetadata {
  name: string;
  version: string;
  baseUrl: string;
  requiresAuth: boolean;
  rateLimitPerSecond: number;
}

/**
 * Main API Provider Interface
 *
 * All API providers (PersianAPI, Navasan, etc.) must implement this interface
 */
export interface IApiProvider {
  /**
   * Provider metadata
   */
  getMetadata(): ApiProviderMetadata;

  /**
   * Fetch all currencies
   */
  fetchCurrencies(params?: FetchParams): Promise<CurrencyData[]>;

  /**
   * Fetch all cryptocurrencies
   */
  fetchCrypto(params?: FetchParams): Promise<CryptoData[]>;

  /**
   * Fetch gold prices
   */
  fetchGold(params?: FetchParams): Promise<GoldData[]>;

  /**
   * Fetch coin prices
   */
  fetchCoins(params?: FetchParams): Promise<CoinData[]>;

  /**
   * Fetch all data types in parallel
   */
  fetchAll(params?: FetchParams): Promise<{
    currencies: CurrencyData[];
    crypto: CryptoData[];
    gold: GoldData[];
    coins: CoinData[];
  }>;

  /**
   * Get list of available items from API
   */
  getAvailableItems(): Promise<AvailableItems>;

  /**
   * Validate API key and check connectivity
   */
  validateApiKey(): Promise<boolean>;

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): Promise<RateLimitStatus>;
}

/**
 * API Provider Error
 */
export class ApiProviderError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public provider?: string,
    public retryable?: boolean,
  ) {
    super(message);
    this.name = "ApiProviderError";
  }
}
