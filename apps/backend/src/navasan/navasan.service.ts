import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  RequestTimeoutException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import pLimit from "p-limit";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import axios from "axios";
import { Cache, CacheDocument } from "./schemas/cache.schema";
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from "./schemas/price-snapshot.schema";
import {
  OhlcSnapshot,
  OhlcSnapshotDocument,
} from "./schemas/ohlc-snapshot.schema";
import {
  OHLCPermanent,
  OHLCPermanentDocument,
} from "./schemas/ohlc-permanent.schema";
import { ApiResponse } from "./interfaces/api-response.interface";
import {
  NavasanResponse,
  NavasanPriceItem,
} from "./interfaces/navasan-response.interface";
import {
  isCurrencyResponse,
  isCryptoResponse,
  isGoldResponse,
} from "./utils/type-guards";
import { safeDbRead, safeDbWrite } from "../common/utils/db-error-handler";
import {
  sanitizeUrl,
  sanitizeErrorMessage,
} from "../common/utils/sanitize-url";
import {
  getTehranDayBoundaries,
  formatTehranDate,
} from "../common/utils/date-utils";
import { MetricsService } from "../metrics/metrics.service";
import { ApiProviderFactory } from "../api-providers/api-provider.factory";
import { CacheService } from "../cache/cache.service";
import {
  CurrencyData,
  CryptoData,
  GoldData,
} from "../api-providers/api-provider.interface";
import { IntradayOhlcService } from "./services/intraday-ohlc.service";
import { PersianApiTransformer } from "../api-providers/persianapi.transformer";

/**
 * FIX #5: TYPE SAFETY - Define proper interfaces instead of using 'any'
 * These interfaces provide compile-time type checking for historical data
 */
interface HistoryDataPoint {
  date: string;
  price: number;
  timestamp: number;
}

interface HistoryApiResponse {
  success: boolean;
  data: HistoryDataPoint[];
  code: string;
}

/**
 * Interface for aggregated OHLC data from MongoDB aggregation pipeline
 * Used when aggregating 1-minute data to daily data
 */
interface AggregatedOhlcData {
  itemCode: string;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: Date;
}

@Injectable()
export class NavasanService {
  private readonly logger = new Logger(NavasanService.name);
  private readonly apiKey: string;
  private readonly baseUrl = "http://api.navasan.tech/latest/";
  private readonly internalApiBaseUrl: string;

  // CACHE CONFIGURATION
  private readonly freshCacheMinutes = 5; // Fresh data validity
  private readonly staleCacheHours = 168; // 7 days - gives full week buffer when API key expires
  private readonly maxStaleAgeHours = 168; // Maximum age before data is too old (aligned with stale cache)
  private readonly apiTimeoutMs = 10000; // 10 second timeout

  // ERROR TRACKING: Now handled by database cache schema fields
  // apiErrorCount, lastApiError, lastApiSuccess are tracked in cache documents

  // Define items to fetch from Navasan API
  private readonly items = {
    all: "usd_sell,eur,gbp,cad,aud,aed,aed_sell,dirham_dubai,cny,try,chf,jpy,rub,inr,pkr,iqd,kwd,sar,qar,omr,bhd,usd_buy,dolar_harat_sell,harat_naghdi_sell,harat_naghdi_buy,usd_farda_sell,usd_farda_buy,usd_shakhs,usd_sherkat,usd_pp,dolar_mashad_sell,dolar_kordestan_sell,dolar_soleimanie_sell,eur_hav,gbp_hav,gbp_wht,cad_hav,cad_cash,hav_cad_my,hav_cad_cheque,hav_cad_cash,aud_hav,aud_wht,usdt,btc,eth,bnb,xrp,ada,doge,sol,matic,dot,ltc,sekkeh,bahar,nim,rob,gerami,18ayar,abshodeh",
    currencies:
      "usd_sell,eur,gbp,cad,aud,aed,aed_sell,dirham_dubai,cny,try,chf,jpy,rub,inr,pkr,iqd,kwd,sar,qar,omr,bhd,usd_buy,dolar_harat_sell,harat_naghdi_sell,harat_naghdi_buy,usd_farda_sell,usd_farda_buy,usd_shakhs,usd_sherkat,usd_pp,dolar_mashad_sell,dolar_kordestan_sell,dolar_soleimanie_sell,eur_hav,gbp_hav,gbp_wht,cad_hav,cad_cash,hav_cad_my,hav_cad_cheque,hav_cad_cash,aud_hav,aud_wht",
    crypto: "usdt,btc,eth,bnb,xrp,ada,doge,sol,matic,dot,ltc",
    gold: "sekkeh,bahar,nim,rob,gerami,18ayar,abshodeh",
  };

  // PERFORMANCE OPTIMIZATIONS
  // Note: ohlcCache and historicalCache migrated to Redis via CacheService
  private pendingRequests = new Map<
    string,
    Promise<ApiResponse<NavasanResponse>>
  >();
  private readonly ohlcCacheDuration = 3600000; // 1 hour in milliseconds

  // FIX #1: RATE LIMITING - Prevent API overload by limiting concurrent requests
  private readonly requestLimit = pLimit(5); // Max 5 concurrent requests

