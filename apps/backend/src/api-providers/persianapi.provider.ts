import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  IApiProvider,
  FetchParams,
  CurrencyData,
  CryptoData,
  GoldData,
  CoinData,
  AvailableItems,
  RateLimitStatus,
  ApiProviderMetadata,
  ApiProviderError,
} from './api-provider.interface';

/**
 * Type definitions for PersianAPI responses
 * These provide compile-time type checking for better code quality
 */
interface PersianApiCurrencyResponse {
  Key?: string;
  key?: string;
  Title?: string;
  title?: string;
  عنوان?: string;
  Price?: number | string;
  price?: number | string;
  قیمت?: number | string;
  Change?: number | string;
  change?: number | string;
  High?: number | string;
  high?: number | string;
  بیشترین?: number | string;
  Low?: number | string;
  low?: number | string;
  کمترین?: number | string;
  created_at?: string | Date;
  'تاریخ بروزرسانی'?: string | Date;
  Category?: string;
  category?: string;
}

interface PersianApiCryptoResponse {
  symbol?: string;
  slug?: string;
  name?: string;
  title?: string;
  'Usd-price'?: number | string;
  price?: number | string;
  price_irt?: number | string;
  high24h?: number | string;
  low24h?: number | string;
  percent_change_24h?: number | string;
}

interface PersianApiGoldResponse {
  Key?: string;
  key?: string;
  عنوان?: string;
  title?: string;
  Title?: string;
  قیمت?: number | string;
  price?: number | string;
  Price?: number | string;
  بیشترین?: number | string;
  high?: number | string;
  کمترین?: number | string;
  low?: number | string;
  'تاریخ بروزرسانی'?: string | Date;
  updated_at?: string | Date;
  category?: string;
}

interface PersianApiCoinResponse {
  Key?: string;
  key?: string;
  عنوان?: string;
  title?: string;
  Title?: string;
  قیمت?: number | string;
  price?: number | string;
  Price?: number | string;
  بیشترین?: number | string;
  high?: number | string;
  کمترین?: number | string;
  low?: number | string;
  'تاریخ بروزرسانی'?: string | Date;
  updated_at?: string | Date;
}

/**
 * PersianAPI Provider Implementation
 *
 * Integrates with PersianAPI (https://workspace.persianapi.com)
 * Rate limit: 1 request per 5 seconds = 720 requests/hour
 */
@Injectable()
export class PersianApiProvider implements IApiProvider {
  private readonly logger = new Logger(PersianApiProvider.name);
  private readonly baseUrl = 'https://studio.persianapi.com/web-service';
  private readonly apiKey: string;
  private readonly timeout = 10000; // 10 seconds

  // Rate limiting tracking
  private lastRequestTime = 0;
  private requestCount = 0;
  private rateLimitReset = new Date();

