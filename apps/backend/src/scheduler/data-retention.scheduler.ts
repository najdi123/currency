import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron } from "@nestjs/schedule";
import { Model } from "mongoose";
import moment from "moment-timezone";
import {
  HistoricalOhlc,
  HistoricalOhlcDocument,
} from "../schemas/historical-ohlc.schema";
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from "../market-data/schemas/price-snapshot.schema";

/**
 * Data Retention Scheduler
 *
 * Manages data retention policies to prevent database growth:
 * - Delete historical_ohlc older than configured years (null = never delete)
 * - Delete price_snapshots older than 90 days
 */
@Injectable()
export class DataRetentionScheduler {
  private readonly logger = new Logger(DataRetentionScheduler.name);
  private readonly timezone = "Asia/Tehran";

  // Retention periods
  private readonly HISTORICAL_RETENTION_YEARS: number | null = null;
  private readonly SNAPSHOT_RETENTION_DAYS = 90;

  constructor(
    @InjectModel(HistoricalOhlc.name)
    private historicalModel: Model<HistoricalOhlcDocument>,
    @InjectModel(PriceSnapshot.name)
    private priceSnapshotModel: Model<PriceSnapshotDocument>,
  ) {}

  /**
   * Clean up old historical OHLC data
   * Runs daily at 03:00 Tehran time
   * Deletes records older than configured years (disabled if null)
   */
  @Cron("0 3 * * *", { timeZone: "Asia/Tehran" })
  async cleanupOldHistoricalOhlc(): Promise<void> {
    if (this.HISTORICAL_RETENTION_YEARS === null) {
      this.logger.debug("Historical OHLC cleanup disabled (retention = null)");
      return;
    }

    const startTime = Date.now();
    this.logger.log("🧹 Starting historical OHLC cleanup...");

    try {
      const cutoffDate = moment()
        .tz(this.timezone)
        .subtract(this.HISTORICAL_RETENTION_YEARS, "years")
        .toDate();

      this.logger.log(
        `📅 Deleting historical OHLC records older than ${cutoffDate.toISOString()}`,
      );

      const result = await this.historicalModel.deleteMany({
        periodStart: { $lt: cutoffDate },
      });

      const duration = Date.now() - startTime;

      if (result.deletedCount > 0) {
        this.logger.log(
          `✅ Deleted ${result.deletedCount} historical OHLC records (older than ${this.HISTORICAL_RETENTION_YEARS} years) in ${duration}ms`,
        );
      } else {
        this.logger.debug(
          `No historical OHLC records to delete (checked in ${duration}ms)`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Failed to cleanup historical OHLC: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Clean up old price snapshots
   * Runs daily at 04:00 Tehran time
   * Deletes snapshots older than 90 days
   */
  @Cron("0 4 * * *", { timeZone: "Asia/Tehran" })
  async cleanupOldPriceSnapshots(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("🧹 Starting price snapshot cleanup...");

    try {
      const cutoffDate = moment()
        .tz(this.timezone)
        .subtract(this.SNAPSHOT_RETENTION_DAYS, "days")
        .toDate();

      this.logger.log(
        `📅 Deleting price snapshots older than ${cutoffDate.toISOString()}`,
      );

      const result = await this.priceSnapshotModel.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      const duration = Date.now() - startTime;

      if (result.deletedCount > 0) {
        this.logger.log(
          `✅ Deleted ${result.deletedCount} price snapshots (older than ${this.SNAPSHOT_RETENTION_DAYS} days) in ${duration}ms`,
        );
      } else {
        this.logger.debug(
          `No price snapshots to delete (checked in ${duration}ms)`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Failed to cleanup price snapshots: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Get retention statistics (useful for monitoring)
   */
  async getRetentionStats(): Promise<{
    historicalOhlc: {
      total: number;
      oldestRecord: Date | null;
      newestRecord: Date | null;
      willBeDeleted: number;
    };
    priceSnapshots: {
      total: number;
      oldestRecord: Date | null;
      newestRecord: Date | null;
      willBeDeleted: number;
    };
  }> {
    try {
      const historicalCutoff = this.HISTORICAL_RETENTION_YEARS
        ? moment()
            .tz(this.timezone)
            .subtract(this.HISTORICAL_RETENTION_YEARS, "years")
            .toDate()
        : new Date(0); // No cutoff if null

      const snapshotCutoff = moment()
        .tz(this.timezone)
        .subtract(this.SNAPSHOT_RETENTION_DAYS, "days")
        .toDate();

      const [
        historicalTotal,
        historicalOldest,
        historicalNewest,
        historicalToDelete,
        priceSnapshotTotal,
        priceSnapshotOldest,
        priceSnapshotNewest,
        priceSnapshotToDelete,
      ] = await Promise.all([
        // Historical OHLC
        this.historicalModel.countDocuments(),
        this.historicalModel
          .findOne()
          .sort({ periodStart: 1 })
          .select("periodStart")
          .lean(),
        this.historicalModel
          .findOne()
          .sort({ periodStart: -1 })
          .select("periodStart")
          .lean(),
        this.HISTORICAL_RETENTION_YEARS
          ? this.historicalModel.countDocuments({
              periodStart: { $lt: historicalCutoff },
            })
          : 0,
        // Price Snapshots
        this.priceSnapshotModel.countDocuments(),
        this.priceSnapshotModel
          .findOne()
          .sort({ timestamp: 1 })
          .select("timestamp")
          .lean(),
        this.priceSnapshotModel
          .findOne()
          .sort({ timestamp: -1 })
          .select("timestamp")
          .lean(),
        this.priceSnapshotModel.countDocuments({
          timestamp: { $lt: snapshotCutoff },
        }),
      ]);

      return {
        historicalOhlc: {
          total: historicalTotal,
          oldestRecord: historicalOldest?.periodStart || null,
          newestRecord: historicalNewest?.periodStart || null,
          willBeDeleted: historicalToDelete,
        },
        priceSnapshots: {
          total: priceSnapshotTotal,
          oldestRecord: priceSnapshotOldest?.timestamp || null,
          newestRecord: priceSnapshotNewest?.timestamp || null,
          willBeDeleted: priceSnapshotToDelete,
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get retention stats: ${err.message}`,
        err.stack,
      );
      return {
        historicalOhlc: {
          total: 0,
          oldestRecord: null,
          newestRecord: null,
          willBeDeleted: 0,
        },
        priceSnapshots: {
          total: 0,
          oldestRecord: null,
          newestRecord: null,
          willBeDeleted: 0,
        },
      };
    }
  }

  /**
   * Manual cleanup trigger (useful for testing or manual operations)
   */
  async manualCleanupAll(): Promise<{
    historicalDeleted: number;
    priceSnapshotsDeleted: number;
  }> {
    this.logger.log("Manual cleanup triggered for all data types");

    const results = {
      historicalDeleted: 0,
      priceSnapshotsDeleted: 0,
    };

    try {
      await this.cleanupOldHistoricalOhlc();
      await this.cleanupOldPriceSnapshots();

      // Get actual counts after cleanup
      const stats = await this.getRetentionStats();
      this.logger.log("✅ Manual cleanup complete");
      this.logger.log(
        `Historical OHLC: ${stats.historicalOhlc.total} records remain`,
      );
      this.logger.log(
        `Price Snapshots: ${stats.priceSnapshots.total} records remain`,
      );

      return results;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Manual cleanup failed: ${err.message}`, err.stack);
      throw error;
    }
  }
}
