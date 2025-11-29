import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  OhlcSnapshot,
  OhlcSnapshotDocument,
} from "../market-data/schemas/ohlc-snapshot.schema";
import { ConfigService } from "@nestjs/config";

/**
 * OHLC Cleanup Scheduler Service
 *
 * Automatically cleans up old OHLC snapshots based on retention policies:
 * - 1d charts: Keep for 7 days
 * - 1w charts: Keep for 90 days
 * - 1m charts: Keep for 365 days
 * - 3m charts: Keep forever (no deletion)
 * - 1y/all charts: Keep forever (no deletion)
 *
 * Runs daily at 2:00 AM UTC
 */
@Injectable()
export class OhlcCleanupSchedulerService {
  private readonly logger = new Logger(OhlcCleanupSchedulerService.name);
  private readonly isEnabled: boolean;

  // Retention periods in days
  private readonly retentionPolicies = {
    "1d": 7, // 1-day charts: 7 days retention
    "1w": 90, // 1-week charts: 90 days retention
    "1m": 365, // 1-month charts: 1 year retention
    "3m": null, // 3-month charts: keep forever
    "1y": null, // 1-year charts: keep forever
    all: null, // All-time charts: keep forever
  };

  constructor(
    @InjectModel(OhlcSnapshot.name)
    private ohlcSnapshotModel: Model<OhlcSnapshotDocument>,
    private configService: ConfigService,
  ) {
    this.isEnabled =
      this.configService.get<string>("OHLC_CLEANUP_ENABLED", "true") === "true";

    if (!this.isEnabled) {
      this.logger.warn("⚠️  OHLC cleanup scheduler is DISABLED");
    } else {
      this.logger.log(
        "✅ OHLC cleanup scheduler is ENABLED - runs daily at 2:00 AM UTC",
      );
    }
  }

  /**
   * Run cleanup daily at 2:00 AM UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: "ohlc-cleanup",
    timeZone: "UTC",
  })
  async cleanupOldOhlcSnapshots() {
    if (!this.isEnabled) {
      return;
    }

    this.logger.log("🧹 Starting OHLC snapshot cleanup...");
    const startTime = Date.now();

    try {
      let totalDeleted = 0;

      for (const [timeRange, retentionDays] of Object.entries(
        this.retentionPolicies,
      )) {
        // Skip time ranges that should be kept forever
        if (retentionDays === null) {
          this.logger.log(`⏭️  Skipping ${timeRange} charts (keep forever)`);
          continue;
        }

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        try {
          const result = await this.ohlcSnapshotModel.deleteMany({
            timeRange,
            timestamp: { $lt: cutoffDate },
          });

          const deletedCount = result.deletedCount || 0;
          totalDeleted += deletedCount;

          if (deletedCount > 0) {
            this.logger.log(
              `🗑️  Deleted ${deletedCount} old ${timeRange} OHLC snapshots (older than ${retentionDays} days)`,
            );
          } else {
            this.logger.log(
              `✅ No old ${timeRange} OHLC snapshots to clean up`,
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `❌ Failed to clean up ${timeRange} OHLC snapshots: ${errorMessage}`,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ OHLC cleanup completed in ${duration}ms. Total deleted: ${totalDeleted} snapshots`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ OHLC cleanup failed: ${errorMessage}`);
    }
  }

  /**
   * Manual trigger for cleanup (for testing or emergency cleanup)
   */
  async triggerManualCleanup(): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> {
    this.logger.log("🔧 Manual OHLC cleanup triggered");

    try {
      await this.cleanupOldOhlcSnapshots();
      return {
        success: true,
        deletedCount: 0, // We don't track the exact count in manual trigger
        message: "OHLC cleanup completed successfully",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        deletedCount: 0,
        message: `OHLC cleanup failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get statistics about OHLC snapshots
   */
  async getOhlcStats(): Promise<{
    total: number;
    byTimeRange: Record<string, number>;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
  }> {
    try {
      const total = await this.ohlcSnapshotModel.countDocuments();

      // Count by time range
      const byTimeRange: Record<string, number> = {};
      for (const timeRange of Object.keys(this.retentionPolicies)) {
        const count = await this.ohlcSnapshotModel.countDocuments({
          timeRange,
        });
        byTimeRange[timeRange] = count;
      }

      // Get oldest and newest snapshots
      const oldest = await this.ohlcSnapshotModel
        .findOne()
        .sort({ timestamp: 1 })
        .select("timestamp")
        .exec();

      const newest = await this.ohlcSnapshotModel
        .findOne()
        .sort({ timestamp: -1 })
        .select("timestamp")
        .exec();

      return {
        total,
        byTimeRange,
        oldestSnapshot: oldest?.timestamp || null,
        newestSnapshot: newest?.timestamp || null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get OHLC stats: ${errorMessage}`);
      throw error;
    }
  }
}
