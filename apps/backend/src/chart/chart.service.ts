import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import axios from 'axios';
import { TimeRange, ItemType } from './dto/chart-query.dto';
import { ChartDataPoint, ChartResponse } from './interfaces/chart.interface';
import { Cache, CacheDocument } from '../navasan/schemas/cache.schema';

/**
 * Interface for Navasan OHLC API response
 */
interface NavasanOHLCDataPoint {
  timestamp: number; // Unix timestamp
  date: string; // Persian date YYYY-MM-DD
  open: string; // Price as string
  high: string; // Price as string
  low: string; // Price as string
  close: string; // Price as string
}

@Injectable()
export class ChartService {
  private readonly logger = new Logger(ChartService.name);
  private readonly apiKey: string;
  private readonly ohlcBaseUrl = 'http://api.navasan.tech/ohlcSearch/';
  private readonly cacheExpiryMinutes = 60; // 1 hour cache for OHLC data

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('NAVASAN_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.error('NAVASAN_API_KEY is not set in environment variables');
      throw new Error('NAVASAN_API_KEY is required for chart service');
    }
  }

  /**
   * Map frontend item codes to Navasan API codes
   * Frontend sends uppercase codes, we map them to Navasan's lowercase format
   */
  private readonly itemCodeMap: Record<string, string> = {
    // Currencies
    USD_SELL: 'usd_sell',
    USD: 'usd_sell', // Fallback for backwards compatibility
    EUR: 'eur',
    GBP: 'gbp',
    CAD: 'cad',
    AUD: 'aud',

    // Cryptocurrencies
    USDT: 'usdt',
    BTC: 'btc',
    ETH: 'eth',

    // Gold items
    SEKKEH: 'sekkeh',
    BAHAR: 'bahar',
    NIM: 'nim',
    ROB: 'rob',
    GERAMI: 'gerami',
    '18AYAR': '18ayar',
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
      [ItemType.CURRENCY]: ['USD_SELL', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'],
      [ItemType.CRYPTO]: ['BTC', 'ETH', 'USDT'],
      [ItemType.GOLD]: ['SEKKEH', 'BAHAR', 'NIM', 'ROB', 'GERAMI', '18AYAR'],
    };

    return validCodes[itemType].includes(code);
  }

  /**
   * Get date range (Unix timestamps) based on TimeRange enum
   */
  private getDateRange(timeRange: TimeRange): { startTimestamp: number; endTimestamp: number } {
    const now = new Date();
    const endTimestamp = Math.floor(now.getTime() / 1000); // Current time in Unix timestamp

    let startDate = new Date(now);

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
   * Fetch OHLC data with caching
   */
  private async fetchOHLCDataWithCache(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
    timeRange: TimeRange,
  ): Promise<NavasanOHLCDataPoint[]> {
    // Generate cache key based on item, time range
    const cacheKey = `ohlc_${itemCode}_${timeRange}`;

    try {
      // Check cache first
      const cached = await this.getCachedOHLCData(cacheKey);
      if (cached) {
        this.logger.log(`Returning cached OHLC data for ${itemCode} (${timeRange})`);
        return cached as NavasanOHLCDataPoint[];
      }

      // No valid cache, fetch from API
      this.logger.log(`Fetching OHLC data from Navasan API for ${itemCode} (${timeRange})`);
      const data = await this.fetchOHLCFromApi(itemCode, startTimestamp, endTimestamp);

      // Save to cache
      await this.saveOHLCToCache(cacheKey, data);

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch OHLC data for ${itemCode}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Fetch OHLC data from Navasan API
   */
  private async fetchOHLCFromApi(
    itemCode: string,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<NavasanOHLCDataPoint[]> {
    try {
      const url = `${this.ohlcBaseUrl}?api_key=${this.apiKey}&item=${itemCode}&start=${startTimestamp}&end=${endTimestamp}`;

      this.logger.log(`Calling Navasan OHLC API: ${itemCode} from ${startTimestamp} to ${endTimestamp}`);

      const response = await axios.get<NavasanOHLCDataPoint[]>(url, {
        timeout: 10000, // 10 second timeout
      });

      if (response.status !== 200) {
        throw new Error(`Navasan OHLC API returned status ${response.status}`);
      }

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format from Navasan OHLC API');
      }

      if (response.data.length === 0) {
        this.logger.warn(`No OHLC data returned for ${itemCode}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new InternalServerErrorException('Request to Navasan API timed out');
        }
        if (error.response) {
          this.logger.error(
            `Navasan API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
          );
          throw new InternalServerErrorException(
            `Navasan API returned error: ${error.response.status}`,
          );
        }
      }
      throw error;
    }
  }

  /**
   * Get cached OHLC data if valid
   */
  private async getCachedOHLCData(cacheKey: string): Promise<unknown[] | null> {
    const cacheExpiry = new Date(Date.now() - this.cacheExpiryMinutes * 60 * 1000);

    const cached = await this.cacheModel
      .findOne({
        category: cacheKey,
        timestamp: { $gte: cacheExpiry },
      })
      .sort({ timestamp: -1 })
      .exec();

    if (cached && Array.isArray(cached.data)) {
      return cached.data as unknown[];
    }

    return null;
  }

  /**
   * Save OHLC data to cache
   */
  private async saveOHLCToCache(cacheKey: string, data: NavasanOHLCDataPoint[]): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.cacheExpiryMinutes * 60 * 1000);

    // Delete old cache entries for this key
    await this.cacheModel.deleteMany({ category: cacheKey }).exec();

    // Create new cache entry
    const cache = new this.cacheModel({
      category: cacheKey,
      data: data,
      timestamp: now,
      expiresAt,
    });

    await cache.save();
    this.logger.log(`Cached OHLC data for ${cacheKey}, expires at: ${expiresAt.toISOString()}`);
  }

  /**
   * Transform Navasan OHLC data to frontend format
   */
  private transformOHLCData(data: NavasanOHLCDataPoint[]): ChartDataPoint[] {
    return data.map((point) => {
      // Parse string prices to numbers
      const open = parseFloat(point.open);
      const high = parseFloat(point.high);
      const low = parseFloat(point.low);
      const close = parseFloat(point.close);

      // Convert Unix timestamp to ISO 8601 string
      const timestamp = new Date(point.timestamp * 1000).toISOString();

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
}
