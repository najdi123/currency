import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import axios from "axios";
import { TimeRange, ItemType } from "./dto/chart-query.dto";
import { ChartDataPoint, ChartResponse } from "./interfaces/chart.interface";
import { Cache, CacheDocument } from "../market-data/schemas/cache.schema";
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from "../market-data/schemas/price-snapshot.schema";
import {
  HistoricalOhlc,
  HistoricalOhlcDocument,
  OhlcTimeframe,
} from "../schemas/historical-ohlc.schema";
import {
  OHLCPermanent,
  OHLCPermanentDocument,
} from "../market-data/schemas/ohlc-permanent.schema";
import { safeDbRead, safeDbWrite } from "../common/utils/db-error-handler";
import { MetricsService } from "../metrics/metrics.service";
import { OhlcData, NavasanOHLCDataPoint } from "../market-data/types/market-data.types";
import { isOHLCDataArray } from "../market-data/utils/type-guards";

@Injectable()
export class ChartService {
  private readonly logger = new Logger(ChartService.name);
  private readonly apiKey: string;
  private readonly ohlcBaseUrl = "http://api.navasan.tech/ohlcSearch/";
  private readonly freshCacheMinutes = 60; // 1 hour cache for OHLC data
  private readonly staleCacheHours = 72; // Keep stale OHLC data for 3 days
  private readonly snapshotCoverageThreshold: number; // Minimum coverage % for price snapshot fallback

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    @InjectModel(PriceSnapshot.name)
    private priceSnapshotModel: Model<PriceSnapshotDocument>,
    @InjectModel(HistoricalOhlc.name)
    private historicalOhlcModel: Model<HistoricalOhlcDocument>,
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    this.apiKey = this.configService.get<string>("NAVASAN_API_KEY") || "";
    if (!this.apiKey) {
      this.logger.error("NAVASAN_API_KEY is not set in environment variables");
      throw new Error("NAVASAN_API_KEY is required for chart service");
    }

    // Read snapshot coverage threshold from env (default: 50%)
    this.snapshotCoverageThreshold = parseInt(
      this.configService.get<string>("SNAPSHOT_COVERAGE_THRESHOLD") || "50",
      10,
    );

