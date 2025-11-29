import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron } from "@nestjs/schedule";
import { Model } from "mongoose";
import moment from "moment-timezone";
import {
  OHLCPermanent,
  OHLCPermanentDocument,
} from "../market-data/schemas/ohlc-permanent.schema";
import { ConfigService } from "@nestjs/config";

/**
 * OHLC Permanent Data Cleanup Scheduler
 *
 * Manages retention policies for ohlc_permanent collection to prevent
 * unlimited database growth and high RAM usage.
 *
 * Retention policies by timeframe:
 * - 1m (1-minute): Keep for 7 days - most granular, highest volume
 * - 5m (5-minute): Keep for 30 days
 * - 15m (15-minute): Keep for 60 days
 * - 1h (1-hour): Keep for 180 days (6 months)
 * - 4h (4-hour): Keep for 365 days (1 year)
 * - 1d (1-day): Keep forever - essential for historical analysis
 *
 * Runs daily at 01:00 Tehran time (before other schedulers)
 */
@Injectable()
export class OhlcPermanentCleanupScheduler {
  private readonly logger = new Logger(OhlcPermanentCleanupScheduler.name);
  private readonly timezone = "Asia/Tehran";
  private readonly isEnabled: boolean;

  // Retention periods in days (null = keep forever)
  private readonly retentionPolicies: Record<string, number | null> = {
    "1m": 7, // 1-minute data: 7 days
    "5m": 30, // 5-minute data: 30 days
    "15m": 60, // 15-minute data: 60 days
    "1h": 180, // 1-hour data: 6 months
    "4h": 365, // 4-hour data: 1 year
    "1d": null, // 1-day data: keep forever
  };

  constructor(
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
    private configService: ConfigService,
  ) {
    this.isEnabled =
      this.configService.get<string>("OHLC_PERMANENT_CLEANUP_ENABLED", "true") ===
      "true";

    if (!this.isEnabled) {
      this.logger.warn(
        "⚠️ OHLC permanent cleanup scheduler is DISABLED via config",
      );
    } else {
      this.logger.log(
        "✅ OHLC permanent cleanup scheduler is ENABLED - runs daily at 01:00 Tehran time",
      );
      this.logRetentionPolicies();
    }
  }

  private logRetentionPolicies(): void {
    this.logger.log("📋 Retention policies:");
    for (const [timeframe, days] of Object.entries(this.retentionPolicies)) {
      if (days === null) {
        this.logger.log(`   ${timeframe}: Keep forever`);
      } else {
        this.logger.log(`   ${timeframe}: ${days} days`);
      }
    }
  }

  /**
   * Main cleanup job - runs daily at 01:00 Tehran time
   */
  @Cron("0 1 * * *", { timeZone: "Asia/Tehran" })
  async cleanupOldOhlcPermanent(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    const startTime = Date.now();
    this.logger.log("🧹 Starting ohlc_permanent cleanup...");

    try {
      let totalDeleted = 0;
      const results: Record<string, number> = {};

      for (const [timeframe, retentionDays] of Object.entries(
        this.retentionPolicies,
      )) {
        // Skip timeframes that should be kept forever
        if (retentionDays === null) {
          this.logger.log(`⏭️ Skipping ${timeframe} (keep forever)`);
          results[timeframe] = 0;
          continue;
        }

        try {
          const deletedCount = await this.cleanupTimeframe(
            timeframe,
            retentionDays,
          );
          totalDeleted += deletedCount;
          results[timeframe] = deletedCount;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `❌ Failed to cleanup ${timeframe} data: ${errorMessage}`,
          );
          results[timeframe] = -1; // Indicate error
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ ohlc_permanent cleanup completed in ${duration}ms. Total deleted: ${totalDeleted} records`,
      );

      // Log summary
      this.logger.log("📊 Cleanup summary by timeframe:");
      for (const [tf, count] of Object.entries(results)) {
        if (count === -1) {
          this.logger.log(`   ${tf}: ERROR`);
        } else if (count === 0) {
          this.logger.log(`   ${tf}: No old records to delete`);
        } else {
          this.logger.log(`   ${tf}: Deleted ${count} records`);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ ohlc_permanent cleanup failed: ${errorMessage}`);
    }
  }

  /**
   * Clean up old records for a specific timeframe
   */
  private async cleanupTimeframe(
    timeframe: string,
    retentionDays: number,
  ): Promise<number> {
    const cutoffDate = moment()
      .tz(this.timezone)
      .subtract(retentionDays, "days")
      .startOf("day")
      .toDate();

    this.logger.log(
      `🗑️ Deleting ${timeframe} records older than ${moment(cutoffDate).format("YYYY-MM-DD")} (${retentionDays} days retention)`,
    );

    const result = await this.ohlcPermanentModel.deleteMany({
      timeframe,
      timestamp: { $lt: cutoffDate },
    });

    const deletedCount = result.deletedCount || 0;

    if (deletedCount > 0) {
      this.logger.log(`   ✓ Deleted ${deletedCount} ${timeframe} records`);
    }

    return deletedCount;
  }

