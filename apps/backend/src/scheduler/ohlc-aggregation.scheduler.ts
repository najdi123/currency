import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron } from "@nestjs/schedule";
import { Model } from "mongoose";
import moment from "moment-timezone";
import {
  OHLCPermanent,
  OHLCPermanentDocument,
} from "../market-data/schemas/ohlc-permanent.schema";
import {
  HistoricalOhlc,
  HistoricalOhlcDocument,
  OhlcTimeframe,
} from "../schemas/historical-ohlc.schema";

/**
 * OHLC Aggregation Scheduler
 *
 * NOTE: This scheduler is now DEPRECATED for daily aggregation.
 * The ohlc_permanent collection is the single source of truth and already
 * contains 1d (daily) timeframe data.
 *
 * This scheduler now only handles:
 * - Weekly: Aggregates daily data from ohlc_permanent to historical_ohlc
 * - Monthly: Aggregates daily data from ohlc_permanent to historical_ohlc
 *
 * The daily cron job is disabled since ohlc_permanent already has 1d data.
 */
@Injectable()
export class OhlcAggregationScheduler {
  private readonly logger = new Logger(OhlcAggregationScheduler.name);
  private readonly timezone = "Asia/Tehran";

  constructor(
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
    @InjectModel(HistoricalOhlc.name)
    private historicalModel: Model<HistoricalOhlcDocument>,
  ) {}

  /**
   * Daily aggregation is DISABLED
   *
   * ohlc_permanent already stores 1d timeframe data directly.
   * Use ohlc_permanent with timeframe='1d' instead of historical_ohlc for daily data.
   *
   * This method is kept for reference but the cron is disabled.
   */
  // @Cron("5 0 * * *", { timeZone: "Asia/Tehran" }) // DISABLED
  async aggregateDailyOhlc(): Promise<void> {
    this.logger.log(
      "⏭️ Daily aggregation skipped - ohlc_permanent already has 1d data",
    );
    // No-op: ohlc_permanent is the source of truth for daily data
  }

