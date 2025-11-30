import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PriceSnapshot, PriceSnapshotDocument } from '../schemas/price-snapshot.schema';
import { OHLCPermanent, OHLCPermanentDocument } from '../schemas/ohlc-permanent.schema';
import { SNAPSHOT } from '../constants/market-data.constants';
import { MarketDataResponse, AggregatedOhlcData } from '../types/market-data.types';
import { MetricsService } from '../../metrics/metrics.service';
import { safeDbRead, safeDbWrite } from '../../common/utils/db-error-handler';

/**
 * MarketDataSnapshotService
 *
 * Responsible for managing price snapshots and OHLC queries
 * - Saves hourly price snapshots (fallback data source)
 * - Finds closest snapshots for historical queries
 * - Queries ohlc_permanent for OHLC data
 * - Handles retention policies
 */
@Injectable()
export class MarketDataSnapshotService {
  private readonly logger = new Logger(MarketDataSnapshotService.name);

  constructor(
    @InjectModel(PriceSnapshot.name)
    private priceSnapshotModel: Model<PriceSnapshotDocument>,
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
    private metricsService: MetricsService,
  ) {}

  /**
   * Save hourly price snapshot to database
   * Records are auto-deleted after 90 days via TTL index
   *
   * HOURLY SNAPSHOT LOGIC: Only saves one snapshot per hour
   */
  async savePriceSnapshot(
    category: string,
    data: MarketDataResponse,
    apiMetadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const now = new Date();
      // Round to current hour
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
        'checkExistingSnapshot',
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
        source: 'api',
        metadata: apiMetadata,
      });

      const saveResult = await safeDbWrite(
        () => snapshot.save(),
        'savePriceSnapshot',
        this.logger,
        { category },
        true, // Critical - track failures
      );

      if (saveResult) {
        this.logger.log(
          `Saved hourly price snapshot for category: ${category}`,
        );
        // Reset failure counter on success
        this.metricsService.resetSnapshotFailureCounter('price', category);
      } else {
        // Track failure
        this.metricsService.trackSnapshotFailure(
          'price',
          category,
          'Database write failed during snapshot save',
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to save price snapshot for ${category}: ${errorMessage}`,
      );
      // Track failure
      this.metricsService.trackSnapshotFailure('price', category, errorMessage);
      // Don't fail the request if snapshot saving fails
    }
  }

  /**
   * Find closest price snapshot to a specific timestamp
   * Searches for snapshots within ±6 hours of target time
   */
  async findClosestSnapshot(
    category: string,
    targetTimestamp: Date,
  ): Promise<PriceSnapshotDocument | null> {
    const searchWindowMs = SNAPSHOT.SEARCH_WINDOW_HOURS * 60 * 60 * 1000;
    const startWindow = new Date(targetTimestamp.getTime() - searchWindowMs);
    const endWindow = new Date(targetTimestamp.getTime() + searchWindowMs);

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
      'findClosestSnapshot',
      this.logger,
      { category, targetTimestamp },
    );
  }

  /**
   * Find snapshot for a specific date (start of day)
   */
  async findSnapshotForDate(
    category: string,
    targetDate: Date,
  ): Promise<PriceSnapshotDocument | null> {
    // Set to start of day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return safeDbRead(
      () =>
        this.priceSnapshotModel
          .findOne({
            category,
            timestamp: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          })
          .sort({ timestamp: -1 })
          .exec(),
      'findSnapshotForDate',
      this.logger,
      { category, targetDate },
    );
  }

  /**
   * Get latest snapshot for a category
   */
  async getLatestSnapshot(
    category: string,
  ): Promise<PriceSnapshotDocument | null> {
    return safeDbRead(
      () =>
        this.priceSnapshotModel
          .findOne({ category })
          .sort({ timestamp: -1 })
          .exec(),
      'getLatestSnapshot',
      this.logger,
      { category },
    );
  }

  /**
   * Get snapshots within a date range
   */
  async getSnapshotsInRange(
    category: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100,
  ): Promise<PriceSnapshotDocument[]> {
    const result = await safeDbRead(
      () =>
        this.priceSnapshotModel
          .find({
            category,
            timestamp: {
              $gte: startDate,
              $lte: endDate,
            },
          })
          .sort({ timestamp: -1 })
          .limit(limit)
          .exec(),
      'getSnapshotsInRange',
      this.logger,
      { category, startDate, endDate },
    );

    return result || [];
  }

  /**
   * Count snapshots for a category (for monitoring)
   */
  async countSnapshots(category: string): Promise<number> {
    try {
      return await this.priceSnapshotModel.countDocuments({ category }).exec();
    } catch (error) {
      this.logger.error(
        `Failed to count snapshots for ${category}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /**
   * Get oldest and newest snapshot timestamps (for monitoring)
   */
  async getSnapshotRange(
    category: string,
  ): Promise<{ oldest: Date | null; newest: Date | null }> {
    try {
      const [oldest, newest] = await Promise.all([
        this.priceSnapshotModel
          .findOne({ category })
          .sort({ timestamp: 1 })
          .select('timestamp')
          .exec(),
        this.priceSnapshotModel
          .findOne({ category })
          .sort({ timestamp: -1 })
          .select('timestamp')
          .exec(),
      ]);

      return {
        oldest: oldest?.timestamp || null,
        newest: newest?.timestamp || null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get snapshot range for ${category}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { oldest: null, newest: null };
    }
  }

  /**
   * Delete old snapshots beyond retention period
   * Note: This is typically handled by MongoDB TTL index,
   * but this method can be used for manual cleanup
   */
  async cleanupOldSnapshots(retentionDays: number = SNAPSHOT.RETENTION_DAYS): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.priceSnapshotModel.deleteMany({
        timestamp: { $lt: cutoffDate },
      }).exec();

      if (result.deletedCount > 0) {
        this.logger.log(
          `Cleaned up ${result.deletedCount} snapshots older than ${retentionDays} days`,
        );
      }

      return result.deletedCount;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old snapshots: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  // ==================== OHLC PERMANENT QUERIES ====================

  /**
   * Query daily OHLC data from ohlc_permanent collection
   */
  async queryDailyOhlc(
    itemCodes: string[],
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<AggregatedOhlcData[]> {
    const records = await safeDbRead(
      () =>
        this.ohlcPermanentModel
          .find({
            itemCode: { $in: itemCodes },
            timeframe: '1d',
            timestamp: { $gte: startOfDay, $lte: endOfDay },
          })
          .lean()
          .exec(),
      'queryDailyOhlc',
      this.logger,
      { itemCodes: itemCodes.length, startOfDay, endOfDay },
    );

    if (!records) return [];

    return records.map((r) => ({
      itemCode: r.itemCode,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      timestamp: r.timestamp,
    }));
  }

  /**
   * Aggregate minute data to daily OHLC
   * Used as fallback when no 1d data exists
   */
  async aggregateMinuteToDaily(
    itemCodes: string[],
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<AggregatedOhlcData[]> {
    try {
      const aggregation = await this.ohlcPermanentModel
        .aggregate([
          {
            $match: {
              itemCode: { $in: itemCodes },
              timeframe: '1m',
              timestamp: { $gte: startOfDay, $lte: endOfDay },
            },
          },
          { $sort: { timestamp: 1 } },
          {
            $group: {
              _id: '$itemCode',
              open: { $first: '$open' },
              high: { $max: '$high' },
              low: { $min: '$low' },
              close: { $last: '$close' },
              timestamp: { $first: '$timestamp' },
            },
          },
          {
            $project: {
              itemCode: '$_id',
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
    } catch (error) {
      this.logger.error(
        `Failed to aggregate minute data: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
