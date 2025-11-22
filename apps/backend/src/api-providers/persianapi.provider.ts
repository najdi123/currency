import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as fs from "fs";
import * as path from "path";
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
} from "./api-provider.interface";
import { CategoryMatcher } from "./category-matcher";
import { ErrorTracker } from "./error-tracker";
import { PerformanceMonitor } from "./performance-monitor";

/**
 * Type definitions for PersianAPI responses
 * These provide compile-time type checking for better code quality
 */

/**
 * Combined response item from /common/gold-currency-coin endpoint
 * This endpoint returns currencies, gold, and coins in a single response
 */
interface PersianApiCombinedItem {
  key: number | string;
  title?: string;
  Title?: string;
  عنوان?: string;
  price?: number | string;
  Price?: number | string;
  قیمت?: number | string;
  change?: number | string;
  Change?: number | string;
  high?: number | string;
  High?: number | string;
  بیشترین?: number | string;
  low?: number | string;
  Low?: number | string;
  کمترین?: number | string;
  category?: string;
  Category?: string;
  created_at?: string | Date;
  "تاریخ بروزرسانی"?: string | Date;
}

/**
 * Response structure from /common/gold-currency-coin endpoint
 */
interface PersianApiCombinedResponse {
  result: PersianApiCombinedItem[];
}

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
  "تاریخ بروزرسانی"?: string | Date;
  Category?: string;
  category?: string;
}

interface PersianApiCryptoResponse {
  symbol?: string;
  slug?: string;
  name?: string;
  title?: string;
  "Usd-price"?: number | string;
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
  "تاریخ بروزرسانی"?: string | Date;
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
  "تاریخ بروزرسانی"?: string | Date;
  updated_at?: string | Date;
}

/**
 * Key mapping structure loaded from external JSON configuration
 */
interface KeyMappingConfig {
  currencies: Record<string, { code: string; name: string; category: string }>;
  gold: Record<string, { code: string; name: string; category: string }>;
  coins: Record<string, { code: string; name: string; category: string }>;
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
  private readonly baseUrl = "https://studio.persianapi.com/web-service";
  private readonly apiKey: string;
  private readonly timeout = 10000; // 10 seconds

  // Rate limiting - Token bucket implementation
  private tokens = 1; // Start with 1 token
  private readonly maxTokens = 1; // Maximum 1 token (rate: 1 req per 5 seconds)
  private readonly tokenRefillRate = 1 / 5000; // 1 token per 5000ms
  private lastRefillTime = Date.now();

  // Request deduplication - cache in-flight requests to avoid duplicate API calls
  private requestCache = new Map<string, Promise<any>>();
  private readonly cacheTTL = 5000; // 5 seconds cache TTL

  // Category matcher for type-safe filtering
  private readonly categoryMatcher = new CategoryMatcher();

  // Error tracking with circuit breaker
  private readonly errorTracker = new ErrorTracker(5, 60000);

  // Performance monitoring
  private readonly performanceMonitor = new PerformanceMonitor(1000);