  /**
   * Get statistics about ohlc_permanent collection
   */
  async getStats(): Promise<{
    total: number;
    byTimeframe: Record<string, { count: number; oldestDate: string | null }>;
    estimatedSizeBytes: number;
  }> {
    try {
      const total = await this.ohlcPermanentModel.countDocuments();

      const byTimeframe: Record<
        string,
        { count: number; oldestDate: string | null }
      > = {};

      for (const timeframe of Object.keys(this.retentionPolicies)) {
        const count = await this.ohlcPermanentModel.countDocuments({
          timeframe,
        });

        const oldest = await this.ohlcPermanentModel
          .findOne({ timeframe })
          .sort({ timestamp: 1 })
          .select("timestamp")
          .lean();

        byTimeframe[timeframe] = {
          count,
          oldestDate: oldest
            ? moment(oldest.timestamp).format("YYYY-MM-DD HH:mm")
            : null,
        };
      }

      // Estimate size (rough estimate: ~200 bytes per document)
      const estimatedSizeBytes = total * 200;

      return {
        total,
        byTimeframe,
        estimatedSizeBytes,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get stats: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get records that would be deleted (dry run)
   */
  async getDeletionPreview(): Promise<Record<string, number>> {
    const preview: Record<string, number> = {};

    for (const [timeframe, retentionDays] of Object.entries(
      this.retentionPolicies,
    )) {
      if (retentionDays === null) {
        preview[timeframe] = 0;
        continue;
      }

      const cutoffDate = moment()
        .tz(this.timezone)
        .subtract(retentionDays, "days")
        .startOf("day")
        .toDate();

      const count = await this.ohlcPermanentModel.countDocuments({
        timeframe,
        timestamp: { $lt: cutoffDate },
      });

      preview[timeframe] = count;
    }

    return preview;
  }

  /**
   * Manual cleanup trigger with optional dry-run
   */
  async triggerManualCleanup(dryRun = false): Promise<{
    success: boolean;
    deletedCount: number;
    byTimeframe: Record<string, number>;
    message: string;
  }> {
    this.logger.log(
      `🔧 Manual ohlc_permanent cleanup triggered (dryRun: ${dryRun})`,
    );

    try {
      if (dryRun) {
        const preview = await this.getDeletionPreview();
        const totalToDelete = Object.values(preview).reduce((a, b) => a + b, 0);

        return {
          success: true,
          deletedCount: 0,
          byTimeframe: preview,
          message: `Dry run: Would delete ${totalToDelete} records`,
        };
      }

      // Actual cleanup
      const startTime = Date.now();
      let totalDeleted = 0;
      const byTimeframe: Record<string, number> = {};

      for (const [timeframe, retentionDays] of Object.entries(
        this.retentionPolicies,
      )) {
        if (retentionDays === null) {
          byTimeframe[timeframe] = 0;
          continue;
        }

        const deleted = await this.cleanupTimeframe(timeframe, retentionDays);
        totalDeleted += deleted;
        byTimeframe[timeframe] = deleted;
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        deletedCount: totalDeleted,
        byTimeframe,
        message: `Cleanup completed in ${duration}ms. Deleted ${totalDeleted} records.`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        deletedCount: 0,
        byTimeframe: {},
        message: `Cleanup failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Emergency cleanup - delete records older than specified days for ALL timeframes
   * Use with caution!
   */
  async emergencyCleanup(olderThanDays: number): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> {
    this.logger.warn(
      `🚨 EMERGENCY cleanup triggered: deleting ALL records older than ${olderThanDays} days`,
    );

    try {
      const cutoffDate = moment()
        .tz(this.timezone)
        .subtract(olderThanDays, "days")
        .toDate();

      const result = await this.ohlcPermanentModel.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      const deletedCount = result.deletedCount || 0;

      this.logger.warn(`🚨 Emergency cleanup deleted ${deletedCount} records`);

      return {
        success: true,
        deletedCount,
        message: `Emergency cleanup completed. Deleted ${deletedCount} records older than ${olderThanDays} days.`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Emergency cleanup failed: ${errorMessage}`);
      return {
        success: false,
        deletedCount: 0,
        message: `Emergency cleanup failed: ${errorMessage}`,
      };
    }
  }
}
