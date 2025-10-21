import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import axios from 'axios';
import { Cache, CacheDocument } from './schemas/cache.schema';

@Injectable()
export class NavasanService {
  private readonly logger = new Logger(NavasanService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'http://api.navasan.tech/latest/';
  private readonly cacheExpiryMinutes = 5;

  // Define items to fetch from Navasan API
  private readonly items = {
    all: 'usd_sell,eur,gbp,cad,aud,usdt,btc,eth,sekkeh,bahar,nim,rob,gerami,18ayar',
    currencies: 'usd_sell,eur,gbp,cad,aud',
    crypto: 'usdt,btc,eth',
    gold: 'sekkeh,bahar,nim,rob,gerami,18ayar',
  };

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('NAVASAN_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('NAVASAN_API_KEY is not set in environment variables');
    }
  }

  /**
   * Get latest rates for all items (currencies, crypto, gold)
   */
  async getLatestRates(): Promise<Record<string, unknown>> {
    return this.fetchWithCache('all', this.items.all);
  }

  /**
   * Get latest currency rates only
   */
  async getCurrencies(): Promise<Record<string, unknown>> {
    return this.fetchWithCache('currencies', this.items.currencies);
  }

  /**
   * Get latest cryptocurrency rates only
   */
  async getCrypto(): Promise<Record<string, unknown>> {
    return this.fetchWithCache('crypto', this.items.crypto);
  }

  /**
   * Get latest gold prices only
   * Note: Navasan API returns gold coins (sekkeh, bahar, nim, rob, gerami) in thousands of tomans
   * We multiply by 1000 to get the actual value in tomans
   * 18ayar is already in tomans, so we don't multiply it
   */
  async getGold(): Promise<Record<string, unknown>> {
    const data = await this.fetchWithCache('gold', this.items.gold);

    // Gold coins that need to be multiplied by 1000 (returned in thousands)
    const coinsToMultiply = ['sekkeh', 'bahar', 'nim', 'rob', 'gerami'];

    // Multiply coin values by 1000
    const transformedData = { ...data };
    for (const coin of coinsToMultiply) {
      if (transformedData[coin] && typeof transformedData[coin] === 'object') {
        const coinData = transformedData[coin] as Record<string, unknown>;
        if (typeof coinData.value === 'string') {
          coinData.value = String(Number(coinData.value) * 1000);
        }
        if (typeof coinData.change === 'number') {
          coinData.change = coinData.change * 1000;
        }
      }
    }

    return transformedData;
  }

  /**
   * Fetch data with caching logic
   * If cache is fresh (< 5 minutes old), return cached data
   * Otherwise, fetch from API and update cache
   */
  private async fetchWithCache(
    category: string,
    items: string,
  ): Promise<Record<string, unknown>> {
    try {
      // Check if we have valid cached data
      const cached = await this.getCachedData(category);
      if (cached) {
        this.logger.log(`Returning cached data for category: ${category}`);
        return cached.data as Record<string, unknown>;
      }

      // No valid cache, fetch from API
      this.logger.log(`Fetching fresh data from Navasan API for category: ${category}`);
      const data = await this.fetchFromApi(items);

      // Save to cache
      await this.saveToCache(category, data);

      return data;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch data for category ${category}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get cached data if it's still valid (less than 5 minutes old)
   */
  private async getCachedData(category: string): Promise<CacheDocument | null> {
    const fiveMinutesAgo = new Date(Date.now() - this.cacheExpiryMinutes * 60 * 1000);

    const cached = await this.cacheModel
      .findOne({
        category,
        timestamp: { $gte: fiveMinutesAgo },
      })
      .sort({ timestamp: -1 })
      .exec();

    return cached;
  }

  /**
   * Fetch data from Navasan API
   */
  private async fetchFromApi(items: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}?api_key=${this.apiKey}&item=${items}`;

    const response = await axios.get(url);

    if (response.status !== 200) {
      throw new Error(`Navasan API returned status ${response.status}`);
    }

    return response.data;
  }

  /**
   * Save data to cache
   */
  private async saveToCache(category: string, data: Record<string, unknown>): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.cacheExpiryMinutes * 60 * 1000);

    // Delete old cache entries for this category
    await this.cacheModel.deleteMany({ category }).exec();

    // Create new cache entry
    const cache = new this.cacheModel({
      category,
      data,
      timestamp: now,
      expiresAt,
    });

    await cache.save();
    this.logger.log(`Cached data for category: ${category}, expires at: ${expiresAt.toISOString()}`);
  }
}