  // Key mapping loaded from external JSON file
  private keyMapping: Record<number, string> = {};

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>("PERSIANAPI_KEY") || "";
    if (!this.apiKey) {
      throw new Error(
        "PERSIANAPI_KEY is required but not configured in environment variables",
      );
    }
    this.loadKeyMapping();
  }

  /**
   * Validate key mapping configuration structure
   */
  private validateKeyMappingConfig(config: any): config is KeyMappingConfig {
    const requiredSections = ["currencies", "gold", "coins"];
    const requiredFields = ["code", "name", "category"];

    // Check top-level structure
    for (const section of requiredSections) {
      if (!config[section] || typeof config[section] !== "object") {
        throw new Error(`Missing or invalid section: ${section}`);
      }
    }

    // Validate each item in each section
    const seenCodes = new Set<string>();
    const seenKeys = new Set<string>();

    for (const section of requiredSections) {
      for (const [key, value] of Object.entries(config[section])) {
        // Validate key is numeric
        if (!/^\d+$/.test(key)) {
          throw new Error(`Invalid numeric key in ${section}: ${key}`);
        }

        // Check for duplicate keys
        if (seenKeys.has(key)) {
          throw new Error(`Duplicate key found: ${key}`);
        }
        seenKeys.add(key);

        // Validate item structure
        if (!value || typeof value !== "object") {
          throw new Error(`Invalid item structure for ${section}[${key}]`);
        }

        // Check required fields
        for (const field of requiredFields) {
          if (!(value as any)[field]) {
            throw new Error(
              `Missing required field '${field}' in ${section}[${key}]`,
            );
          }
        }

        // Check for duplicate codes
        const itemCode = (value as any).code;
        if (seenCodes.has(itemCode)) {
          throw new Error(
            `Duplicate code found: ${itemCode} in ${section}[${key}]`,
          );
        }
        seenCodes.add(itemCode);
      }
    }

    this.logger.debug(
      `✅ Config validation passed: ${seenKeys.size} items, ${seenCodes.size} unique codes`,
    );
    return true;
  }

  /**
   * Load key mapping from external JSON configuration file
   */
  private loadKeyMapping(): void {
    try {
      // Try multiple paths: development and production
      const possiblePaths = [
        path.join(__dirname, "persianapi-key-mapping.json"),
        path.join(
          __dirname,
          "..",
          "..",
          "src",
          "api-providers",
          "persianapi-key-mapping.json",
        ),
        path.join(
          process.cwd(),
          "apps",
          "backend",
          "src",
          "api-providers",
          "persianapi-key-mapping.json",
        ),
        path.join(
          process.cwd(),
          "src",
          "api-providers",
          "persianapi-key-mapping.json",
        ),
      ];

      let configData: string | null = null;
      let loadedFrom: string | null = null;

      for (const configPath of possiblePaths) {
        try {
          if (fs.existsSync(configPath)) {
            configData = fs.readFileSync(configPath, "utf-8");
            loadedFrom = configPath;
            break;
          }
        } catch (err) {
          // Try next path
          continue;
        }
      }

      if (!configData) {
        throw new Error(
          "Configuration file not found in any expected location",
        );
      }

      const config = JSON.parse(configData);

      // Validate configuration structure
      this.validateKeyMappingConfig(config);

      // Now we can safely cast to KeyMappingConfig after validation
      const validatedConfig = config as KeyMappingConfig;

      // Flatten all mappings into a single numeric key -> string code map
      const flatMapping: Record<number, string> = {};

      Object.entries(validatedConfig.currencies).forEach(([key, value]) => {
        flatMapping[parseInt(key, 10)] = value.code;
      });

      Object.entries(validatedConfig.gold).forEach(([key, value]) => {
        flatMapping[parseInt(key, 10)] = value.code;
      });

      Object.entries(validatedConfig.coins).forEach(([key, value]) => {
        flatMapping[parseInt(key, 10)] = value.code;
      });

      this.keyMapping = flatMapping;
      this.logger.log(
        `✅ Loaded ${Object.keys(flatMapping).length} key mappings from ${loadedFrom}`,
      );
    } catch (error: any) {
      this.logger.warn(
        `Failed to load key mapping configuration: ${error?.message || "Unknown error"}`,
      );
      this.logger.warn("Using fallback code generation");
      // If file doesn't exist or validation fails, we'll fall back to generateCurrencyCode()
      // This is not a critical error - the fallback system works fine
    }
  }

  getMetadata(): ApiProviderMetadata {
    return {
      name: "PersianAPI",
      version: "1.0",
      baseUrl: this.baseUrl,
      requiresAuth: true,
      rateLimitPerSecond: 0.2, // 1 request per 5 seconds
    };
  }

  /**
   * Fetch combined data from /common/gold-currency-coin endpoint and categorize
   * This is the core data fetching method that all other fetch methods use
   */
  private async fetchCombinedData(params?: FetchParams): Promise<{
    currencies: PersianApiCombinedItem[];
    gold: PersianApiCombinedItem[];
    coins: PersianApiCombinedItem[];
  }> {
    const response = await this.makeRequestWithDedup(
      "/common/gold-currency-coin",
      {
        ...params,
        limit: 100,
      },
    );

    if (!response || !response.result || !Array.isArray(response.result)) {
      throw new ApiProviderError(
        "Invalid response format: expected result array",
        500,
        "PersianAPI",
      );
    }

    // Use CategoryMatcher for type-safe filtering
    return this.categoryMatcher.categorize(response.result);
  }

  /**
   * Fetch currencies from common/gold-currency-coin endpoint
   * This endpoint works with Base Package and returns all data in one call
   */
  async fetchCurrencies(params?: FetchParams): Promise<CurrencyData[]> {
    try {
      const { currencies: currencyItems } =
        await this.fetchCombinedData(params);

      // Map to CurrencyData
      const currencies = currencyItems.map((item) =>
        this.mapToCurrencyData(item),
      );

      this.logger.log(
        `✅ Fetched ${currencies.length} currencies from PersianAPI`,
      );
      return currencies;
    } catch (error: any) {
      this.logger.error("Failed to fetch currencies from PersianAPI", error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch cryptocurrencies from common/gold-currency-coin endpoint
   * NOTE: Base Package may not include crypto data
   */
  async fetchCrypto(params?: FetchParams): Promise<CryptoData[]> {
    try {
      // Try to use digitalcurrency endpoint, but it may fail with Base Package
      const response = await this.makeRequestWithDedup(
        "/common/digitalcurrency",
        params,
      );

      if (!Array.isArray(response)) {
        this.logger.warn(`Crypto endpoint not available with Base Package`);
        return [];
      }

      return response.map((item) => this.mapToCryptoData(item));
    } catch (error: any) {
      this.logger.warn("Crypto data not available (Base Package limitation)");
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Fetch gold prices from common/gold-currency-coin endpoint
   */
  async fetchGold(params?: FetchParams): Promise<GoldData[]> {
    try {
      const { gold: goldItems } = await this.fetchCombinedData(params);

      const gold = goldItems.map((item) => this.mapToGoldData(item));
      this.logger.log(`✅ Fetched ${gold.length} gold items from PersianAPI`);
      return gold;
    } catch (error: any) {
      this.logger.error("Failed to fetch gold from PersianAPI", error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch coin prices from common/gold-currency-coin endpoint
   */
  async fetchCoins(params?: FetchParams): Promise<CoinData[]> {
    try {
      const { coins: coinItems } = await this.fetchCombinedData(params);

      const coins = coinItems.map((item) => this.mapToCoinData(item));
      this.logger.log(`✅ Fetched ${coins.length} coins from PersianAPI`);
      return coins;
    } catch (error: any) {
      this.logger.error("Failed to fetch coins from PersianAPI", error);
      throw this.handleError(error);
    }
  }

  /**
   * Fetch all data types efficiently with a single API call
   * This is much more efficient than calling fetchCurrencies, fetchGold, fetchCoins separately
   */
  async fetchAll(params?: FetchParams): Promise<{
    currencies: CurrencyData[];
    crypto: CryptoData[];
    gold: GoldData[];
    coins: CoinData[];
  }> {
    try {
      // Fetch combined data once (currencies, gold, coins from single endpoint)
      const combinedData = await this.fetchCombinedData(params);

      // Fetch crypto separately (different endpoint, may fail with Base Package)
      const cryptoPromise = this.fetchCrypto(params).catch(() => []);

      const [crypto] = await Promise.all([cryptoPromise]);

      return {
        currencies: combinedData.currencies.map((item) =>
          this.mapToCurrencyData(item),
        ),
        crypto,
        gold: combinedData.gold.map((item) => this.mapToGoldData(item)),
        coins: combinedData.coins.map((item) => this.mapToCoinData(item)),
      };
    } catch (error: any) {
      this.logger.error("Failed to fetch all data from PersianAPI", error);
      throw this.handleError(error);
    }
  }

  /**
   * Get available items from API
   * Optimized to use single API call for currencies, gold, and coins
   */
  async getAvailableItems(): Promise<AvailableItems> {
    try {
      // Use fetchAll which is already optimized to make minimal API calls
      const allData = await this.fetchAll({ limit: 100 });

      return {
        currencies: allData.currencies.map((item) => ({
          code: item.code,
          name: item.name,
          type: "currency" as const,
          category: item.category,
        })),
        crypto: allData.crypto.map((item) => ({
          code: item.code,
          name: item.name,
          type: "crypto" as const,
        })),
        gold: allData.gold.map((item) => ({
          code: item.code,
          name: item.name,
          type: "gold" as const,
          category: item.category,
        })),
        coins: allData.coins.map((item) => ({
          code: item.code,
          name: item.name,
          type: "coin" as const,
        })),
      };
    } catch (error: any) {
      this.logger.error("Failed to get available items from PersianAPI", error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.makeRequestWithDedup("/common/forex", { limit: 1 });
      return true;
    } catch (error: any) {
      if (error?.statusCode === 401 || error?.statusCode === 403) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get current rate limit status using token bucket algorithm
   */
  async getRateLimitStatus(): Promise<RateLimitStatus> {
    this.refillTokens();

    return {
      remaining: Math.floor(this.tokens),
      reset: new Date(Date.now() + 5000), // Next token in 5 seconds
      total: 720, // 720 requests per hour (1 per 5 seconds)
    };
  }

  /**
   * Refill tokens based on time elapsed (Token Bucket algorithm)
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = timePassed * this.tokenRefillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Wait for a token to become available (Token Bucket algorithm)
   */
  private async waitForToken(): Promise<void> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time needed for next token
    const tokensNeeded = 1 - this.tokens;
    const waitTime = Math.ceil(tokensNeeded / this.tokenRefillRate);

    this.logger.debug(`Rate limit: waiting ${waitTime}ms for next token`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // Refill and consume token after waiting
    this.refillTokens();
    this.tokens -= 1;
  }

  /**
   * Make HTTP request with deduplication to prevent multiple simultaneous requests
   * Caches the Promise (not the result) to share in-flight requests
   * Cache entry is cleared after configurable TTL
   */
  private async makeRequestWithDedup(
    endpoint: string,
    params?: FetchParams,
  ): Promise<any> {
    return this.performanceMonitor.measure(
      `api-request:${endpoint}`,
      async () => {
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

        // Clear cache entry after configurable TTL
        setTimeout(() => {
          this.requestCache.delete(cacheKey);
        }, this.cacheTTL);

        try {
          const result = await requestPromise;
          return result;
        } catch (error) {
          // Remove from cache on error to allow retry
          this.requestCache.delete(cacheKey);
          throw error;
        }
      },
    );
  }

  /**
   * Make HTTP request with retry logic and exponential backoff
   * Retries up to 3 times with delays of 1s, 2s, 4s (capped at 10s)
   * Only retries if error is marked as retryable
   */
  private async makeRequestWithRetry(
    endpoint: string,
    params?: FetchParams,
  ): Promise<any> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest(endpoint, params);
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable =
          error?.retryable === true || error?.statusCode >= 500;

        if (!isRetryable || attempt === maxRetries) {
          // Don't retry if error is not retryable or we've exhausted retries
          throw error;
        }

        // Calculate backoff delay: 1s, 2s, 4s, capped at 10s
        const baseDelay = 1000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);

        this.logger.warn(
          `Request to ${endpoint} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
            `Retrying in ${delay}ms... Error: ${error?.message || "Unknown error"}`,
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
  }

  /**
   * Make HTTP request to PersianAPI using token bucket rate limiting
   */
  private async makeRequest(
    endpoint: string,
    params?: FetchParams,
  ): Promise<any> {
    // Wait for token to become available (Token Bucket algorithm)
    await this.waitForToken();

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    const queryParams = {
      format: params?.format || "json",
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

        throw new ApiProviderError(
          message,
          status,
          "PersianAPI",
          status >= 500,
        );
      }

      throw new ApiProviderError(
        error?.message || "Unknown error",
        500,
        "PersianAPI",
        true,
      );
    }
  }

  /**
   * Generate currency code from Persian title and category
   * Converts Persian currency names to English codes
   * Example: "دلار / یورو" + "تقاضا" → "usd_eur_buy"
   */
  private generateCurrencyCode(title: string, category?: string): string {
    // Persian to English currency name mapping
    // NOTE: Order matters! More specific matches must come first
    const currencyMap: Record<string, string> = {
      // Dollar variants (specific first!)
      "دلار استرالیا": "aud",
      "دلار سنگاپور": "sgd",
      "دلار کانادا": "cad",
      "دلار هنگ کنگ": "hkd",
      "دلار نیوزلند": "nzd",
      "دلار آمریکا": "usd",
      دلار: "usd",

      // Pound
      "پوند انگلیس": "gbp",
      پوند: "gbp",

      // Euro
      یورو: "eur",

      // Yen
      "ین ژاپن": "jpy",
      ین: "jpy",

      // Yuan
      "یوان چین": "cny",
      یوان: "cny",

      // Ruble
      "روبل روسیه": "rub",
      روبل: "rub",

      // Lira
      "لیره ترکیه": "try",
      لیره: "try",

      // Rupee
      "روپیه هند": "inr",
      "روپیه پاکستان": "pkr",
      روپیه: "inr",

      // Riyal
      "ریال عربستان": "sar",
      "ریال قطر": "qar",
      "ریال عمان": "omr",
      ریال: "sar",

      // Dirham
      "درهم امارات": "aed",
      درهم: "aed",

      // Dinar variants (specific first!)
      "دینار کویت": "kwd",
      "دینار عراق": "iqd",
      "دینار بحرین": "bhd",
      "دینار اردن": "jod",
      دینار: "kwd",

      // Krone/Krona variants
      "کرون دانمارک": "dkk",
      "کرون سوئد": "sek",
      "کرون نروژ": "nok",
      کرون: "sek",

      // Franc
      "فرانک سوئیس": "chf",
      فرانک: "chf",

      // Baht
      "بات تایلند": "thb",
      بات: "thb",

      // Ringgit
      "رینگیت مالزی": "myr",
      رینگیت: "myr",

      // Others
      "وون کره جنوبی": "krw",
      "پزو مکزیک": "mxn",
      "رند آفریقای جنوبی": "zar",
    };

    // Determine if it's buy or sell from category
    const isBuy = category?.includes("تقاضا"); // تقاضا = demand = buy
    const isSell = category?.includes("عرضه"); // عرضه = supply = sell
    const suffix = isBuy ? "_buy" : isSell ? "_sell" : "";

    // Helper function to find currency code in text (checks longest matches first)
    const findCurrencyCode = (text: string): string => {
      // Sort currency names by length (longest first) to match specific names before generic ones
      const sortedEntries = Object.entries(currencyMap).sort(
        (a, b) => b[0].length - a[0].length,
      );

      for (const [persian, english] of sortedEntries) {
        if (text.includes(persian)) {
          return english;
        }
      }

      // Fallback: use first 3 characters as code
      return text.substring(0, 3).toLowerCase();
    };

    // Split currency pair (e.g., "دلار / یورو" → ["دلار", "یورو"])
    const parts = title.split("/").map((p) => p.trim());

    if (parts.length === 2) {
      const firstCurrency = findCurrencyCode(parts[0]);
      const secondCurrency = findCurrencyCode(parts[1]);
      return `${firstCurrency}_${secondCurrency}${suffix}`;
    }

    // Fallback: try to match single currency
    const currencyCode = findCurrencyCode(title);
    if (currencyCode !== title.substring(0, 3).toLowerCase()) {
      return `${currencyCode}${suffix}`;
    }

    // Final fallback: use sanitized title
    return (
      title
        .substring(0, 20)
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase() + suffix
    );
  }

  /**
   * Extract field value from item with multiple possible field names
   * Helper to handle PersianAPI's inconsistent field naming (English/Persian/capitalization)
   */
  private extractField<T = any>(
    item: any,
    ...fieldNames: string[]
  ): T | undefined {
    for (const fieldName of fieldNames) {
      if (item[fieldName] !== undefined && item[fieldName] !== null) {
        return item[fieldName] as T;
      }
    }
    return undefined;
  }

  /**
   * Map PersianAPI combined item to CurrencyData format
   * Uses type-safe field extraction with error tracking
   */
  private mapToCurrencyData(item: PersianApiCombinedItem): CurrencyData {
    return this.performanceMonitor.measureSync("map-currency", () => {
      const context = `map-currency-${item.key}`;

      try {
        const title =
          this.extractField<string>(item, "title", "Title", "عنوان") ||
          "Unknown";
        const category = this.extractField<string>(
          item,
          "category",
          "Category",
        );
        const numericKey =
          typeof item.key === "number"
            ? item.key
            : parseInt(String(item.key), 10);

        // Use key mapping if available, otherwise generate code from title
        const code =
          this.keyMapping[numericKey] ||
          this.generateCurrencyCode(title, category);

        const result = {
          code,
          name: title,
          price: this.parsePrice(
            this.extractField(item, "price", "Price", "قیمت"),
          ),
          change: this.parsePrice(this.extractField(item, "change", "Change")),
          high: this.parsePrice(
            this.extractField(item, "high", "High", "بیشترین"),
          ),
          low: this.parsePrice(this.extractField(item, "low", "Low", "کمترین")),
          updatedAt: this.parseDate(
            this.extractField(item, "created_at", "تاریخ بروزرسانی"),
          ),
          category,
        };

        // Reset error counter on success
        this.errorTracker.resetError(context);

        return result;
      } catch (error) {
        this.errorTracker.trackError(context, error as Error);
        this.logger.error(`Failed to map currency item: ${item.key}`, {
          availableFields: Object.keys(item),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  }

  /**
   * Map PersianAPI crypto response to standard format
   */
  private mapToCryptoData(item: PersianApiCryptoResponse): CryptoData {
    return {
      code: item.symbol?.toLowerCase() || item.slug || "unknown",
      name: item.name || item.title || "Unknown",
      symbol: item.symbol || "UNKNOWN",
      price: this.parsePrice(item["Usd-price"] || item.price),
      priceIrt: this.parsePrice(item.price_irt),
      high24h: this.parsePrice(item.high24h),
      low24h: this.parsePrice(item.low24h),
      change24h: this.parsePrice(item["percent_change_24h"]),
      updatedAt: new Date(),
    };
  }

  /**
   * Map PersianAPI combined item to GoldData format
   * Uses type-safe field extraction
   */
  private mapToGoldData(item: PersianApiCombinedItem): GoldData {
    return this.performanceMonitor.measureSync("map-gold", () => {
      const context = `map-gold-${item.key}`;

      try {
        const numericKey =
          typeof item.key === "number"
            ? item.key
            : parseInt(String(item.key), 10);
        const code =
          this.keyMapping[numericKey] || String(item.key) || "unknown";

        const result = {
          code,
          name:
            this.extractField<string>(item, "عنوان", "title", "Title") ||
            "Unknown",
          price: this.parsePrice(
            this.extractField(item, "قیمت", "price", "Price"),
          ),
          high: this.parsePrice(
            this.extractField(item, "بیشترین", "high", "High"),
          ),
          low: this.parsePrice(this.extractField(item, "کمترین", "low", "Low")),
          updatedAt: this.parseDate(
            this.extractField(
              item,
              "تاریخ بروزرسانی",
              "updated_at",
              "created_at",
            ),
          ),
          category: this.extractField<string>(item, "category", "Category"),
        };

        // Reset error counter on success
        this.errorTracker.resetError(context);

        return result;
      } catch (error) {
        this.errorTracker.trackError(context, error as Error);
        this.logger.error(`Failed to map gold item: ${item.key}`, {
          availableFields: Object.keys(item),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  }

  /**
   * Map PersianAPI combined item to CoinData format
   * Uses type-safe field extraction
   */
  private mapToCoinData(item: PersianApiCombinedItem): CoinData {
    return this.performanceMonitor.measureSync("map-coin", () => {
      const context = `map-coin-${item.key}`;

      try {
        const numericKey =
          typeof item.key === "number"
            ? item.key
            : parseInt(String(item.key), 10);
        const code =
          this.keyMapping[numericKey] || String(item.key) || "unknown";

        const result = {
          code,
          name:
            this.extractField<string>(item, "عنوان", "title", "Title") ||
            "Unknown",
          price: this.parsePrice(
            this.extractField(item, "قیمت", "price", "Price"),
          ),
          high: this.parsePrice(
            this.extractField(item, "بیشترین", "high", "High"),
          ),
          low: this.parsePrice(this.extractField(item, "کمترین", "low", "Low")),
          updatedAt: this.parseDate(
            this.extractField(
              item,
              "تاریخ بروزرسانی",
              "updated_at",
              "created_at",
            ),
          ),
        };

        // Reset error counter on success
        this.errorTracker.resetError(context);

        return result;
      } catch (error) {
        this.errorTracker.trackError(context, error as Error);
        this.logger.error(`Failed to map coin item: ${item.key}`, {
          availableFields: Object.keys(item),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  }

  /**
   * Parse price from string or number
   * Logs warnings when parsing fails to help debug data issues
   */
  private parsePrice(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === "number") {
      if (isNaN(value) || !isFinite(value)) {
        this.logger.warn(`parsePrice: Invalid number value: ${value}`);
        return 0;
      }
      return value;
    }

    if (typeof value === "string") {
      // Remove commas and parse
      const cleaned = value.replace(/,/g, "");
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed)) {
        this.logger.warn(
          `parsePrice: Failed to parse string value: "${value}"`,
        );
        return 0;
      }
      return parsed;
    }

    this.logger.warn(
      `parsePrice: Unexpected value type: ${typeof value}, value: ${value}`,
    );
    return 0;
  }

  /**
   * Parse date from various formats
   * Logs warnings when parsing fails to help debug data issues
   */
  private parseDate(value: any): Date {
    if (!value) {
      this.logger.warn(
        "parseDate: Empty or null value provided, using current date",
      );
      return new Date();
    }

    if (value instanceof Date) {
      // Validate that the Date object is valid
      if (isNaN(value.getTime())) {
        this.logger.warn(
          "parseDate: Invalid Date object provided, using current date",
        );
        return new Date();
      }
      return value;
    }

    try {
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) {
        this.logger.warn(
          `parseDate: Failed to parse date value: "${value}", using current date`,
        );
        return new Date();
      }
      return parsed;
    } catch (error) {
      this.logger.warn(
        `parseDate: Exception parsing date value: "${value}", using current date`,
      );
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
      error?.message || "Unknown error occurred",
      error?.statusCode || 500,
      "PersianAPI",
      true,
    );
  }
}
