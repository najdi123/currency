import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  OhlcSnapshot,
  OhlcSnapshotDocument,
} from '../schemas/ohlc-snapshot.schema';
import { ItemCategory } from '../constants/navasan.constants';
import { NavasanTransformerService } from './navasan-transformer.service';
import { NavasanCacheManagerService } from './navasan-cache-manager.service';

/**
 * NavasanOhlcService
 *
 * Responsible for OHLC (Open, High, Low, Close) data operations
 * - Fetches OHLC data from database
 * - Aggregates intraday data to OHLC
 * - Calculates daily OHLC values
 * - Manages OHLC snapshots
 * - Handles timeframe conversions
 */
@Injectable()
export class NavasanOhlcService {
  private readonly logger = new Logger(NavasanOhlcService.name);

  constructor(
    @InjectModel(OhlcSnapshot.name)
    private readonly ohlcSnapshotModel: Model<OhlcSnapshotDocument>,
    private readonly transformerService: NavasanTransformerService,
    private readonly cacheManager: NavasanCacheManagerService,
  ) {}

  /**
   * Get OHLC data for yesterday (fallback when fresh data unavailable)
   */
  async getYesterdayOhlc(category: ItemCategory): Promise<any | null> {
    try {
      // Check cache first
      const cached = await this.cacheManager.getOhlcData(category);
      if (cached) {
        return cached;
      }

      // Calculate yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const tomorrow = new Date(yesterday);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query database for yesterday's OHLC snapshot
      const snapshot = await this.ohlcSnapshotModel
        .findOne({
          category,
          timestamp: {
            $gte: yesterday,
            $lt: tomorrow,
          },
        })
        .sort({ timestamp: -1 })
        .lean()
        .exec();

      if (!snapshot) {
        this.logger.warn(`No OHLC snapshot found for ${category} on ${yesterday.toDateString()}`);
        return null;
      }

      // Transform and cache
      const transformed = this.transformSnapshot(snapshot);
      await this.cacheManager.setOhlcData(category, transformed);

      return transformed;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error fetching yesterday's OHLC for ${category}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Get OHLC data for a specific date
   */
  async getOhlcForDate(
    category: ItemCategory,
    date: Date,
  ): Promise<any | null> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const snapshot = await this.ohlcSnapshotModel
        .findOne({
          category,
          timestamp: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
        .sort({ timestamp: -1 })
        .lean()
        .exec();

      if (!snapshot) {
        this.logger.debug(`No OHLC snapshot found for ${category} on ${date.toDateString()}`);
        return null;
      }

      return this.transformSnapshot(snapshot);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error fetching OHLC for ${category} on ${date.toDateString()}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Get OHLC data for a date range
   */
  async getOhlcRange(
    category: ItemCategory,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    try {
      const snapshots = await this.ohlcSnapshotModel
        .find({
          category,
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .sort({ timestamp: 1 })
        .lean()
        .exec();

      return snapshots.map((snapshot) => this.transformSnapshot(snapshot));
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error fetching OHLC range for ${category}: ${err.message}`,
      );
      return [];
    }
  }

  /**
   * Calculate OHLC from price snapshots
   */
  calculateOhlcFromPrices(prices: any[]): any {
    if (!Array.isArray(prices) || prices.length === 0) {
      return null;
    }

    const values = prices.map((p) => parseFloat(p.value)).filter((v) => !isNaN(v));

    if (values.length === 0) {
      return null;
    }

    return {
      open: values[0],
      high: Math.max(...values),
      low: Math.min(...values),
      close: values[values.length - 1],
      count: values.length,
    };
  }

  /**
   * Create OHLC snapshot
   */
  async createSnapshot(
    category: ItemCategory,
    data: any,
    timestamp: Date = new Date(),
  ): Promise<void> {
    try {
      await this.ohlcSnapshotModel.create({
        category,
        data,
        timestamp,
      });

      this.logger.log(`Created OHLC snapshot for ${category} at ${timestamp.toISOString()}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error creating OHLC snapshot for ${category}: ${err.message}`,
      );
    }
  }

  /**
   * Get latest OHLC snapshot
   */
  async getLatestSnapshot(category: ItemCategory): Promise<any | null> {
    try {
      const snapshot = await this.ohlcSnapshotModel
        .findOne({ category })
        .sort({ timestamp: -1 })
        .lean()
        .exec();

      if (!snapshot) {
        return null;
      }

      return this.transformSnapshot(snapshot);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error fetching latest OHLC snapshot for ${category}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Transform database snapshot to API response format
   */
  private transformSnapshot(snapshot: any): any {
    if (!snapshot) {
      return null;
    }

    return {
      ...snapshot.data,
      timestamp: snapshot.timestamp,
      category: snapshot.category,
    };
  }

  /**
   * Aggregate OHLC data by timeframe
   */
  async aggregateByTimeframe(
    category: ItemCategory,
    timeframe: string,
    limit: number = 100,
  ): Promise<any[]> {
    // This would implement aggregation logic
    // For now, return empty array as placeholder
    this.logger.warn(`OHLC aggregation by timeframe not yet implemented`);
    return [];
  }

  /**
   * Get OHLC statistics
   */
  async getOhlcStats(category: ItemCategory): Promise<{
    totalSnapshots: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
  }> {
    try {
      const total = await this.ohlcSnapshotModel.countDocuments({ category });

      const oldest = await this.ohlcSnapshotModel
        .findOne({ category })
        .sort({ timestamp: 1 })
        .select('timestamp')
        .lean()
        .exec();

      const newest = await this.ohlcSnapshotModel
        .findOne({ category })
        .sort({ timestamp: -1 })
        .select('timestamp')
        .lean()
        .exec();

      return {
        totalSnapshots: total,
        oldestSnapshot: oldest?.timestamp || null,
        newestSnapshot: newest?.timestamp || null,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error fetching OHLC stats for ${category}: ${err.message}`,
      );
      return {
        totalSnapshots: 0,
        oldestSnapshot: null,
        newestSnapshot: null,
      };
    }
  }
}
