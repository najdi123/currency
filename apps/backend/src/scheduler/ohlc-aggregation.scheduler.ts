import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Model } from "mongoose";
import moment from "moment-timezone";
import {
  IntradayOhlc,
  IntradayOhlcDocument,
} from "../schemas/intraday-ohlc.schema";
import {
  HistoricalOhlc,
  HistoricalOhlcDocument,
  OhlcTimeframe,
} from "../schemas/historical-ohlc.schema";

/**
 * OHLC Aggregation Scheduler
 *
 * Aggregates intraday OHLC data into historical timeframes:
 * - Daily: At 00:05 Tehran time - aggregates yesterday's intraday data
 * - Weekly: At 00:10 on Sundays - aggregates last week's daily data
 * - Monthly: At 00:15 on 1st of month - aggregates last month's daily data
 */
@Injectable()
export class OhlcAggregationScheduler {
  private readonly logger = new Logger(OhlcAggregationScheduler.name);
  private readonly timezone = "Asia/Tehran";

  constructor(
    @InjectModel(IntradayOhlc.name)
    private intradayModel: Model<IntradayOhlcDocument>,
    @InjectModel(HistoricalOhlc.name)
    private historicalModel: Model<HistoricalOhlcDocument>,
  ) {}

  /**
   * Aggregate yesterday's intraday OHLC to daily historical OHLC
   * Runs daily at 00:05 Tehran time
   */
  @Cron("5 0 * * *", { timeZone: "Asia/Tehran" })
  async aggregateDailyOhlc(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("🔄 Starting daily OHLC aggregation...");

    try {
      // Calculate yesterday's date in Tehran timezone
      const yesterday = moment()
        .tz(this.timezone)
        .subtract(1, "day")
        .startOf("day");

      const yesterdayKey = yesterday.format("YYYY-MM-DD");

      this.logger.log(`📅 Aggregating data for ${yesterdayKey}`);

      // Get all intraday OHLC from yesterday
      const intradayData = await this.intradayModel
        .find({
          date: yesterdayKey,
        })
        .lean();

      if (intradayData.length === 0) {
        this.logger.warn(`⚠️ No intraday data found for ${yesterdayKey}`);
        return;
      }

      this.logger.log(
        `📊 Found ${intradayData.length} intraday records to aggregate`,
      );

      // Check for existing daily records to avoid duplicates
      const existingCodes = await this.historicalModel
        .find({
          timeframe: OhlcTimeframe.DAILY,
          periodStart: {
            $gte: yesterday.toDate(),
            $lt: yesterday.clone().add(1, "day").toDate(),
          },
        })
        .distinct("itemCode");

      const existingCodesSet = new Set(existingCodes);

      // Filter out items that already have daily records
      const newItems = intradayData.filter(
        (item) => !existingCodesSet.has(item.itemCode),
      );

      if (newItems.length === 0) {
        this.logger.log(
          `✅ Daily aggregation already complete for ${yesterdayKey}`,
        );
        return;
      }

      // Create historical_ohlc entries for each item
      const historicalEntries = newItems.map((item) => ({
        itemCode: item.itemCode,
        timeframe: OhlcTimeframe.DAILY,
        periodStart: yesterday.toDate(),
        periodEnd: yesterday.clone().add(1, "day").toDate(),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        dataPoints: item.updateCount,
      }));

      // Insert all entries at once
      await this.historicalModel.insertMany(historicalEntries, {
        ordered: false,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Daily aggregation complete: ${historicalEntries.length} items aggregated in ${duration}ms`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `❌ Failed to aggregate daily OHLC: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Aggregate last week's daily OHLC to weekly historical OHLC
   * Runs every Sunday at 00:10 Tehran time
   */
  @Cron("10 0 * * 0", { timeZone: "Asia/Tehran" })
  async aggregateWeeklyOhlc(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("🔄 Starting weekly OHLC aggregation...");

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

      // Get all daily data from last week
      const dailyData = await this.historicalModel
        .find({
          timeframe: OhlcTimeframe.DAILY,
          periodStart: {
            $gte: weekStart.toDate(),
            $lte: weekEnd.toDate(),
          },
        })
        .lean();

      if (dailyData.length === 0) {
        this.logger.warn(`⚠️ No daily data found for last week`);
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
        // Sort by date to ensure correct order
        items.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

        return {
          itemCode,
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
   */
  @Cron("15 0 1 * *", { timeZone: "Asia/Tehran" })
  async aggregateMonthlyOhlc(): Promise<void> {
    const startTime = Date.now();
    this.logger.log("🔄 Starting monthly OHLC aggregation...");

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

      // Get all daily data from last month
      const dailyData = await this.historicalModel
        .find({
          timeframe: OhlcTimeframe.DAILY,
          periodStart: {
            $gte: monthStart.toDate(),
            $lte: monthEnd.toDate(),
          },
        })
        .lean();

      if (dailyData.length === 0) {
        this.logger.warn(`⚠️ No daily data found for last month`);
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
          // Sort by date to ensure correct order
          items.sort(
            (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
          );

          return {
            itemCode,
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
   * Manual trigger for aggregation (useful for testing or backfilling)
   */
  async manualAggregateDailyForDate(date: Date): Promise<void> {
    this.logger.log(
      `🔧 Manual daily aggregation triggered for ${date.toISOString()}`,
    );

    const dateKey = moment(date).tz(this.timezone).format("YYYY-MM-DD");

    const intradayData = await this.intradayModel
      .find({
        date: dateKey,
      })
      .lean();

    if (intradayData.length === 0) {
      this.logger.warn(`⚠️ No intraday data found for ${dateKey}`);
      return;
    }

    const historicalEntries = intradayData.map((item) => ({
      itemCode: item.itemCode,
      timeframe: OhlcTimeframe.DAILY,
      periodStart: moment(date).tz(this.timezone).startOf("day").toDate(),
      periodEnd: moment(date)
        .tz(this.timezone)
        .add(1, "day")
        .startOf("day")
        .toDate(),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      dataPoints: item.updateCount,
    }));

    await this.historicalModel.insertMany(historicalEntries, {
      ordered: false,
    });

    this.logger.log(
      `✅ Manual aggregation complete: ${historicalEntries.length} items`,
    );
  }
}