  /**
   * Daily data health check
   * Runs daily at 06:00 Tehran time to check for data gaps
   * Logs warnings if expected data is missing
   */
  @Cron("0 6 * * *", { timeZone: "Asia/Tehran" })
  async checkDataHealth(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("🏥 Starting daily data health check...");

    try {
      const yesterday = moment()
        .tz(this.timezone)
        .subtract(1, "day")
        .startOf("day");

      const today = moment().tz(this.timezone).startOf("day");

      // Check ohlc_permanent for yesterday's 1d data
      const yesterdayData = await this.ohlcPermanentModel
        .find({
          timeframe: "1d",
          timestamp: {
            $gte: yesterday.toDate(),
            $lt: today.toDate(),
          },
        })
        .lean();

      // Expected items to have data
      const expectedItems = [
        "USD_SELL",
        "EUR",
        "GBP",
        "BTC",
        "ETH",
        "USDT",
        "SEKKEH",
      ];

      const foundItems = new Set(yesterdayData.map((d) => d.itemCode));
      const missingItems = expectedItems.filter(
        (item) => !foundItems.has(item),
      );

      if (missingItems.length > 0) {
        this.logger.warn(
          `⚠️ DATA GAP DETECTED: Missing 1d data for ${missingItems.length} items: ${missingItems.join(", ")}`,
        );
        this.logger.warn(
          `📅 Date: ${yesterday.format("YYYY-MM-DD")} | Found: ${foundItems.size} | Expected: ${expectedItems.length}`,
        );
      } else {
        this.logger.log(
          `✅ Data health check passed: ${foundItems.size} items with 1d data for ${yesterday.format("YYYY-MM-DD")}`,
        );
      }

      // Check for any item with no data in the last 24 hours
      const last24h = moment().tz(this.timezone).subtract(24, "hours");
      const recentData = await this.ohlcPermanentModel
        .find({
          timeframe: "1m",
          timestamp: { $gte: last24h.toDate() },
        })
        .distinct("itemCode");

      if (recentData.length === 0) {
        this.logger.error(
          "❌ CRITICAL: No 1m data recorded in the last 24 hours!",
        );
      } else {
        this.logger.log(
          `📊 Recent data: ${recentData.length} items with 1m data in last 24h`,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(`🏥 Health check completed in ${duration}ms`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Health check failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Aggregate last week's daily OHLC to weekly historical OHLC
   * Runs every Sunday at 00:10 Tehran time
   *
   * Sources data from ohlc_permanent (1d timeframe) instead of historical_ohlc
   */
  @Cron("10 0 * * 0", { timeZone: "Asia/Tehran" })
  async aggregateWeeklyOhlc(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("🔄 Starting weekly OHLC aggregation from ohlc_permanent...");

    try {
      // Calculate last week's boundaries (Saturday to Friday in Persian calendar)
      const lastWeek = moment().tz(this.timezone).subtract(1, "week");
      const weekStart = lastWeek.clone().startOf("week"); // Saturday
      const weekEnd = lastWeek.clone().endOf("week"); // Friday

      this.logger.log(
        `📅 Aggregating week: ${weekStart.format("YYYY-MM-DD")} to ${weekEnd.format("YYYY-MM-DD")}`,
      );

      // Check if weekly aggregation already exists
      const existingWeekly = await this.historicalModel.findOne({
        timeframe: OhlcTimeframe.WEEKLY,
        periodStart: {
          $gte: weekStart.toDate(),
          $lt: weekStart.clone().add(1, "day").toDate(),
        },
      });

      if (existingWeekly) {
        this.logger.log(`✅ Weekly aggregation already complete for this week`);
        return;
      }

      // Get all daily data from ohlc_permanent for last week
      const dailyData = await this.ohlcPermanentModel
        .find({
          timeframe: "1d",
          timestamp: {
            $gte: weekStart.toDate(),
            $lte: weekEnd.toDate(),
          },
        })
        .lean();

      if (dailyData.length === 0) {
        this.logger.warn(`⚠️ No daily data found in ohlc_permanent for last week`);
        return;
      }

      this.logger.log(
        `📊 Found ${dailyData.length} daily records to aggregate`,
      );

      // Group by itemCode
      const grouped = dailyData.reduce(
        (acc, item) => {
          if (!acc[item.itemCode]) {
            acc[item.itemCode] = [];
          }
          acc[item.itemCode].push(item);
          return acc;
        },
        {} as Record<string, typeof dailyData>,
      );

      // Create weekly entries
      const weeklyEntries = Object.entries(grouped).map(([itemCode, items]) => {
        // Sort by timestamp to ensure correct order
        items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        return {
          itemCode: itemCode.toLowerCase(), // Normalize to lowercase for historical_ohlc
          timeframe: OhlcTimeframe.WEEKLY,
          periodStart: weekStart.toDate(),
          periodEnd: weekEnd.clone().add(1, "day").toDate(),
          open: items[0].open,
          high: Math.max(...items.map((i) => i.high)),
          low: Math.min(...items.map((i) => i.low)),
          close: items[items.length - 1].close,
          dataPoints: items.length,
        };
      });

      if (weeklyEntries.length === 0) {
        this.logger.warn(`⚠️ No items to aggregate for weekly`);
        return;
      }

      // Insert weekly entries
      await this.historicalModel.insertMany(weeklyEntries, { ordered: false });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Weekly aggregation complete: ${weeklyEntries.length} items aggregated in ${duration}ms`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Failed to aggregate weekly OHLC: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Aggregate last month's daily OHLC to monthly historical OHLC
   * Runs on 1st of every month at 00:15 Tehran time
   *
   * Sources data from ohlc_permanent (1d timeframe) instead of historical_ohlc
   */
  @Cron("15 0 1 * *", { timeZone: "Asia/Tehran" })
  async aggregateMonthlyOhlc(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("🔄 Starting monthly OHLC aggregation from ohlc_permanent...");

    try {
      // Calculate last month's boundaries
      const lastMonth = moment().tz(this.timezone).subtract(1, "month");
      const monthStart = lastMonth.clone().startOf("month");
      const monthEnd = lastMonth.clone().endOf("month");

      this.logger.log(
        `📅 Aggregating month: ${monthStart.format("YYYY-MM-DD")} to ${monthEnd.format("YYYY-MM-DD")}`,
      );

      // Check if monthly aggregation already exists
      const existingMonthly = await this.historicalModel.findOne({
        timeframe: OhlcTimeframe.MONTHLY,
        periodStart: {
          $gte: monthStart.toDate(),
          $lt: monthStart.clone().add(1, "day").toDate(),
        },
      });

      if (existingMonthly) {
        this.logger.log(
          `✅ Monthly aggregation already complete for this month`,
        );
        return;
      }

      // Get all daily data from ohlc_permanent for last month
      const dailyData = await this.ohlcPermanentModel
        .find({
          timeframe: "1d",
          timestamp: {
            $gte: monthStart.toDate(),
            $lte: monthEnd.toDate(),
          },
        })
        .lean();

      if (dailyData.length === 0) {
        this.logger.warn(`⚠️ No daily data found in ohlc_permanent for last month`);
        return;
      }

      this.logger.log(
        `📊 Found ${dailyData.length} daily records to aggregate`,
      );

      // Group by itemCode
      const grouped = dailyData.reduce(
        (acc, item) => {
          if (!acc[item.itemCode]) {
            acc[item.itemCode] = [];
          }
          acc[item.itemCode].push(item);
          return acc;
        },
        {} as Record<string, typeof dailyData>,
      );

      // Create monthly entries
      const monthlyEntries = Object.entries(grouped).map(
        ([itemCode, items]) => {
          // Sort by timestamp to ensure correct order
          items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

          return {
            itemCode: itemCode.toLowerCase(), // Normalize to lowercase for historical_ohlc
            timeframe: OhlcTimeframe.MONTHLY,
            periodStart: monthStart.toDate(),
            periodEnd: monthEnd.clone().add(1, "day").toDate(),
            open: items[0].open,
            high: Math.max(...items.map((i) => i.high)),
            low: Math.min(...items.map((i) => i.low)),
            close: items[items.length - 1].close,
            dataPoints: items.length,
          };
        },
      );

      if (monthlyEntries.length === 0) {
        this.logger.warn(`⚠️ No items to aggregate for monthly`);
        return;
      }

      // Insert monthly entries
      await this.historicalModel.insertMany(monthlyEntries, { ordered: false });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Monthly aggregation complete: ${monthlyEntries.length} items aggregated in ${duration}ms`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Failed to aggregate monthly OHLC: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Manual trigger for weekly aggregation (useful for backfilling)
   */
  async manualAggregateWeeklyForDate(date: Date): Promise<void> {
    this.logger.log(
      `🔧 Manual weekly aggregation triggered for week containing ${date.toISOString()}`,
    );

    const weekStart = moment(date).tz(this.timezone).startOf("week");
    const weekEnd = moment(date).tz(this.timezone).endOf("week");

    const dailyData = await this.ohlcPermanentModel
      .find({
        timeframe: "1d",
        timestamp: {
          $gte: weekStart.toDate(),
          $lte: weekEnd.toDate(),
        },
      })
      .lean();

    if (dailyData.length === 0) {
      this.logger.warn(`⚠️ No daily data found for week`);
      return;
    }

    // Group by itemCode
    const grouped = dailyData.reduce(
      (acc, item) => {
        if (!acc[item.itemCode]) {
          acc[item.itemCode] = [];
        }
        acc[item.itemCode].push(item);
        return acc;
      },
      {} as Record<string, typeof dailyData>,
    );

    const weeklyEntries = Object.entries(grouped).map(([itemCode, items]) => {
      items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      return {
        itemCode: itemCode.toLowerCase(),
        timeframe: OhlcTimeframe.WEEKLY,
        periodStart: weekStart.toDate(),
        periodEnd: weekEnd.clone().add(1, "day").toDate(),
        open: items[0].open,
        high: Math.max(...items.map((i) => i.high)),
        low: Math.min(...items.map((i) => i.low)),
        close: items[items.length - 1].close,
        dataPoints: items.length,
      };
    });

    await this.historicalModel.insertMany(weeklyEntries, { ordered: false });

    this.logger.log(
      `✅ Manual weekly aggregation complete: ${weeklyEntries.length} items`,
    );
  }
}