  // Request deduplication - cache in-flight requests to avoid duplicate API calls
  private requestCache = new Map<string, Promise<any>>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('PERSIANAPI_KEY') || '';
    if (!this.apiKey) {
      throw new Error('PERSIANAPI_KEY is required but not configured in environment variables');
    }
  }

  getMetadata(): ApiProviderMetadata {
    return {
      name: 'PersianAPI',
      version: '1.0',
      baseUrl: this.baseUrl,
      requiresAuth: true,
      rateLimitPerSecond: 0.2, // 1 request per 5 seconds
    };
  }

  /**
   * Fetch currencies from common/forex endpoint
   */
  async fetchCurrencies(params?: FetchParams): Promise<CurrencyData[]> {
    try {
      const response = await this.makeRequestWithDedup('/common/forex', params);

      if (!Array.isArray(response)) {
        throw new ApiProviderError('Invalid response format: expected array', 500, 'PersianAPI');
      }

      return response.map((item) => this.mapToCurrencyData(item));
    } catch (error: any) {
      this.logger.error('Failed to fetch currencies from PersianAPI', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch cryptocurrencies from common/digitalcurrency endpoint
   */
  async fetchCrypto(params?: FetchParams): Promise<CryptoData[]> {
    try {
      const response = await this.makeRequestWithDedup('/common/digitalcurrency', params);

      if (!Array.isArray(response)) {
        this.logger.error(`Invalid response format: expected array, got ${typeof response}`);
        throw new ApiProviderError('Invalid response format: expected array', 500, 'PersianAPI');
      }

      return response.map((item) => this.mapToCryptoData(item));
    } catch (error: any) {
      this.logger.error('Failed to fetch crypto from PersianAPI', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch gold prices from gold endpoint
   */
  async fetchGold(params?: FetchParams): Promise<GoldData[]> {
    try {
      const response = await this.makeRequestWithDedup('/gold', params);

      if (!Array.isArray(response)) {
        throw new ApiProviderError('Invalid response format: expected array', 500, 'PersianAPI');
      }

      return response.map((item) => this.mapToGoldData(item));
    } catch (error: any) {
      this.logger.error('Failed to fetch gold from PersianAPI', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch coin prices from coin/cash endpoint
   */
  async fetchCoins(params?: FetchParams): Promise<CoinData[]> {
    try {
      const response = await this.makeRequestWithDedup('/coin/cash', params);

      if (!Array.isArray(response)) {
        throw new ApiProviderError('Invalid response format: expected array', 500, 'PersianAPI');
      }

      return response.map((item) => this.mapToCoinData(item));
    } catch (error: any) {
      this.logger.error('Failed to fetch coins from PersianAPI', error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch all data types in parallel
   */
  async fetchAll(params?: FetchParams): Promise<{
    currencies: CurrencyData[];
    crypto: CryptoData[];
    gold: GoldData[];
    coins: CoinData[];
  }> {
    try {
      const [currencies, crypto, gold, coins] = await Promise.allSettled([
        this.fetchCurrencies(params),
        this.fetchCrypto(params),
        this.fetchGold(params),
        this.fetchCoins(params),
      ]);

      return {
        currencies: currencies.status === 'fulfilled' ? currencies.value : [],
        crypto: crypto.status === 'fulfilled' ? crypto.value : [],
        gold: gold.status === 'fulfilled' ? gold.value : [],
        coins: coins.status === 'fulfilled' ? coins.value : [],
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch all data from PersianAPI', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get available items from API
   * Note: PersianAPI returns all items in responses, so we fetch once and extract unique codes
   */
  async getAvailableItems(): Promise<AvailableItems> {
    try {
      const [currencies, crypto, gold, coins] = await Promise.all([
        this.fetchCurrencies({ limit: 100 }),
        this.fetchCrypto({ limit: 100 }),
        this.fetchGold({ limit: 100 }),
        this.fetchCoins({ limit: 100 }),
      ]);

      return {
        currencies: currencies.map((item) => ({
          code: item.code,
          name: item.name,
          type: 'currency' as const,
          category: item.category,
        })),
        crypto: crypto.map((item) => ({
          code: item.code,
          name: item.name,
          type: 'crypto' as const,
        })),
        gold: gold.map((item) => ({
          code: item.code,
          name: item.name,
          type: 'gold' as const,
          category: item.category,
        })),
        coins: coins.map((item) => ({
          code: item.code,
          name: item.name,
          type: 'coin' as const,
        })),
      };
    } catch (error: any) {
      this.logger.error('Failed to get available items from PersianAPI', error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.makeRequestWithDedup('/common/forex', { limit: 1 });
      return true;
    } catch (error: any) {
      if (error?.statusCode === 401 || error?.statusCode === 403) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(): Promise<RateLimitStatus> {
    const now = Date.now();
    const secondsSinceLastRequest = (now - this.lastRequestTime) / 1000;

    // PersianAPI: 1 request per 5 seconds
    const remaining = secondsSinceLastRequest >= 5 ? 1 : 0;

    return {
      remaining,
      reset: new Date(this.lastRequestTime + 5000), // 5 seconds from last request
      total: 720, // 720 requests per hour (1 per 5 seconds)
    };
  }

  /**
   * Make HTTP request with deduplication to prevent multiple simultaneous requests
   * Caches the Promise (not the result) to share in-flight requests
   * Cache entry is cleared after 1 second
   */
  private async makeRequestWithDedup(endpoint: string, params?: FetchParams): Promise<any> {
    // Create cache key from endpoint and params
    const cacheKey = `${endpoint}-${JSON.stringify(params || {})}`;

    // Check if there's already an in-flight request for this key
    const existingRequest = this.requestCache.get(cacheKey);
    if (existingRequest) {
      this.logger.debug(`Using deduplicated request for ${endpoint}`);
      return existingRequest;
    }

    // Create new request and cache the Promise
    const requestPromise = this.makeRequestWithRetry(endpoint, params);
    this.requestCache.set(cacheKey, requestPromise);

    // Clear cache entry after 1 second
    setTimeout(() => {
      this.requestCache.delete(cacheKey);
    }, 1000);

    try {
      const result = await requestPromise;
      return result;
    } catch (error) {
      // Remove from cache on error to allow retry
      this.requestCache.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Make HTTP request with retry logic and exponential backoff
   * Retries up to 3 times with delays of 1s, 2s, 4s (capped at 10s)
   * Only retries if error is marked as retryable
   */
  private async makeRequestWithRetry(endpoint: string, params?: FetchParams): Promise<any> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest(endpoint, params);
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = error?.retryable === true || error?.statusCode >= 500;

        if (!isRetryable || attempt === maxRetries) {
          // Don't retry if error is not retryable or we've exhausted retries
          throw error;
        }

        // Calculate backoff delay: 1s, 2s, 4s, capped at 10s
        const baseDelay = 1000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);

        this.logger.warn(
          `Request to ${endpoint} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
          `Retrying in ${delay}ms... Error: ${error?.message || 'Unknown error'}`
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
  }

  /**
   * Make HTTP request to PersianAPI
   */
  private async makeRequest(endpoint: string, params?: FetchParams): Promise<any> {
    // Respect rate limit: wait if needed
    await this.respectRateLimit();

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    const queryParams = {
      format: params?.format || 'json',
      limit: params?.limit || 30,
      page: params?.page || 1,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers,
          params: queryParams,
          timeout: this.timeout,
        }),
      );

      this.updateRateLimitTracking();

      // PersianAPI wraps data in different structures depending on endpoint
      // Check for result.data (used by forex, gold, coins endpoints)
      if (response.data?.result?.data) {
        return response.data.result.data;
      }

      // Check for result.list (used by crypto endpoint)
      if (response.data?.result?.list) {
        return response.data.result.list;
      }

      // Some endpoints might return direct data
      return response.data;
    } catch (error: any) {
      if (error?.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.message;

        this.logger.error(
          `PersianAPI request failed: ${status} - ${message}`,
          error.response.data,
        );

        throw new ApiProviderError(message, status, 'PersianAPI', status >= 500);
      }

      throw new ApiProviderError(
        error?.message || 'Unknown error',
        500,
        'PersianAPI',
        true,
      );
    }
  }

  /**
   * Respect rate limit: wait if necessary
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 5000; // 5 seconds

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      this.logger.debug(`Rate limit: waiting ${waitTime}ms before next request`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Update rate limit tracking
   */
  private updateRateLimitTracking(): void {
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Map PersianAPI currency response to standard format
   */
  private mapToCurrencyData(item: PersianApiCurrencyResponse): CurrencyData {
    return {
      code: item.Key || item.key || 'unknown',
      name: item.Title || item.title || item.عنوان || 'Unknown',
      price: this.parsePrice(item.Price || item.price || item.قیمت),
      change: this.parsePrice(item.Change || item.change),
      high: this.parsePrice(item.High || item.high || item.بیشترین),
      low: this.parsePrice(item.Low || item.low || item.کمترین),
      updatedAt: this.parseDate(item.created_at || item['تاریخ بروزرسانی']),
      category: item.Category || item.category,
    };
  }

  /**
   * Map PersianAPI crypto response to standard format
   */
  private mapToCryptoData(item: PersianApiCryptoResponse): CryptoData {
    return {
      code: item.symbol?.toLowerCase() || item.slug || 'unknown',
      name: item.name || item.title || 'Unknown',
      symbol: item.symbol || 'UNKNOWN',
      price: this.parsePrice(item['Usd-price'] || item.price),
      priceIrt: this.parsePrice(item.price_irt),
      high24h: this.parsePrice(item.high24h),
      low24h: this.parsePrice(item.low24h),
      change24h: this.parsePrice(item['percent_change_24h']),
      updatedAt: new Date(),
    };
  }

  /**
   * Map PersianAPI gold response to standard format
   */
  private mapToGoldData(item: PersianApiGoldResponse): GoldData {
    return {
      code: item.Key || item.key || 'unknown',
      name: item.عنوان || item.title || item.Title || 'Unknown',
      price: this.parsePrice(item.قیمت || item.price || item.Price),
      high: this.parsePrice(item.بیشترین || item.high),
      low: this.parsePrice(item.کمترین || item.low),
      updatedAt: this.parseDate(item['تاریخ بروزرسانی'] || item.updated_at),
      category: item.category,
    };
  }

  /**
   * Map PersianAPI coin response to standard format
   */
  private mapToCoinData(item: PersianApiCoinResponse): CoinData {
    return {
      code: item.Key || item.key || 'unknown',
      name: item.عنوان || item.title || item.Title || 'Unknown',
      price: this.parsePrice(item.قیمت || item.price || item.Price),
      high: this.parsePrice(item.بیشترین || item.high),
      low: this.parsePrice(item.کمترین || item.low),
      updatedAt: this.parseDate(item['تاریخ بروزرسانی'] || item.updated_at),
    };
  }

  /**
   * Parse price from string or number
   * Logs warnings when parsing fails to help debug data issues
   */
  private parsePrice(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'number') {
      if (isNaN(value) || !isFinite(value)) {
        this.logger.warn(`parsePrice: Invalid number value: ${value}`);
        return 0;
      }
      return value;
    }

    if (typeof value === 'string') {
      // Remove commas and parse
      const cleaned = value.replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed)) {
        this.logger.warn(`parsePrice: Failed to parse string value: "${value}"`);
        return 0;
      }
      return parsed;
    }

    this.logger.warn(`parsePrice: Unexpected value type: ${typeof value}, value: ${value}`);
    return 0;
  }

  /**
   * Parse date from various formats
   * Logs warnings when parsing fails to help debug data issues
   */
  private parseDate(value: any): Date {
    if (!value) {
      this.logger.warn('parseDate: Empty or null value provided, using current date');
      return new Date();
    }

    if (value instanceof Date) {
      // Validate that the Date object is valid
      if (isNaN(value.getTime())) {
        this.logger.warn('parseDate: Invalid Date object provided, using current date');
        return new Date();
      }
      return value;
    }

    try {
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) {
        this.logger.warn(`parseDate: Failed to parse date value: "${value}", using current date`);
        return new Date();
      }
      return parsed;
    } catch (error) {
      this.logger.warn(`parseDate: Exception parsing date value: "${value}", using current date`);
      return new Date();
    }
  }

  /**
   * Handle errors and convert to ApiProviderError
   */
  private handleError(error: any): ApiProviderError {
    if (error instanceof ApiProviderError) {
      return error;
    }

    return new ApiProviderError(
      error?.message || 'Unknown error occurred',
      error?.statusCode || 500,
      'PersianAPI',
      true,
    );
  }
}