    if (
      this.snapshotCoverageThreshold < 0 ||
      this.snapshotCoverageThreshold > 100
    ) {
      this.logger.warn(
        `Invalid SNAPSHOT_COVERAGE_THRESHOLD (${this.snapshotCoverageThreshold}), defaulting to 50%`,
      );
      this.snapshotCoverageThreshold = 50;
    }
  }

  /**
   * Validate cache key parameter to prevent NoSQL injection
   * Only allows alphanumeric characters, underscores, hyphens, and reasonable length
   */
  private validateCacheKey(cacheKey: string): void {
    if (!cacheKey || typeof cacheKey !== "string") {
      throw new Error("Cache key must be a non-empty string");
    }

    if (cacheKey.length > 100) {
      throw new Error("Cache key too long");
    }

    // Only allow alphanumeric, underscore, hyphen
    const safePattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePattern.test(cacheKey)) {
      throw new Error("Cache key contains invalid characters");
    }
  }

  /**
   * Map frontend item codes to Navasan API codes
   * Frontend sends uppercase codes, we map them to Navasan's lowercase format
   */
  private readonly itemCodeMap: Record<string, string> = {
    // Main Currencies
    USD_SELL: "usd_sell",
    USD: "usd_sell", // Fallback for backwards compatibility
    EUR: "eur",
    GBP: "gbp",
    CAD: "cad",
    AUD: "aud",
    AED: "aed",
    CNY: "cny",
    TRY: "try",

    // Additional Currencies
    CHF: "chf",
    JPY: "jpy",
    RUB: "rub",
    INR: "inr",
    PKR: "pkr",
    IQD: "iqd",
    KWD: "kwd",
    SAR: "sar",
    QAR: "qar",
    OMR: "omr",
    BHD: "bhd",

    // Currency Variants
    USD_BUY: "usd_buy",
    USD_HARAT_SELL: "dolar_harat_sell",
    USD_HARAT_CASH_SELL: "harat_naghdi_sell",
    USD_HARAT_CASH_BUY: "harat_naghdi_buy",
    USD_FARDA_SELL: "usd_farda_sell",
    USD_FARDA_BUY: "usd_farda_buy",
    USD_SHAKHS: "usd_shakhs",
    USD_SHERKAT: "usd_sherkat",
    USD_PP: "usd_pp",
    USD_MASHAD_SELL: "dolar_mashad_sell",
    USD_KORDESTAN_SELL: "dolar_kordestan_sell",
    USD_SOLEIMANIE_SELL: "dolar_soleimanie_sell",
    AED_SELL: "aed_sell",
    DIRHAM_DUBAI: "dirham_dubai",
    EUR_HAV: "eur_hav",
    GBP_HAV: "gbp_hav",
    GBP_WHT: "gbp_wht",
    CAD_HAV: "cad_hav",
    CAD_CASH: "cad_cash",
    AUD_HAV: "aud_hav",
    AUD_WHT: "aud_wht",

    // Main Cryptocurrencies
    USDT: "usdt",
    BTC: "btc",
    ETH: "eth",

    // Additional Cryptocurrencies
    BNB: "bnb",
    XRP: "xrp",
    ADA: "ada",
    DOGE: "doge",
    SOL: "sol",
    MATIC: "matic",
    DOT: "dot",
    LTC: "ltc",

    // Gold items
    SEKKEH: "sekkeh",
    BAHAR: "bahar",
    NIM: "nim",
    ROB: "rob",
    GERAMI: "gerami",
    "18AYAR": "18ayar",
    ABSHODEH: "abshodeh",
  };

  /**
   * Gold price multipliers - Most gold items stored as thousands in Navasan API
   * Items not in this map default to multiplier of 1
   */
  private readonly goldPriceMultipliers: Record<string, number> = {
    sekkeh: 1000,
    bahar: 1000,
    nim: 1000,
    rob: 1000,
    gerami: 1000,
    "18ayar": 1, // No multiplication for 18ayar
    abshodeh: 1000,
  };

  /**
   * Item code to category mapping - Centralized source of truth
   * Used for price snapshot queries and category determination
   */
  private readonly itemCategoryMap: Record<string, string> = {
    // Main Currencies
    usd_sell: "currencies",
    eur: "currencies",
    gbp: "currencies",
    cad: "currencies",
    aud: "currencies",
    aed: "currencies",
    cny: "currencies",
    try: "currencies",

    // Additional Currencies
    chf: "currencies",
    jpy: "currencies",
    rub: "currencies",
    inr: "currencies",
    pkr: "currencies",
    iqd: "currencies",
    kwd: "currencies",
    sar: "currencies",
    qar: "currencies",
    omr: "currencies",
    bhd: "currencies",

    // Currency Variants
    usd_buy: "currencies",
    dolar_harat_sell: "currencies",
    harat_naghdi_sell: "currencies",
    harat_naghdi_buy: "currencies",
    usd_farda_sell: "currencies",
    usd_farda_buy: "currencies",
    usd_shakhs: "currencies",
    usd_sherkat: "currencies",
    usd_pp: "currencies",
    dolar_mashad_sell: "currencies",
    dolar_kordestan_sell: "currencies",
    dolar_soleimanie_sell: "currencies",
    aed_sell: "currencies",
    dirham_dubai: "currencies",
    eur_hav: "currencies",
    gbp_hav: "currencies",
    gbp_wht: "currencies",
    cad_hav: "currencies",
    cad_cash: "currencies",
    hav_cad_my: "currencies",
    hav_cad_cheque: "currencies",
    hav_cad_cash: "currencies",
    aud_hav: "currencies",
    aud_wht: "currencies",

    // Main Cryptocurrencies
    usdt: "crypto",
    btc: "crypto",
    eth: "crypto",

    // Additional Cryptocurrencies
    bnb: "crypto",
    xrp: "crypto",
    ada: "crypto",
    doge: "crypto",
    sol: "crypto",
    matic: "crypto",
    dot: "crypto",
    ltc: "crypto",

    // Gold
    sekkeh: "gold",
    bahar: "gold",
    nim: "gold",
    rob: "gold",
    gerami: "gold",
    "18ayar": "gold",
    abshodeh: "gold",
  };

  /**
   * Map item code to Navasan API code
   * If no explicit mapping exists, convert to lowercase
   */
  private mapToNavasanCode(code: string): string {
    // Check explicit mapping first
    if (this.itemCodeMap[code]) {
      return this.itemCodeMap[code];
    }

    // If no mapping, convert to lowercase as default
    // This makes it work for any new items added to Navasan API
    return code.toLowerCase();
  }

  /**
   * Get chart data for a specific currency code
   */
  async getChartData(
    currencyCode: string,
    timeRange: TimeRange = TimeRange.ONE_MONTH,
    itemType: ItemType = ItemType.CURRENCY,
  ): Promise<ChartResponse> {
    this.logger.log(
      `Fetching chart data for ${currencyCode} (${itemType}) with timeRange: ${timeRange}`,
    );

    // Validate and map currency code
    const upperCode = currencyCode.toUpperCase();
    if (!this.isValidCurrencyCode(upperCode, itemType)) {
      throw new NotFoundException(
        `Currency code "${currencyCode}" not found for item type "${itemType}"`,
      );
    }

    const navasanItemCode = this.mapToNavasanCode(upperCode);
    if (!navasanItemCode) {
      throw new NotFoundException(
        `No Navasan mapping found for currency code "${currencyCode}"`,
      );
    }

    // Calculate date range
    const { startTimestamp, endTimestamp } = this.getDateRange(timeRange);

    // Fetch OHLC data from Navasan API with caching
    try {
      const data = await this.fetchOHLCDataWithCache(
        navasanItemCode,
        startTimestamp,
        endTimestamp,
        timeRange,
      );

      // Transform and return data
      const transformedData = this.transformOHLCData(data);

      return {
        data: transformedData,
        count: transformedData.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch chart data for ${currencyCode}: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Re-throw with appropriate error type
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to fetch chart data for ${currencyCode}. Please try again later.`,
      );
    }
  }

  /**
   * Validate if currency code exists for the given item type
   * Now modular - accepts any code that has a valid mapping or can be lowercased
   */
  private isValidCurrencyCode(code: string, itemType: ItemType): boolean {
    const validCodes = {
      [ItemType.CURRENCY]: [
        // Main currencies
        "USD_SELL",
        "USD",
        "EUR",
        "GBP",
        "CAD",
        "AUD",
        "AED",
        "CNY",
        "CNY_HAV",
        "TRY",
        "TRY_HAV",
        // Additional currencies
        "CHF",
        "JPY",
        "JPY_HAV",
        "RUB",
        "INR",
        "PKR",
        "IQD",
        "KWD",
        "SAR",
        "QAR",
        "OMR",
        "BHD",
        // Currency variants
        "USD_BUY",
        "USD_HARAT_SELL",
        "USD_HARAT_CASH_SELL",
        "USD_HARAT_CASH_BUY",
        "USD_FARDA_SELL",
        "USD_FARDA_BUY",
        "USD_SHAKHS",
        "USD_SHERKAT",
        "USD_PP",
        "USD_MASHAD_SELL",
        "USD_KORDESTAN_SELL",
        "USD_SOLEIMANIE_SELL",
        "AED_SELL",
        "DIRHAM_DUBAI",
        "EUR_HAV",
        "GBP_HAV",
        "GBP_WHT",
        "CAD_HAV",
        "CAD_CASH",
        "AUD_HAV",
        "AUD_WHT",
      ],
      [ItemType.CRYPTO]: [
        // Main crypto
        "BTC",
        "ETH",
        "USDT",
        // Additional crypto
        "BNB",
        "XRP",
        "ADA",
        "DOGE",
        "SOL",
        "MATIC",
        "DOT",
        "LTC",
      ],
      [ItemType.GOLD]: [
        "SEKKEH",
        "BAHAR",
        "NIM",
        "ROB",
        "GERAMI",
        "18AYAR",
        "ABSHODEH",
      ],
    };

    return validCodes[itemType].includes(code);
  }

  /**
   * Get date range (Unix timestamps) based on TimeRange enum
   */
  private getDateRange(timeRange: TimeRange): {
    startTimestamp: number;
    endTimestamp: number;
  } {
    const now = new Date();
    const endTimestamp = Math.floor(now.getTime() / 1000); // Current time in Unix timestamp

    const startDate = new Date(now);

    switch (timeRange) {
      case TimeRange.ONE_DAY:
        startDate.setDate(now.getDate() - 1);
        break;
      case TimeRange.ONE_WEEK:
        startDate.setDate(now.getDate() - 7);
        break;
      case TimeRange.ONE_MONTH:
        startDate.setMonth(now.getMonth() - 1);
        break;
      case TimeRange.THREE_MONTHS:
        startDate.setMonth(now.getMonth() - 3);
        break;
      case TimeRange.ONE_YEAR:
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case TimeRange.ALL:
        startDate.setFullYear(now.getFullYear() - 3);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1); // Default to 1 month
    }

    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    return { startTimestamp, endTimestamp };
  }

  /**
   * Fetch OHLC data from ohlc_permanent collection (SINGLE SOURCE OF TRUTH)
   *
   * This method reads from ohlc_permanent as the primary and ONLY data source.
   * The Navasan API is NOT used for chart data anymore - it's only used by
   * the OhlcCollectorService to populate ohlc_permanent.
   *
   * Data flow:
   * 1. Read from ohlc_permanent (single source of truth)
   * 2. Return data if found
   * 3. Return empty array if no data (no API fallback)
   */
  private async fetchOHLCDataWithCache(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
    timeRange: TimeRange,
  ): Promise<NavasanOHLCDataPoint[]> {
    try {
      // SINGLE SOURCE OF TRUTH: Read from ohlc_permanent collection
      this.logger.log(
        `📊 Fetching chart data from ohlc_permanent for ${itemCode} (${timeRange})`,
      );

      const permanentData = await this.fetchFromOhlcPermanent(
        itemCode,
        startTimestamp,
        endTimestamp,
        timeRange,
      );

      if (permanentData && permanentData.length > 0) {
        this.logger.log(
          `✅ Returning ${permanentData.length} data points from ohlc_permanent for ${itemCode} (${timeRange})`,
        );
        this.metricsService.trackCacheHit("ohlc", "ohlc_permanent");
        return permanentData;
      }

      // No data in ohlc_permanent - return empty array
      this.logger.warn(
        `⚠️ No data found in ohlc_permanent for ${itemCode} (${timeRange})`,
      );
      this.metricsService.trackCacheMiss("ohlc", "ohlc_permanent_empty");
      return [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch OHLC data from ohlc_permanent for ${itemCode}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Fetch OHLC data from ohlc_permanent collection
   * Maps itemCode to uppercase (storage format) and queries by timeframe
   */
  private async fetchFromOhlcPermanent(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
    timeRange: TimeRange,
  ): Promise<NavasanOHLCDataPoint[]> {
    // Map itemCode to uppercase for storage format
    const upperItemCode = itemCode.toUpperCase();

    // Determine the appropriate timeframe based on time range
    const timeframe = this.getTimeframeForRange(timeRange);

    const startDate = new Date(startTimestamp * 1000);
    const endDate = new Date(endTimestamp * 1000);

    this.logger.debug(
      `Querying ohlc_permanent: itemCode=${upperItemCode}, timeframe=${timeframe}, start=${startDate.toISOString()}, end=${endDate.toISOString()}`,
    );

    const records = await safeDbRead(
      () =>
        this.ohlcPermanentModel
          .find({
            itemCode: upperItemCode,
            timeframe: timeframe,
            timestamp: {
              $gte: startDate,
              $lte: endDate,
            },
          })
          .sort({ timestamp: 1 })
          .lean()
          .exec(),
      "fetchFromOhlcPermanent",
      this.logger,
      { itemCode: upperItemCode, timeframe, timeRange },
    );

    if (!records || records.length === 0) {
      return [];
    }

    // Transform ohlc_permanent records to NavasanOHLCDataPoint format
    return records.map((record) => ({
      timestamp: Math.floor(record.timestamp.getTime() / 1000),
      date: record.timestamp.toISOString().split("T")[0],
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
    }));
  }

  /**
   * Map TimeRange to ohlc_permanent timeframe
   * - Short ranges (1d, 1w) use 1d timeframe for granularity
   * - Longer ranges use 1d timeframe aggregated
   */
  private getTimeframeForRange(timeRange: TimeRange): string {
    switch (timeRange) {
      case TimeRange.ONE_DAY:
        return "1d"; // Use daily data for 1 day view
      case TimeRange.ONE_WEEK:
        return "1d"; // Use daily data for 1 week view
      case TimeRange.ONE_MONTH:
        return "1d"; // Use daily data for 1 month view
      case TimeRange.THREE_MONTHS:
        return "1d"; // Use daily data for 3 months view
      case TimeRange.ONE_YEAR:
        return "1d"; // Use daily data for 1 year view
      case TimeRange.ALL:
        return "1d"; // Use daily data for all time view
      default:
        return "1d";
    }
  }

  /**
   * Check if error is due to token expiration
   */
  private isTokenExpirationError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return true;
      }
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
   * Validate OHLC API response structure
   * Ensures response contains valid OHLC data points with required fields
   */
  private validateOHLCResponse(data: unknown, itemCode: string): void {
    // Check that response is an array
    if (!Array.isArray(data)) {
      this.logger.error(
        `Invalid OHLC API response for ${itemCode}: expected array, received ${typeof data}`,
      );
      throw new Error(
        "Invalid OHLC API response structure: expected array of data points",
      );
    }

    // Allow empty arrays (no data for time range is valid)
    if (data.length === 0) {
      this.logger.warn(`OHLC API returned empty array for ${itemCode}`);
      return;
    }

    // Validate structure of each data point
    const requiredFields = [
      "timestamp",
      "date",
      "open",
      "high",
      "low",
      "close",
    ];

    for (let i = 0; i < data.length; i++) {
      const point = data[i];

      // Check that point is an object
      if (!point || typeof point !== "object" || Array.isArray(point)) {
        this.logger.error(
          `Invalid OHLC data point at index ${i} for ${itemCode}: not an object`,
        );
        throw new Error(
          `Invalid OHLC API response: data point ${i} is not an object`,
        );
      }

      // Check all required fields exist
      for (const field of requiredFields) {
        if (!(field in point)) {
          this.logger.error(
            `Missing required field "${field}" in OHLC data point ${i} for ${itemCode}`,
          );
          throw new Error(
            `Invalid OHLC API response: data point ${i} missing "${field}" field`,
          );
        }
      }

      // Validate field types
      const typedPoint = point as NavasanOHLCDataPoint;

      // Validate timestamp is a number
      if (
        typeof typedPoint.timestamp !== "number" ||
        isNaN(typedPoint.timestamp)
      ) {
        this.logger.error(
          `Invalid timestamp in OHLC data point ${i} for ${itemCode}`,
        );
        throw new Error(
          `Invalid OHLC API response: data point ${i} has invalid timestamp`,
        );
      }

      // Validate price fields are numbers or strings that can be parsed as numbers
      const priceFields = ["open", "high", "low", "close"];
      for (const field of priceFields) {
        const value =
          typedPoint[
            field as keyof Pick<
              NavasanOHLCDataPoint,
              "open" | "high" | "low" | "close"
            >
          ];
        // Accept both numbers and numeric strings (API can return either)
        const isValidNumber = typeof value === "number" && !isNaN(value);
        const isValidString =
          typeof value === "string" && !isNaN(parseFloat(value));
        if (!isValidNumber && !isValidString) {
          this.logger.error(
            `Invalid ${field} value in OHLC data point ${i} for ${itemCode}: ${typeof value} = ${value}`,
          );
          throw new Error(
            `Invalid OHLC API response: data point ${i} has invalid "${field}" value`,
          );
        }
      }
    }

    this.logger.log(
      `✅ OHLC API response validation passed for ${itemCode}: ${data.length} data points`,
    );
  }

  /**
   * Fetch OHLC data from Navasan API
   * NOTE: Navasan API requires the API key as a query parameter (not in headers)
   * This is not ideal from a security perspective, but it's how their API works
   */
  private async fetchOHLCFromApi(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<{
    data: NavasanOHLCDataPoint[];
    metadata?: Record<string, unknown>;
  }> {
    try {
      // NOTE: Navasan API requires the API key as a query parameter (not in headers)
      const url = `${this.ohlcBaseUrl}?api_key=${this.apiKey}&item=${itemCode}&start=${startTimestamp}&end=${endTimestamp}`;

      this.logger.log(
        `Calling Navasan OHLC API: ${itemCode} from ${startTimestamp} to ${endTimestamp}`,
      );

      const response = await axios.get<NavasanOHLCDataPoint[]>(url, {
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      // Handle authentication errors - throw error to trigger stale fallback
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Navasan OHLC API authentication failed. API key may be expired or invalid.",
        );
      }

      // Handle rate limiting - throw error to trigger stale fallback
      if (response.status === 429) {
        const retryAfter = response.headers["retry-after"];
        // Throw regular Error so it gets caught by try-catch and triggers stale cache fallback
        throw new Error(
          `Navasan OHLC API rate limit exceeded. Retry after ${retryAfter || "some time"}.`,
        );
      }

      // Handle other non-200 responses
      if (response.status !== 200) {
        // SECURITY FIX: Don't expose specific status codes to prevent information leakage
        throw new Error(
          "External API returned unexpected response. Please try again later.",
        );
      }

      // VALIDATION FIX: Validate OHLC API response structure before caching
      // This prevents invalid/malformed data from being cached and served to users
      this.validateOHLCResponse(response.data, itemCode);

      if (response.data.length === 0) {
        this.logger.warn(`No OHLC data returned for ${itemCode}`);
      }

      // Capture rate limit metadata for monitoring
      const apiMetadata: Record<string, unknown> = {
        statusCode: response.status,
      };

      // Extract rate limit headers if present
      if (response.headers["x-ratelimit-remaining"]) {
        apiMetadata.rateLimitRemaining = parseInt(
          response.headers["x-ratelimit-remaining"],
          10,
        );
      }
      if (response.headers["x-ratelimit-reset"]) {
        const resetTimestamp = parseInt(
          response.headers["x-ratelimit-reset"],
          10,
        );
        apiMetadata.rateLimitReset = new Date(resetTimestamp * 1000);
      }

      return { data: response.data, metadata: apiMetadata };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          throw new InternalServerErrorException(
            "Request to Navasan API timed out",
          );
        }
        if (error.response) {
          // Log detailed error internally for debugging
          this.logger.error(
            `Navasan API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
          );
          // SECURITY FIX: Don't expose API error details to clients to prevent information leakage
          throw new InternalServerErrorException(
            "Failed to fetch chart data. Please try again later.",
          );
        }
      }
      throw error;
    }
  }

  /**
   * Get fresh cached OHLC data (< 1 hour old)
   * DB ERROR HANDLING: Returns null on DB failure instead of throwing
   */
  private async getFreshCachedOHLCData(
    cacheKey: string,
  ): Promise<NavasanOHLCDataPoint[] | null> {
    const freshExpiry = new Date(
      Date.now() - this.freshCacheMinutes * 60 * 1000,
    );

    const cached = await safeDbRead(
      () =>
        this.cacheModel
          .findOne({
            category: cacheKey,
            cacheType: "fresh",
            timestamp: { $gte: freshExpiry },
          })
          .sort({ timestamp: -1 })
          .exec(),
      "getFreshCachedOHLCData",
      this.logger,
      { cacheKey },
    );

    if (cached && Array.isArray(cached.data) && isOHLCDataArray(cached.data)) {
      return cached.data;
    }

    return null;
  }

  /**
   * Get stale cached OHLC data (up to 72 hours old) for fallback
   * DB ERROR HANDLING: Returns null on DB failure instead of throwing
   */
  private async getStaleCachedOHLCData(
    cacheKey: string,
  ): Promise<NavasanOHLCDataPoint[] | null> {
    const staleExpiry = new Date(
      Date.now() - this.staleCacheHours * 60 * 60 * 1000,
    );

    const cached = await safeDbRead(
      () =>
        this.cacheModel
          .findOne({
            category: cacheKey,
            cacheType: { $in: ["fresh", "stale"] },
            timestamp: { $gte: staleExpiry },
          })
          .sort({ timestamp: -1 })
          .exec(),
      "getStaleCachedOHLCData",
      this.logger,
      { cacheKey },
    );

    if (cached && Array.isArray(cached.data) && isOHLCDataArray(cached.data)) {
      return cached.data;
    }

    return null;
  }

  /**
   * Save OHLC data to fresh cache using atomic upsert
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * DB ERROR HANDLING: Uses safeDbWrite - won't throw on DB failure
   */
  private async saveOHLCToFreshCache(
    cacheKey: string,
    data: NavasanOHLCDataPoint[],
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
            { category: cacheKey, cacheType: "fresh" },
            {
              $set: {
                data: data,
                timestamp: now,
                expiresAt,
                lastApiSuccess: now,
                apiErrorCount: 0, // Reset error count on success
                isFallback: false,
                lastApiError: undefined,
                apiMetadata: apiMetadata || undefined,
              },
            },
            { upsert: true, new: true },
          )
          .exec(),
      "saveOHLCToFreshCache",
      this.logger,
      { cacheKey },
      false, // Not critical
    );

    this.logger.log(
      `💾 Saved fresh OHLC cache for ${cacheKey}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save OHLC data to stale cache using atomic upsert
   * SECURITY FIX: Using findOneAndUpdate with upsert instead of delete-then-create
   * DB ERROR HANDLING: Uses safeDbWrite - critical for fallback functionality
   */
  private async saveOHLCToStaleCache(
    cacheKey: string,
    data: NavasanOHLCDataPoint[],
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
            { category: cacheKey, cacheType: "stale" },
            {
              $set: {
                data: data,
                timestamp: now,
                expiresAt,
                lastApiSuccess: now,
                apiErrorCount: 0, // Reset error count on success
                isFallback: false,
                lastApiError: undefined,
                apiMetadata: apiMetadata || undefined,
              },
            },
            { upsert: true, new: true },
          )
          .exec(),
      "saveOHLCToStaleCache",
      this.logger,
      { cacheKey },
      true, // Critical for fallback
    );

    this.logger.log(
      `💾 Saved stale OHLC cache for ${cacheKey}, expires at: ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Save OHLC cache with retry logic for resilience
   * RELIABILITY FIX: Cache write failures shouldn't fail the request
   */
  private async saveOHLCToFreshCacheWithRetry(
    cacheKey: string,
    data: NavasanOHLCDataPoint[],
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.saveOHLCToFreshCache(cacheKey, data, apiMetadata);
    } catch (error) {
      this.logger.error(
        `Failed to save fresh OHLC cache for ${cacheKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't fail the request, just log the error
    }
  }

  /**
   * Save stale OHLC cache with retry logic
   * RELIABILITY FIX: Retry stale cache writes since they're critical for fallback
   */
  private async saveOHLCToStaleCacheWithRetry(
    cacheKey: string,
    data: NavasanOHLCDataPoint[],
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    let retries = 0;
    const maxRetries = 1;

    while (retries <= maxRetries) {
      try {
        await this.saveOHLCToStaleCache(cacheKey, data, apiMetadata);
        return; // Success
      } catch (error) {
        retries++;
        this.logger.error(
          `Failed to save stale OHLC cache for ${cacheKey} (attempt ${retries}/${maxRetries + 1}): ${error instanceof Error ? error.message : String(error)}`,
        );

        if (retries > maxRetries) {
          this.logger.error(
            `Gave up saving stale OHLC cache for ${cacheKey} after ${maxRetries + 1} attempts`,
          );
          // Don't fail the request, but log as critical
        }
      }
    }
  }

  /**
   * Mark OHLC cache entry as being used as fallback and track API errors
   * Populates isFallback, lastApiError, and increments apiErrorCount
   * DB ERROR HANDLING: Won't throw on DB failure
   */
  private async markOHLCCacheAsFallback(
    cacheKey: string,
    errorMessage: string,
  ): Promise<void> {
    await safeDbWrite(
      () =>
        this.cacheModel
          .updateMany(
            { category: cacheKey, cacheType: { $in: ["fresh", "stale"] } },
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
      "markOHLCCacheAsFallback",
      this.logger,
      { cacheKey, errorMessage },
      false, // Not critical - just metadata
    );
  }

  /**
   * Transform Navasan OHLC data to frontend format
   */
  private transformOHLCData(data: NavasanOHLCDataPoint[]): ChartDataPoint[] {
    return data.map((point) => {
      // Convert prices to numbers (handle both number and string types)
      const open =
        typeof point.open === "number" ? point.open : parseFloat(point.open);
      const high =
        typeof point.high === "number" ? point.high : parseFloat(point.high);
      const low =
        typeof point.low === "number" ? point.low : parseFloat(point.low);
      const close =
        typeof point.close === "number" ? point.close : parseFloat(point.close);

      // Convert timestamp to ISO 8601 string
      let timestamp: string;
      if (typeof point.timestamp === 'number') {
        timestamp = new Date(point.timestamp * 1000).toISOString();
      } else if (point.timestamp instanceof Date) {
        timestamp = point.timestamp.toISOString();
      } else if (typeof point.timestamp === 'string') {
        timestamp = new Date(point.timestamp).toISOString();
      } else {
        timestamp = new Date().toISOString();
      }

      return {
        timestamp,
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(close),
        volume: 0, // Navasan doesn't provide volume data
      };
    });
  }

  /**
   * Get human-readable data age string
   */
  private getDataAge(timestamp: Date): string {
    const now = new Date();
    const ageMs = now.getTime() - timestamp.getTime();
    const ageMinutes = Math.floor(ageMs / 60000);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);

    if (ageDays > 0) {
      return `${ageDays} day${ageDays > 1 ? "s" : ""}`;
    } else if (ageHours > 0) {
      return `${ageHours} hour${ageHours > 1 ? "s" : ""}`;
    } else {
      return `${ageMinutes} minute${ageMinutes > 1 ? "s" : ""}`;
    }
  }

  /**
   * ==========================================
   * PRICE SNAPSHOT FALLBACK METHODS
   * ==========================================
   */

  /**
   * Map item code to price snapshot category
   * @param itemCode - Navasan item code (e.g., 'usd_sell', 'btc', 'sekkeh')
   * @returns Category name ('currencies', 'crypto', or 'gold')
   */
  private mapItemCodeToCategory(itemCode: string): string {
    const category = this.itemCategoryMap[itemCode];

    if (!category) {
      throw new Error(`Unknown item code: ${itemCode}`);
    }

    return category;
  }

  /**
   * Extract price value from a price snapshot for a specific item code
   * Handles gold price multiplication (most gold items stored as thousands)
   * @param snapshot - Price snapshot document
   * @param itemCode - Item code to extract (e.g., 'usd_sell', 'btc')
   * @returns Price as number, or null if not found/invalid
   */
  private extractPriceFromSnapshot(
    snapshot: PriceSnapshotDocument,
    itemCode: string,
  ): number | null {
    try {
      // Type guard: check if data is an object
      if (!snapshot.data || typeof snapshot.data !== "object") {
        return null;
      }

      // Extract item data with proper type guard
      const itemData = snapshot.data[itemCode];
      if (!itemData || typeof itemData !== "object") {
        return null;
      }

      // Type assertion with validation
      const typedItemData = itemData as Record<string, unknown>;
      const valueStr = typedItemData.value;
      if (typeof valueStr !== "string") {
        return null;
      }

      // Parse to number
      let price = parseFloat(valueStr);
      if (isNaN(price)) {
        return null;
      }

      // Apply gold price multiplier if configured (defaults to 1 if not in map)
      const multiplier = this.goldPriceMultipliers[itemCode] || 1;
      price = price * multiplier;

      return price;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error extracting price from snapshot for ${itemCode}: ${errorMessage}`,
        errorStack,
      );
      return null;
    }
  }

  /**
   * Build chart data from price snapshots as fallback when OHLC API is unavailable
   * Creates synthetic OHLC data where open=high=low=close=snapshot price
   * @param itemCode - Item code (e.g., 'usd_sell', 'btc')
   * @param startTimestamp - Start time (Unix timestamp)
   * @param endTimestamp - End time (Unix timestamp)
   * @param timeRange - Time range enum (for logging)
   * @returns Array of OHLC data points, or null if insufficient data
   */
  private async buildChartFromPriceSnapshots(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
    timeRange: TimeRange,
  ): Promise<NavasanOHLCDataPoint[] | null> {
    try {
      // Validate timestamps
      if (startTimestamp < 0 || endTimestamp < 0) {
        this.logger.error(
          `Invalid timestamps for ${itemCode}: start=${startTimestamp}, end=${endTimestamp}`,
        );
        return null;
      }

      if (startTimestamp >= endTimestamp) {
        this.logger.error(
          `Start timestamp must be before end timestamp for ${itemCode}`,
        );
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      const maxRangeSeconds = 3 * 365 * 24 * 60 * 60; // 3 years maximum

      if (endTimestamp - startTimestamp > maxRangeSeconds) {
        this.logger.error(
          `Time range too large for ${itemCode}: ${endTimestamp - startTimestamp} seconds (max: ${maxRangeSeconds})`,
        );
        return null;
      }

      // Map item code to category for querying snapshots
      const category = this.mapItemCodeToCategory(itemCode);

      this.logger.log(
        `📸 Attempting to build chart from price snapshots for ${itemCode} (category: ${category})`,
      );

      // Query price snapshots for the time range
      const snapshots = await safeDbRead(
        () =>
          this.priceSnapshotModel
            .find({
              category,
              timestamp: {
                $gte: new Date(startTimestamp * 1000),
                $lte: new Date(endTimestamp * 1000),
              },
            })
            .sort({ timestamp: 1 })
            .exec(),
        "buildChartFromPriceSnapshots",
        this.logger,
        { itemCode, category, timeRange },
      );

      if (!snapshots || snapshots.length === 0) {
        this.logger.warn(
          `No price snapshots found for ${itemCode} in requested time range`,
        );
        return null;
      }

      // Calculate expected number of hourly snapshots
      const hoursDiff = Math.floor((endTimestamp - startTimestamp) / 3600);
      const expectedSnapshots = hoursDiff;
      const coverage = (snapshots.length / expectedSnapshots) * 100;

      this.logger.log(
        `Found ${snapshots.length} snapshots (expected ~${expectedSnapshots}, coverage: ${coverage.toFixed(1)}%)`,
      );

      // Check if coverage meets configured threshold
      if (coverage < this.snapshotCoverageThreshold) {
        this.logger.warn(
          `Insufficient snapshot coverage (${coverage.toFixed(1)}%) for ${itemCode}. ` +
            `Need at least ${this.snapshotCoverageThreshold}%.`,
        );
        return null;
      }

      // Transform snapshots to synthetic OHLC data
      const ohlcData: NavasanOHLCDataPoint[] = [];

      for (const snapshot of snapshots) {
        const price = this.extractPriceFromSnapshot(snapshot, itemCode);

        if (price === null) {
          // Skip snapshots where we can't extract the price
          continue;
        }

        // Validate price sanity
        if (price < 0) {
          this.logger.warn(
            `Negative price detected for ${itemCode} at ${snapshot.timestamp}: ${price}`,
          );
          continue;
        }

        if (price === 0) {
          this.logger.warn(
            `Zero price detected for ${itemCode} at ${snapshot.timestamp}`,
          );
          continue;
        }

        // Set reasonable maximum (1 billion Toman)
        const maxReasonablePrice = 1_000_000_000;
        if (price > maxReasonablePrice) {
          this.logger.warn(
            `Suspiciously high price for ${itemCode} at ${snapshot.timestamp}: ${price}`,
          );
          continue;
        }

        // Create synthetic OHLC point (open=high=low=close=price)
        const unixTimestamp = Math.floor(snapshot.timestamp.getTime() / 1000);
        ohlcData.push({
          timestamp: unixTimestamp,
          date: snapshot.timestamp.toISOString().split("T")[0], // YYYY-MM-DD
          open: price,
          high: price,
          low: price,
          close: price,
        });
      }

      if (ohlcData.length === 0) {
        this.logger.warn(
          `Could not extract any valid prices from snapshots for ${itemCode}`,
        );
        return null;
      }

      this.logger.log(
        `✅ Successfully built ${ohlcData.length} OHLC points from price snapshots for ${itemCode}`,
      );

      return ohlcData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to build chart from price snapshots for ${itemCode}: ${errorMessage}`,
        errorStack,
      );

      return null;
    }
  }

  /**
   * Build chart data from historical_ohlc database as fallback
   * Uses daily OHLC data aggregated from intraday snapshots
   * @param itemCode - Item code (e.g., 'usd_sell', 'btc')
   * @param startTimestamp - Start time (Unix timestamp)
   * @param endTimestamp - End time (Unix timestamp)
   * @param timeRange - Time range enum (for logging)
   * @returns Array of OHLC data points, or null if no data available
   */
  private async buildChartFromHistoricalOhlc(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
    timeRange: TimeRange,
  ): Promise<NavasanOHLCDataPoint[] | null> {
    try {
      // Validate timestamps
      if (startTimestamp < 0 || endTimestamp < 0) {
        this.logger.error(
          `Invalid timestamps for ${itemCode}: start=${startTimestamp}, end=${endTimestamp}`,
        );
        return null;
      }

      if (startTimestamp >= endTimestamp) {
        this.logger.error(
          `Start timestamp must be before end timestamp for ${itemCode}`,
        );
        return null;
      }

      this.logger.log(
        `🗄️  Querying historical_ohlc database for ${itemCode} (${timeRange})`,
      );

      // Convert Unix timestamps to Date objects
      const startDate = new Date(startTimestamp * 1000);
      const endDate = new Date(endTimestamp * 1000);

      // Determine which timeframe to use based on time range
      // historical_ohlc only has WEEKLY and MONTHLY data
      // For shorter ranges (< 365 days), use WEEKLY; for longer use MONTHLY
      let timeframe: OhlcTimeframe;
      const daysDiff = Math.floor((endTimestamp - startTimestamp) / 86400);

      if (daysDiff <= 365) {
        timeframe = OhlcTimeframe.WEEKLY;
      } else {
        timeframe = OhlcTimeframe.MONTHLY;
      }

      // Query historical_ohlc collection
      const historicalRecords = await safeDbRead(
        () =>
          this.historicalOhlcModel
            .find({
              itemCode,
              timeframe,
              periodStart: {
                $gte: startDate,
                $lte: endDate,
              },
            })
            .sort({ periodStart: 1 })
            .exec(),
        "buildChartFromHistoricalOhlc",
        this.logger,
        { itemCode, timeframe, timeRange },
      );

      if (!historicalRecords || historicalRecords.length === 0) {
        this.logger.warn(
          `No historical_ohlc data found for ${itemCode} (${timeframe}) in requested time range`,
        );
        return null;
      }

      this.logger.log(
        `✅ Found ${historicalRecords.length} historical_ohlc records (${timeframe}) for ${itemCode}`,
      );

      // Transform historical_ohlc records to NavasanOHLCDataPoint format
      const ohlcData: NavasanOHLCDataPoint[] = historicalRecords.map(
        (record) => {
          const unixTimestamp = Math.floor(
            record.periodStart.getTime() / 1000,
          );
          return {
            timestamp: unixTimestamp,
            date: record.periodStart.toISOString().split("T")[0], // YYYY-MM-DD
            open: record.open,
            high: record.high,
            low: record.low,
            close: record.close,
          };
        },
      );

      this.logger.log(
        `✅ Successfully transformed ${ohlcData.length} historical_ohlc records to OHLC data points for ${itemCode}`,
      );

      return ohlcData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Failed to build chart from historical_ohlc for ${itemCode}: ${errorMessage}`,
        errorStack,
      );

      return null;
    }
  }
}