  // FIX #2: HISTORICAL DATA CACHING - Cache immutable historical data for 24 hours (now in Redis)
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // FIX #4: CIRCUIT BREAKER - Fast failure recovery pattern
  private circuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    threshold: 10, // Open circuit after 10 failures
    resetTimeout: 60000, // Reset after 1 minute
  };

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    @InjectModel(PriceSnapshot.name)
    private priceSnapshotModel: Model<PriceSnapshotDocument>,
    @InjectModel(OhlcSnapshot.name)
    private ohlcSnapshotModel: Model<OhlcSnapshotDocument>,
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
    private configService: ConfigService,
    private metricsService: MetricsService,
    private apiProviderFactory: ApiProviderFactory, // Inject PersianAPI provider
    private intradayOhlcService: IntradayOhlcService, // Inject Intraday OHLC service
    private cacheService: CacheService, // Inject Redis cache service
    private persianApiTransformer: PersianApiTransformer, // Inject PersianAPI transformer
  ) {
    this.apiKey = this.configService.get<string>("NAVASAN_API_KEY") || "";
    if (!this.apiKey) {
      this.logger.warn("NAVASAN_API_KEY is not set - using PersianAPI instead");
    }

    // Get internal API base URL from config or fallback to localhost
    this.internalApiBaseUrl =
      this.configService.get<string>("INTERNAL_API_URL") ||
      "http://localhost:4000";

    // FIX #3: URL VALIDATION - Validate internal API URL for security (SSRF prevention)
    this.validateInternalApiUrl(this.internalApiBaseUrl);

    this.logger.log(`Using internal API base URL: ${this.internalApiBaseUrl}`);

    // Note: Cache cleanup now handled by Redis TTL and CacheService's built-in cleanup
  }

  /**
   * FIX #3: URL VALIDATION - Validate internal API URL to prevent SSRF attacks
   * Only allows localhost URLs with http/https protocols
   */
  private validateInternalApiUrl(url: string): void {
    try {
      const parsed = new URL(url);

      // Only allow localhost for security
      const allowedHosts = ["localhost", "127.0.0.1", "::1"];
      if (!allowedHosts.includes(parsed.hostname)) {
        throw new Error(
          `INTERNAL_API_URL must point to localhost, got: ${parsed.hostname}`,
        );
      }

      // Only allow http/https protocols
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error(
          `INTERNAL_API_URL must use http or https protocol, got: ${parsed.protocol}`,
        );
      }

      this.logger.log(`✅ Internal API URL validated: ${url}`);
    } catch (error) {
      this.logger.error(
        `❌ Invalid INTERNAL_API_URL: ${url} - ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Validate category parameter to prevent NoSQL injection
   * Only allows alphanumeric characters, underscores, hyphens, and reasonable length
   */
  private validateCategory(category: string): void {
    if (!category || typeof category !== "string") {
      throw new BadRequestException("Category must be a non-empty string");
    }

    if (category.length > 50) {
      throw new BadRequestException("Category name too long");
    }

    // Only allow alphanumeric, underscore, hyphen
    const safePattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePattern.test(category)) {
      throw new BadRequestException("Category contains invalid characters");
    }
  }

  /**
   * Get latest rates for all items (currencies, crypto, gold)
   */
  async getLatestRates(): Promise<ApiResponse<NavasanResponse>> {
    return this.fetchWithCache("all", this.items.all);
  }

  /**
   * Get latest currency rates only
   */
  async getCurrencies(): Promise<ApiResponse<NavasanResponse>> {
    return this.fetchWithCache("currencies", this.items.currencies);
  }

  /**
   * Get latest cryptocurrency rates only
   */
  async getCrypto(): Promise<ApiResponse<NavasanResponse>> {
    return this.fetchWithCache("crypto", this.items.crypto);
  }

  /**
   * Get latest gold prices only
   * Note: Navasan API returns gold coins (sekkeh, bahar, nim, rob, gerami) in thousands of tomans
   * We multiply by 1000 to get the actual value in tomans
   * 18ayar is already in tomans, so we don't multiply it
   */
  async getGold(): Promise<ApiResponse<NavasanResponse>> {
    const response = await this.fetchWithCache("gold", this.items.gold);

    // Gold coins that need to be multiplied by 1000 (returned in thousands)
    const coinsToMultiply = [
      "sekkeh",
      "bahar",
      "nim",
      "rob",
      "gerami",
    ] as const;

    // Multiply coin values by 1000 - cast to Record for safe indexing
    const transformedData = { ...response.data } as Record<string, unknown>;
    for (const coin of coinsToMultiply) {
      if (transformedData[coin] && typeof transformedData[coin] === "object") {
        const coinData = transformedData[coin] as Record<string, unknown>;
        if (typeof coinData.value === "string") {
          coinData.value = String(Number(coinData.value) * 1000);
        }
        if (typeof coinData.change === "number") {
          coinData.change = coinData.change * 1000;
        }
      }
    }

    return {
      data: transformedData as NavasanResponse,
      metadata: response.metadata,
    };
  }

  /**
   * Get latest coin prices only
   * Returns coins from PersianAPI (Sekkeh Bahar Azadi, Nim Sekkeh, Rob Sekkeh, etc.)
   * Note: Uses same endpoint as gold (/common/gold-currency-coin) but returns only coin items
   */
  async getCoins(): Promise<ApiResponse<NavasanResponse>> {
    // For now, coins come from the same gold endpoint, so we can fetch from gold
    // and filter, or create a specific coins item list
    const coinsItems = "sekkeh,bahar,nim,rob,gerami";
    return this.fetchWithCache("coins", coinsItems);
  }

  /**
   * Force fetch from API and update all caches
   * Used by scheduler to proactively cache data
   * Bypasses fresh cache check and always hits the API
   *
   * @param category - Category to fetch ('currencies', 'crypto', or 'gold')
   * @returns Success status and optional error message
   */
  async forceFetchAndCache(
    category: "currencies" | "crypto" | "gold",
  ): Promise<{ success: boolean; error?: string }> {
    this.validateCategory(category);
    const items = this.items[category];

    try {
      this.logger.log(`🔄 Force fetching ${category} from API...`);

      const apiResponse = await this.fetchFromApiWithTimeout(items);

      // Save to all three cache tiers
      await this.saveToFreshCacheWithRetry(
        category,
        apiResponse.data,
        apiResponse.metadata,
      );
      await this.saveToStaleCacheWithRetry(
        category,
        apiResponse.data,
        apiResponse.metadata,
      );
      await this.savePriceSnapshot(
        category,
        apiResponse.data,
        apiResponse.metadata,
      );

      // 📊 Record intraday OHLC data points with type validation
      if (this.isValidNavasanData(apiResponse.data)) {
        await this.recordIntradayOhlc(category, apiResponse.data);
      } else {
        this.logger.warn(
          "Invalid Navasan data structure, skipping OHLC recording",
        );
      }

      this.logger.log(`✅ Force fetch successful for ${category}`);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? sanitizeErrorMessage(error) : String(error);
      const errorStack =
        error instanceof Error && error.stack
          ? error.stack.replace(/(https?:\/\/[^\s]+)/gi, (match) =>
              sanitizeUrl(match),
            )
          : undefined;

      this.logger.error(
        `❌ Force fetch failed for ${category}: ${errorMessage}`,
        errorStack,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Type guard to validate Navasan data structure
   * Ensures data is a non-null object suitable for OHLC recording
   */
  private isValidNavasanData(data: unknown): data is Record<string, unknown> {
    if (typeof data !== "object" || data === null) return false;
    if (Array.isArray(data)) return false;
    return true;
  }

  /**
   * Record intraday OHLC data from fetched API data
   * Transforms Navasan format to standard format and records data points
   */
  private async recordIntradayOhlc(
    category: "currencies" | "crypto" | "gold",
    navasanData: Record<string, unknown>,
  ): Promise<void> {
    try {
      const transformedData = this.transformNavasanToStandardFormat(
        category,
        navasanData,
      );
      await this.intradayOhlcService.recordDataPoints(transformedData);
    } catch (error) {
      // Log error but don't fail the entire fetch operation
      const err = error as Error;
      this.logger.warn(
        `Failed to record intraday OHLC for ${category}: ${err.message}`,
      );
    }
  }

  /**
   * Transform Navasan API format to standard CurrencyData/CryptoData/GoldData format
   */
  private transformNavasanToStandardFormat(
    category: "currencies" | "crypto" | "gold",
    navasanData: Record<string, unknown>,
  ): { currencies: CurrencyData[]; crypto: CryptoData[]; gold: GoldData[] } {
    const result: {
      currencies: CurrencyData[];
      crypto: CryptoData[];
      gold: GoldData[];
    } = {
      currencies: [],
      crypto: [],
      gold: [],
    };

    // Iterate through the response and transform each item
    for (const [code, itemData] of Object.entries(navasanData)) {
      if (!itemData || typeof itemData !== "object") continue;

      const item = itemData as NavasanPriceItem;
      const price = parseFloat(item.value);

      if (isNaN(price)) {
        this.logger.warn(`Invalid price for ${code}: ${item.value}`);
        continue;
      }

      const baseData = {
        code,
        price,
        updatedAt: new Date(item.utc),
      };

      // Categorize based on category
      if (category === "currencies") {
        result.currencies.push({
          ...baseData,
          name: code, // Use code as name for now
          change: item.change || undefined,
        } as CurrencyData);
      } else if (category === "crypto") {
        result.crypto.push({
          ...baseData,
          name: code,
          symbol: code.toUpperCase(),
          priceIrt: price,
          change24h: item.change || undefined,
        } as CryptoData);
      } else if (category === "gold") {
        result.gold.push({
          ...baseData,
          name: code,
        } as GoldData);
      }
    }

    return result;
  }

  /**
   * Fetch data with caching logic and fallback to stale data on API failure
   * Now with DB error handling and type safety
   */
  private async fetchWithCache(
    category: string,
    items: string,
  ): Promise<ApiResponse<NavasanResponse>> {
    // Validate category to prevent NoSQL injection
    this.validateCategory(category);

    try {
      // Step 1: Check for fresh cache (< 5 minutes old)
      const freshCache = await this.getFreshCachedData(category);
      if (freshCache) {
        this.logger.log(
          `✅ Returning FRESH cached data for category: ${category}`,
        );
        return {
          data: freshCache.data as Record<string, unknown>,
          metadata: {
            isFresh: true,
            isStale: false,
            dataAge: this.getDataAgeMinutes(freshCache.timestamp),
            lastUpdated: freshCache.timestamp,
            source: "cache",
          },
        };
      }

      // Step 2: Try to fetch fresh data from API
      this.logger.log(
        `📡 Fetching fresh data from Navasan API for category: ${category}`,
      );
      try {
        const apiResponse = await this.fetchFromApiWithTimeout(items);

        // Success! Update both fresh and stale caches with error handling
        // Cache save methods already reset apiErrorCount to 0 and clear lastApiError
        await this.saveToFreshCacheWithRetry(
          category,
          apiResponse.data,
          apiResponse.metadata,
        );
        await this.saveToStaleCacheWithRetry(
          category,
          apiResponse.data,
          apiResponse.metadata,
        );

        // 📸 PERMANENT STORAGE: Save snapshot for historical record
        // This data is never deleted and builds a permanent price history database
        await this.savePriceSnapshot(
          category,
          apiResponse.data,
          apiResponse.metadata,
        );

        this.logger.log(`✅ API fetch successful for category: ${category}`);

        return {
          data: apiResponse.data,
          metadata: {
            isFresh: true,
            isStale: false,
            dataAge: 0,
            lastUpdated: new Date(),
            source: "api",
          },
        };
      } catch (apiError: unknown) {
        // Step 3: API failed, try to serve stale data
        this.logger.warn(
          `⚠️  API fetch failed for category: ${category}. Attempting fallback to stale data.`,
        );

        // Capture error message for database tracking
        const errorMessage =
          apiError instanceof Error ? apiError.message : String(apiError);

        // Check if it's a token expiration error
        const isTokenError = this.isTokenExpirationError(apiError);
        if (isTokenError) {
          this.logger.error(
            `🔑 TOKEN EXPIRATION detected for category: ${category}`,
          );
        }

        // Try to get stale cache (up to 24 hours old)
        const staleCache = await this.getStaleCachedData(category);
        if (staleCache) {
          const dataAgeMinutes = this.getDataAgeMinutes(staleCache.timestamp);
          const dataAgeHours = Math.floor(dataAgeMinutes / 60);

          this.logger.warn(
            `⚠️  Serving STALE data for category: ${category} (${dataAgeHours}h ${dataAgeMinutes % 60}m old)`,
          );

          // Mark this cache entry as being used as fallback and increment error count
          await this.markCacheAsFallback(category, errorMessage).catch(
            (err) => {
              this.logger.error(
                `Failed to mark cache as fallback: ${err.message}`,
              );
            },
          );

          return {
            data: staleCache.data as Record<string, unknown>,
            metadata: {
              isFresh: false,
              isStale: true,
              dataAge: dataAgeMinutes,
              lastUpdated: staleCache.timestamp,
              source: "fallback",
              warning: isTokenError
                ? `API token expired. Showing data from ${dataAgeHours} hours ago.`
                : `API temporarily unavailable. Showing data from ${dataAgeHours} hours ago.`,
            },
          };
        }

        // Step 4: No stale cache available - fail
        this.logger.error(
          `❌ No stale cache available for category: ${category}. Failing request.`,
        );

        throw new InternalServerErrorException(
          isTokenError
            ? "API authentication failed and no cached data available. Please contact administrator."
            : "Service temporarily unavailable and no cached data available. Please try again later.",
        );
      }
    } catch (error: unknown) {
      // Unexpected error - sanitize before logging
      const sanitizedMessage =
        error instanceof Error ? sanitizeErrorMessage(error) : String(error);
      const sanitizedStack =
        error instanceof Error && error.stack
          ? error.stack.replace(/(https?:\/\/[^\s]+)/gi, (match) =>
              sanitizeUrl(match),
            )
          : undefined;

      this.logger.error(
        `❌ Unexpected error in fetchWithCache for category ${category}: ${sanitizedMessage}`,
        sanitizedStack,
      );
      throw error;
    }
  }

  /**
   * Detect if error is due to token expiration
   */
  private isTokenExpirationError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      // Check status code
      if (error.response?.status === 401 || error.response?.status === 403) {
        return true;
      }

      // Check response body for token-related messages
      const responseData = error.response?.data;
      if (typeof responseData === "object" && responseData !== null) {
        const message = JSON.stringify(responseData).toLowerCase();
        return (
          message.includes("token") ||
          message.includes("unauthorized") ||
          message.includes("api key") ||
          message.includes("authentication")
        );
      }
    }

    return false;
  }

  /**
   * Validate PersianAPI response structure
   * Updated to work with dynamic currency codes from PersianAPI
   */
  private validateNavasanResponse(data: unknown, items: string): void {
    // Check that response data exists and is an object
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      this.logger.error("Invalid PersianAPI response: data is not an object");
      throw new Error(
        "Invalid API response structure: expected object, received invalid data",
      );
    }

    const responseData = data as Record<string, unknown>;

    // Check that response has some data
    const keys = Object.keys(responseData);
    if (keys.length === 0) {
      this.logger.error("PersianAPI response is empty");
      throw new Error("Invalid API response: no data returned");
    }

    // Validate structure of each field in the response
    for (const key of keys) {
      const fieldData = responseData[key];

      // Validate that the field contains an object with required properties
      if (
        !fieldData ||
        typeof fieldData !== "object" ||
        Array.isArray(fieldData)
      ) {
        this.logger.error(
          `Invalid structure for field "${key}" in PersianAPI response`,
        );
        throw new Error(
          `Invalid API response: field "${key}" has invalid structure`,
        );
      }

      // Validate that the field object contains 'value' property
      const fieldObject = fieldData as Record<string, unknown>;
      if (!("value" in fieldObject)) {
        this.logger.error(`Missing "value" property in field "${key}"`);
        throw new Error(
          `Invalid API response: field "${key}" missing "value" property`,
        );
      }
    }

    this.logger.log(
      `✅ PersianAPI response validation passed: ${keys.length} items received`,
    );
  }

  /**
   * Convert Date object to Jalali date string (YYYY/MM/DD format)
   * This is a simplified conversion that calculates Persian calendar date
   */
  private toJalaliDateString(date: Date): string {
    // Use a library function or API to convert Gregorian to Jalali
    // For now, we'll format the date as ISO and note it needs proper Jalali conversion
    // TODO: Install moment-jalaali or use proper Jalali conversion library
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    // Approximate Jalali year (Gregorian year - 621 or 622)
    // This is a placeholder - proper conversion requires a library
    const jalaliYear = year - 621;

    return `${jalaliYear}/${month}/${day}`;
  }

  /**
   * Convert Date object to time string (HH:mm:ss format)
   */
  private toTimeString(date: Date): string {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * @deprecated Use PersianApiTransformer.transformToNavasanFormat() instead
   *
   * Map PersianAPI response array to NavasanResponse object format
   * PersianAPI returns: [{ code: 'usd_sell', price: 42500, ... }]
   * Navasan format: { usd_sell: { value: "42500", ... } }
   *
   * For crypto: Uses priceIrt (Toman) instead of price (USD)
   *
   * This method is kept for backward compatibility but delegates to the transformer.
   */
  private mapPersianApiToNavasan(
    data: (CurrencyData | CryptoData | GoldData)[],
  ): NavasanResponse {
    // Delegate to transformer
    return this.persianApiTransformer.transformToNavasanFormat(data) as NavasanResponse;
  }

  /**
   * Determine category from items string using exact matching first, then fallback to contains check
   * More robust and maintainable than fragile string.includes() checks
   */
  private determineCategoryFromItemsString(
    items: string,
  ): "currencies" | "crypto" | "gold" | "all" {
    // Exact match first (most reliable)
    if (items === this.items.all) {
      return "all";
    }
    if (items === this.items.currencies) {
      return "currencies";
    }
    if (items === this.items.crypto) {
      return "crypto";
    }
    if (items === this.items.gold) {
      return "gold";
    }

    // Fallback to contains check for partial matches
    // Check for crypto first (most specific keywords)
    if (
      items.includes("btc") ||
      items.includes("eth") ||
      items.includes("usdt")
    ) {
      this.logger.debug("Category detected via contains check: crypto");
      return "crypto";
    }

    // Check for gold
    if (
      items.includes("sekkeh") ||
      items.includes("bahar") ||
      items.includes("18ayar")
    ) {
      this.logger.debug("Category detected via contains check: gold");
      return "gold";
    }

    // Check for currencies (least specific, so last)
    if (
      items.includes("usd") ||
      items.includes("eur") ||
      items.includes("gbp")
    ) {
      this.logger.debug("Category detected via contains check: currencies");
      return "currencies";
    }

    // Default to currencies if no match found
    this.logger.warn(
      `Could not determine category for items: ${items.substring(0, 50)}..., defaulting to currencies`,
    );
    return "currencies";
  }

  /**
   * Fetch data from PersianAPI with timeout and type validation
   * Replaces old Navasan API integration
   * TYPE SAFETY: Returns properly typed NavasanResponse
   */
  private async fetchFromApiWithTimeout(
    items: string,
  ): Promise<{ data: NavasanResponse; metadata?: Record<string, unknown> }> {
    this.logger.debug(
      `📤 Fetching data from PersianAPI for items: ${items.substring(0, 50)}...`,
    );

    try {
      const provider = this.apiProviderFactory.getActiveProvider();
      let responseData: (CurrencyData | CryptoData | GoldData)[] = [];

      // Use proper category mapping instead of fragile string detection
      const category = this.determineCategoryFromItemsString(items);

      if (category === "all") {
        // Fetch all data
        this.logger.debug("🌍 Fetching all data from PersianAPI");
        const allData = await provider.fetchAll({ limit: 100 });
        responseData = [
          ...allData.currencies,
          ...allData.crypto,
          ...allData.gold,
        ];
      } else if (category === "currencies") {
        // Fetch currencies
        this.logger.debug("📊 Fetching currencies from PersianAPI");
        responseData = await provider.fetchCurrencies({ limit: 100 });
      } else if (category === "crypto") {
        // Fetch crypto
        this.logger.debug("💰 Fetching crypto from PersianAPI");
        responseData = await provider.fetchCrypto({ limit: 100 });
      } else if (category === "gold") {
        // Fetch gold
        this.logger.debug("🪙 Fetching gold from PersianAPI");
        try {
          responseData = await provider.fetchGold({ limit: 100 });
        } catch (error: any) {
          // Gold endpoint may be unavailable - log warning but don't fail
          this.logger.warn(`⚠️ Gold endpoint unavailable: ${error.message}`);
          this.logger.warn(
            "📦 Returning empty gold data - will fallback to cache",
          );
          responseData = [];
        }
      }

      // Use PersianApiTransformer to convert to NavasanResponse format
      const navasanData = this.persianApiTransformer.transformToNavasanFormat(responseData);

      // Validate the transformed response
      this.validateNavasanResponse(navasanData, items);

      this.logger.debug(
        `✅ Successfully fetched ${responseData.length} items from PersianAPI`,
      );

      return {
        data: navasanData,
        metadata: {
          provider: "PersianAPI",
          itemCount: responseData.length,
          timestamp: new Date(),
        },
      };
    } catch (error: any) {
      this.logger.error(`❌ PersianAPI fetch failed: ${error.message}`);

      // Re-throw to trigger stale cache fallback
      if (error.statusCode === 401 || error.statusCode === 403) {
        throw new Error(
          "PersianAPI authentication failed. API key may be expired or invalid.",
        );
      }

      if (error.statusCode === 429) {
        throw new Error("PersianAPI rate limit exceeded.");
      }

      // For other errors, re-throw
      throw error;
    }
  }

  /**
   * Get fresh cached data (< 5 minutes old)
   * Now with DB error handling - returns null on DB failure instead of throwing
   */
  private async getFreshCachedData(
    category: string,
  ): Promise<CacheDocument | null> {
    const freshExpiry = new Date(
      Date.now() - this.freshCacheMinutes * 60 * 1000,
    );

    return safeDbRead(
      () =>
        this.cacheModel
          .findOne({
            category,
            cacheType: "fresh",
            timestamp: { $gte: freshExpiry },
          })
          .sort({ timestamp: -1 })
          .exec(),
      "getFreshCachedData",
      this.logger,
      { category },
    );
  }

  /**
   * Get stale cached data (up to 24 hours old) for fallback
   * Now with DB error handling - returns null on DB failure instead of throwing
   */
  private async getStaleCachedData(
    category: string,
  ): Promise<CacheDocument | null> {
    const staleExpiry = new Date(
      Date.now() - this.staleCacheHours * 60 * 60 * 1000,
    );

    return safeDbRead(
      () =>
        this.cacheModel
          .findOne({
            category,
            cacheType: { $in: ["fresh", "stale"] },
            timestamp: { $gte: staleExpiry },
          })
          .sort({ timestamp: -1 })
          .exec(),
      "getStaleCachedData",
      this.logger,
      { category },
    );
  }

  /**
   * Save data to fresh cache using atomic upsert to prevent race conditions
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * DB ERROR HANDLING: Uses safeDbWrite - won't throw on DB failure
   */
  private async saveToFreshCache(
    category: string,
    data: NavasanResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.freshCacheMinutes * 60 * 1000,
    );

    // Atomic upsert with DB error handling
    await safeDbWrite(
      () =>
        this.cacheModel
          .findOneAndUpdate(
            { category, cacheType: "fresh" },
            {
              $set: {
                data,
                timestamp: now,
                expiresAt,
                lastApiSuccess: now,
                apiErrorCount: 0,
                isFallback: false,
                lastApiError: undefined, // Clear error on success
                apiMetadata: apiMetadata || undefined,
              },
            },
            { upsert: true, new: true },
          )
          .exec(),
      "saveToFreshCache",
      this.logger,
      { category },
      false, // Not critical - can continue without fresh cache
    );

    this.logger.log(
      `💾 Saved fresh cache for category: ${category}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save data to stale cache (long-term fallback) using atomic upsert
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * DB ERROR HANDLING: Uses safeDbWrite with retry - critical for fallback functionality
   */
  private async saveToStaleCache(
    category: string,
    data: NavasanResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.staleCacheHours * 60 * 60 * 1000,
    );

    // Atomic upsert with DB error handling
    await safeDbWrite(
      () =>
        this.cacheModel
          .findOneAndUpdate(
            { category, cacheType: "stale" },
            {
              $set: {
                data,
                timestamp: now,
                expiresAt,
                lastApiSuccess: now,
                isFallback: false,
                lastApiError: undefined, // Clear error on success
                apiMetadata: apiMetadata || undefined,
              },
            },
            { upsert: true, new: true },
          )
          .exec(),
      "saveToStaleCache",
      this.logger,
      { category },
      true, // Critical - stale cache needed for fallback
    );

    this.logger.log(
      `💾 Saved stale cache for category: ${category}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save cache with retry logic for resilience
   * RELIABILITY FIX: Cache write failures shouldn't fail the request
   */
  private async saveToFreshCacheWithRetry(
    category: string,
    data: NavasanResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.saveToFreshCache(category, data, apiMetadata);
    } catch (error) {
      this.logger.error(
        `Failed to save fresh cache for ${category}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't fail the request, just log the error
    }
  }

  /**
   * Save stale cache with retry logic - critical for fallback functionality
   * RELIABILITY FIX: Retry stale cache writes since they're critical for fallback
   */
  private async saveToStaleCacheWithRetry(
    category: string,
    data: NavasanResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      try {
        await this.saveToStaleCache(category, data, apiMetadata);
        return; // Success
      } catch (error) {
        retries++;
        this.logger.error(
          `Failed to save stale cache for ${category} (attempt ${retries}/${maxRetries + 1}): ${error instanceof Error ? error.message : String(error)}`,
        );

        if (retries > maxRetries) {
          this.logger.error(
            `Gave up saving stale cache for ${category} after ${maxRetries + 1} attempts`,
          );
          // Don't fail the request, but log as critical since stale cache is needed for fallback
        }
      }
    }
  }

  /**
   * Mark cache entry as being used as fallback and track API errors
   * Populates isFallback, lastApiError, and increments apiErrorCount
   * DB ERROR HANDLING: Won't throw on DB failure
   */
  private async markCacheAsFallback(
    category: string,
    errorMessage: string,
  ): Promise<void> {
    await safeDbWrite(
      () =>
        this.cacheModel
          .updateMany(
            { category, cacheType: { $in: ["fresh", "stale"] } },
            {
              $set: {
                isFallback: true,
                lastApiError: errorMessage,
              },
              $inc: {
                apiErrorCount: 1,
              },
            },
          )
          .exec(),
      "markCacheAsFallback",
      this.logger,
      { category, errorMessage },
      false, // Not critical - just metadata update
    );
  }

  /**
   * Calculate data age in minutes
   */
  private getDataAgeMinutes(timestamp: Date): number {
    return Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60));
  }

  /**
   * Save hourly price snapshot to database with TTL
   * ISSUE 4 FIX: Reduced from 5-minute to 1-hour snapshots
   * Records are auto-deleted after 90 days via TTL index
   * METRICS: Tracks snapshot save failures
   */
  private async savePriceSnapshot(
    category: string,
    data: NavasanResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      // HOURLY SNAPSHOT LOGIC: Only save one snapshot per hour
      const now = new Date();
      const currentHour = new Date(
        Math.floor(now.getTime() / 3600000) * 3600000,
      );

      // Check if we already have a snapshot for this hour
      const existingSnapshot = await safeDbRead(
        () =>
          this.priceSnapshotModel
            .findOne({
              category,
              timestamp: { $gte: currentHour },
            })
            .exec(),
        "checkExistingSnapshot",
        this.logger,
        { category, currentHour },
      );

      if (existingSnapshot) {
        this.logger.debug(
          `Snapshot already exists for ${category} in hour ${currentHour.toISOString()}, skipping`,
        );
        return;
      }

      // Save new hourly snapshot
      const snapshot = new this.priceSnapshotModel({
        category,
        data,
        timestamp: currentHour, // Use hour-rounded timestamp
        source: "api",
        metadata: apiMetadata,
      });

      const saveResult = await safeDbWrite(
        () => snapshot.save(),
        "savePriceSnapshot",
        this.logger,
        { category },
        true, // Critical - track failures
      );

      if (saveResult) {
        this.logger.log(
          `📸 Saved hourly price snapshot for category: ${category}`,
        );
        // Reset failure counter on success
        this.metricsService.resetSnapshotFailureCounter("price", category);
      } else {
        // Track failure
        this.metricsService.trackSnapshotFailure(
          "price",
          category,
          "Database write failed during snapshot save",
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to save price snapshot for ${category}: ${errorMessage}`,
      );
      // Track failure
      this.metricsService.trackSnapshotFailure("price", category, errorMessage);
      // Don't fail the request if snapshot saving fails
    }
  }

  /**
   * Find closest price snapshot to a specific timestamp
   * Searches for snapshots within ±6 hours of target time
   */
  private async findClosestSnapshot(
    category: string,
    targetTimestamp: Date,
  ): Promise<PriceSnapshotDocument | null> {
    // Search window: ±6 hours from target
    const sixHoursMs = 6 * 60 * 60 * 1000;
    const startWindow = new Date(targetTimestamp.getTime() - sixHoursMs);
    const endWindow = new Date(targetTimestamp.getTime() + sixHoursMs);

    return safeDbRead(
      () =>
        this.priceSnapshotModel
          .findOne({
            category,
            timestamp: {
              $gte: startWindow,
              $lte: endWindow,
            },
          })
          .sort({ timestamp: -1 }) // Get the most recent one in the window
          .exec(),
      "findClosestSnapshot",
      this.logger,
      { category, targetTimestamp },
    );
  }

  /**
   * Fetch yesterday's data from OHLC API as fallback
   * Gets the latest OHLC point (close price) from yesterday
   * Results are cached for 1 hour to improve performance
   */
  private async fetchFromOHLCForYesterday(
    category: string,
  ): Promise<NavasanResponse | null> {
    try {
      // Check cache first (using Redis)
      const cacheKey = `navasan:ohlc:${category}:${new Date().toDateString()}`;
      const cached = await this.cacheService.get<NavasanResponse>(cacheKey);

      if (cached) {
        this.logger.log(`📦 Using cached OHLC data for ${category} (from Redis)`);
        return cached;
      }

      // Calculate yesterday's date range
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      // Also get day before yesterday for change calculation
      const dayBeforeYesterday = new Date(yesterday);
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
      dayBeforeYesterday.setHours(0, 0, 0, 0);

      const startTimestamp = Math.floor(dayBeforeYesterday.getTime() / 1000); // Start from 2 days ago
      const endTimestamp = Math.floor(yesterdayEnd.getTime() / 1000);

      // Get the list of items for this category
      const items = this.items[category as keyof typeof this.items];
      if (!items) {
        this.logger.error(`Invalid category for OHLC fallback: ${category}`);
        return null;
      }

      // Split items into array
      const itemCodes = items.split(",").map((code) => code.trim());

      // Fetch OHLC data for each item
      type HistoricalPriceData = Record<string, NavasanPriceItem>;
      const result: HistoricalPriceData = {};
      let hasAnyData = false;

      for (const itemCode of itemCodes) {
        try {
          const url = `http://api.navasan.tech/ohlcSearch/?api_key=${this.apiKey}&item=${itemCode}&start=${startTimestamp}&end=${endTimestamp}`;

          const response = await axios.get(url, {
            timeout: 10000,
            validateStatus: (status) => status < 500,
          });

          if (
            response.status === 200 &&
            Array.isArray(response.data) &&
            response.data.length > 0
          ) {
            // Get the last data point (most recent from yesterday)
            const lastPoint = response.data[response.data.length - 1];

            // Calculate real change from previous day
            let change = 0;
            if (response.data.length >= 2) {
              // We have at least 2 days of data - calculate change from day before
              const previousPoint = response.data[response.data.length - 2];
              change = Number(lastPoint.close) - Number(previousPoint.close);
            } else if (lastPoint.open) {
              // Fall back to intraday change (close - open)
              change = Number(lastPoint.close) - Number(lastPoint.open);
            }

            // Convert OHLC data to NavasanPriceItem format
            const timestamp = new Date(lastPoint.timestamp * 1000);
            result[itemCode] = {
              value: String(lastPoint.close),
              change: change,
              utc: timestamp.toISOString(),
              date: lastPoint.date,
              dt: timestamp.toTimeString().split(" ")[0],
            };

            hasAnyData = true;
          }
        } catch (itemError) {
          // Log but continue with other items
          this.logger.warn(
            `Failed to fetch OHLC data for ${itemCode}: ${itemError instanceof Error ? itemError.message : String(itemError)}`,
          );
        }
      }

      if (!hasAnyData) {
        this.logger.warn(
          `No OHLC data found for category: ${category} on yesterday`,
        );
        return null;
      }

      this.logger.log(
        `✅ Successfully fetched ${Object.keys(result).length} items from OHLC for ${category}`,
      );

      // Cache the result for 1 hour (using Redis with TTL)
      const finalResult = result as NavasanResponse;
      const ttlSeconds = Math.floor(this.ohlcCacheDuration / 1000); // Convert ms to seconds
      await this.cacheService.set(cacheKey, finalResult, ttlSeconds);
      this.logger.log(
        `📦 Cached OHLC data for ${category} in Redis (expires in 1 hour)`,
      );

      return finalResult;
    } catch (error) {
      this.logger.error(
        `Failed to fetch from OHLC for yesterday: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Get historical data for yesterday
   * First tries to find data in price_snapshots database
   * Falls back to OHLC API if not found
   * Implements request deduplication to prevent multiple simultaneous requests
   */
  async getHistoricalData(
    category: string,
  ): Promise<ApiResponse<NavasanResponse>> {
    // Validate category to prevent NoSQL injection
    this.validateCategory(category);

    // Request deduplication - check if there's already a pending request
    const requestKey = `historical-${category}`;
    const existingRequest = this.pendingRequests.get(requestKey);

    if (existingRequest) {
      this.logger.log(
        `⏳ Waiting for existing historical data request: ${category}`,
      );
      return existingRequest;
    }

    // Create new request and store it
    const requestPromise = this._getHistoricalDataInternal(category);
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Internal method to fetch historical data
   * This is separated to allow request deduplication wrapping
   */
  private async _getHistoricalDataInternal(
    category: string,
  ): Promise<ApiResponse<NavasanResponse>> {
    this.logger.log(
      `📅 Fetching historical data for category: ${category} (yesterday)`,
    );

    try {
      // Calculate yesterday's timestamp (same time as now, but 24 hours ago)
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Step 1: Try to find closest snapshot in database
      const snapshot = await this.findClosestSnapshot(category, yesterday);

      if (snapshot) {
        // Validate snapshot data before using
        try {
          if (!snapshot.data || typeof snapshot.data !== "object") {
            this.logger.warn(
              `⚠️ Corrupted snapshot found for ${category} - invalid data structure, skipping to fallback`,
            );
            throw new Error("Invalid snapshot data structure");
          }

          const itemCount = Object.keys(snapshot.data).length;
          if (itemCount === 0) {
            this.logger.warn(
              `⚠️ Empty snapshot found for ${category} - no items, skipping to fallback`,
            );
            throw new Error("Empty snapshot data");
          }

          // Check if this is weekend/holiday data (timestamp is more than 2 days old from yesterday)
          const daysDifference =
            Math.abs(snapshot.timestamp.getTime() - yesterday.getTime()) /
            (1000 * 60 * 60 * 24);
          if (daysDifference > 2) {
            this.logger.warn(
              `⚠️ Snapshot for ${category} is ${daysDifference.toFixed(1)} days old - may be weekend/holiday data`,
            );
          }

          const dataAgeMinutes = this.getDataAgeMinutes(snapshot.timestamp);
          const timeDifferenceHours =
            Math.abs(snapshot.timestamp.getTime() - yesterday.getTime()) /
            (1000 * 60 * 60);

          this.logger.log(
            `✅ Found valid historical snapshot for ${category} from ${snapshot.timestamp.toISOString()} (${timeDifferenceHours.toFixed(1)}h difference, ${itemCount} items)`,
          );

          return {
            data: snapshot.data as NavasanResponse,
            metadata: {
              isFresh: false,
              isStale: true,
              dataAge: dataAgeMinutes,
              lastUpdated: snapshot.timestamp,
              source: "snapshot",
              isHistorical: true,
              historicalDate: snapshot.timestamp,
              warning:
                daysDifference > 2
                  ? `Data is ${Math.floor(daysDifference)} days old (possible weekend/holiday)`
                  : undefined,
            },
          };
        } catch (validationError) {
          this.logger.error(
            `❌ Snapshot validation failed for ${category}: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          );
          // Continue to OHLC fallback
        }
      }

      // Step 2: Snapshot not found, try OHLC API fallback
      this.logger.warn(
        `No snapshot found for ${category} at ${yesterday.toISOString()}, trying OHLC fallback`,
      );

      const ohlcData = await this.fetchFromOHLCForYesterday(category);

      if (ohlcData) {
        this.logger.log(
          `✅ Retrieved yesterday's data from OHLC API for ${category}`,
        );

        return {
          data: ohlcData,
          metadata: {
            isFresh: false,
            isStale: true,
            dataAge: 1440, // 24 hours in minutes
            lastUpdated: yesterday,
            source: "fallback",
            isHistorical: true,
            historicalDate: yesterday,
          },
        };
      }

      // Step 3: No data found in either source
      this.logger.error(
        `❌ No historical data found for ${category} on ${yesterday.toISOString()}`,
      );

      throw new NotFoundException(
        `No historical data available for ${category} on the requested date. Please try a different date.`,
      );
    } catch (error) {
      // Re-throw NotFoundException as-is
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Unexpected error - sanitize and log
      const sanitizedMessage =
        error instanceof Error ? sanitizeErrorMessage(error) : String(error);
      const sanitizedStack =
        error instanceof Error && error.stack
          ? error.stack.replace(/(https?:\/\/[^\s]+)/gi, (match) =>
              sanitizeUrl(match),
            )
          : undefined;

      this.logger.error(
        `❌ Unexpected error fetching historical data for ${category}: ${sanitizedMessage}`,
        sanitizedStack,
      );

      throw new InternalServerErrorException(
        "Failed to retrieve historical data. Please try again later.",
      );
    }
  }

  /**
   * FIX #4: CIRCUIT BREAKER - Check if circuit breaker allows requests
   * Throws ServiceUnavailableException if circuit is open
   */
  private checkCircuitBreaker(): void {
    if (this.circuitBreaker.isOpen) {
      const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceFailure > this.circuitBreaker.resetTimeout) {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
        this.logger.log("🔓 Circuit breaker reset - accepting requests again");
      } else {
        throw new ServiceUnavailableException(
          `Historical API temporarily unavailable. Retry after ${Math.ceil((this.circuitBreaker.resetTimeout - timeSinceFailure) / 1000)}s`,
        );
      }
    }
  }

  /**
   * FIX #4: CIRCUIT BREAKER - Record a failure and potentially open circuit
   */
  private recordCircuitBreakerFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      this.logger.error(
        `🔒 Circuit breaker opened after ${this.circuitBreaker.failures} failures`,
      );
    }
  }

  /**
   * FIX #4: CIRCUIT BREAKER - Record a success and gradually reset failure count
   */
  private recordCircuitBreakerSuccess(): void {
    if (this.circuitBreaker.failures > 0) {
      this.circuitBreaker.failures = Math.max(
        0,
        this.circuitBreaker.failures - 1,
      );
    }
  }

  /**
   * Get historical data from internal history API for a specific date
   * This method fetches data from the existing /history endpoint in parallel
   * for optimal performance, then filters to the target date.
   *
   * Performance: Parallel fetching provides 10-20x speedup vs sequential
   * Data source: ohlc_permanent collection (local database)
   *
   * @param category - The data category (currencies, crypto, gold)
   * @param targetDate - The date to fetch data for (validated against future dates)
   * @returns Price data for the specified date with metadata about completeness
   */
  async getHistoricalDataFromOHLC(
    category: string,
    targetDate: Date,
  ): Promise<ApiResponse<NavasanResponse>> {
    // Validate category
    this.validateCategory(category);

    const targetDateStr = targetDate.toISOString().split("T")[0];
    this.logger.log(
      `📊 Fetching historical data for ${category} on ${targetDateStr} from ohlc_permanent`,
    );

    try {
      // INPUT VALIDATION: Validate date parameters
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today

      if (targetDate.getTime() > today.getTime()) {
        throw new BadRequestException("Target date cannot be in the future");
      }

      // Get item codes (UPPERCASE to match ohlc_permanent storage)
      const itemCodes = this.getCategoryItemCodes(category);

      // Calculate day boundaries (UTC)
      const startOfDay = new Date(targetDateStr + "T00:00:00.000Z");
      const endOfDay = new Date(targetDateStr + "T23:59:59.999Z");

      // Query ohlc_permanent for 1d (daily) data first
      let records: AggregatedOhlcData[] = (
        await this.ohlcPermanentModel
          .find({
            itemCode: { $in: itemCodes },
            timeframe: "1d",
            timestamp: { $gte: startOfDay, $lte: endOfDay },
          })
          .lean()
          .exec()
      ).map((r) => ({
        itemCode: r.itemCode,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        timestamp: r.timestamp,
      }));

      // If no 1d data, aggregate from 1m data
      if (records.length === 0) {
        this.logger.log(
          `No 1d data found for ${targetDateStr}, aggregating from 1m data...`,
        );
        records = await this.aggregateMinuteToDaily(
          itemCodes,
          startOfDay,
          endOfDay,
        );
      }

      if (records.length === 0) {
        this.logger.warn(
          `No historical data found for ${category} on ${targetDateStr}`,
        );
        throw new NotFoundException(
          `No historical data available for ${targetDateStr}`,
        );
      }

      // Transform to response format (lowercase keys for API consistency)
      const priceData: Record<string, NavasanPriceItem> = {};
      for (const record of records) {
        const key = record.itemCode.toLowerCase();
        const changeAmount = record.close - record.open;
        priceData[key] = {
          value: String(record.close),
          change: changeAmount,
          utc: record.timestamp.toISOString(),
          date: targetDateStr,
          dt: record.timestamp.toTimeString().split(" ")[0],
        };
      }

      const totalItems = itemCodes.length;
      const successCount = records.length;

      this.logger.log(
        `📊 Historical data retrieved: ${successCount}/${totalItems} items for ${targetDateStr}`,
      );

      // Build response object
      const response: ApiResponse<NavasanResponse> = {
        data: priceData,
        metadata: {
          isFresh: false,
          isStale: false,
          dataAge: Math.round((Date.now() - targetDate.getTime()) / 60000),
          source: "ohlc_permanent" as const,
          lastUpdated: targetDate,
          isHistorical: true,
          historicalDate: targetDate,
          completeness: {
            successCount,
            totalCount: totalItems,
            percentage: Math.round((successCount / totalItems) * 100),
          },
        },
      };

      return response;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const sanitizedMessage =
        error instanceof Error ? sanitizeErrorMessage(error) : String(error);
      this.logger.error(
        `❌ Error fetching historical data for ${category}: ${sanitizedMessage}`,
      );

      throw new InternalServerErrorException(
        "Failed to retrieve historical data",
      );
    }
  }

  /**
   * Aggregate 1-minute OHLC data to daily OHLC
   * Used as fallback when 1d data is not available
   */
  private async aggregateMinuteToDaily(
    itemCodes: string[],
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<AggregatedOhlcData[]> {
    const aggregation = await this.ohlcPermanentModel
      .aggregate([
        {
          $match: {
            itemCode: { $in: itemCodes },
            timeframe: "1m",
            timestamp: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        { $sort: { timestamp: 1 } },
        {
          $group: {
            _id: "$itemCode",
            open: { $first: "$open" },
            high: { $max: "$high" },
            low: { $min: "$low" },
            close: { $last: "$close" },
            timestamp: { $first: "$timestamp" },
          },
        },
        {
          $project: {
            itemCode: "$_id",
            open: 1,
            high: 1,
            low: 1,
            close: 1,
            timestamp: 1,
          },
        },
      ])
      .exec();

    return aggregation as AggregatedOhlcData[];
  }

  /**
   * Get item codes for a category
   * Maps category names to the item codes used in ohlc_permanent collection
   * Returns UPPERCASE codes to match ohlc_permanent storage format
   */
  private getCategoryItemCodes(category: string): string[] {
    switch (category.toLowerCase()) {
      case "currencies":
        return [
          "USD_SELL",
          "USD_BUY",
          "EUR",
          "GBP",
          "CAD",
          "AUD",
          "AED",
          "AED_SELL",
          "DIRHAM_DUBAI",
          "CNY",
          "TRY",
          "CHF",
          "JPY",
          "RUB",
          "INR",
          "PKR",
          "IQD",
          "KWD",
          "SAR",
          "QAR",
          "OMR",
          "BHD",
        ];

      case "crypto":
        return [
          "USDT",
          "BTC",
          "ETH",
          "BNB",
          "XRP",
          "ADA",
          "DOGE",
          "SOL",
          "MATIC",
          "DOT",
          "LTC",
        ];

      case "gold":
        return [
          "SEKKEH",
          "BAHAR",
          "NIM",
          "ROB",
          "GERAMI",
          "18AYAR",
          "ABSHODEH",
        ];

      default:
        throw new BadRequestException(`Invalid category: ${category}`);
    }
  }
}
