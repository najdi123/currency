import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import moment from "moment-timezone";
import momentJalaali from "moment-jalaali";
import {
  OHLCPermanent,
  OHLCPermanentDocument,
} from "../schemas/ohlc-permanent.schema";
import {
  CurrencyData,
  CryptoData,
  GoldData,
} from "../../api-providers/api-provider.interface";

/**
 * Data point for intraday chart
 */
interface DataPoint {
  time: string;
  price: number;
}

/**
 * Response type for OHLC data with change percentage
 */
interface OhlcResponse {
  itemCode: string;
  date: string;
  dateJalali?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number; // Percentage change from open to close
  dataPoints: DataPoint[];
  updateCount?: number;
  firstUpdate?: Date;
  lastUpdate?: Date;
}

/**
 * Intraday OHLC Service
 *
 * Provides OHLC data from ohlc_permanent collection.
 * Used for daily change calculations and mini-charts.
 *
 * NOTE: All data is now read from ohlc_permanent collection which is
 * the single source of truth for all OHLC data.
 */
@Injectable()
export class IntradayOhlcService {
  private readonly logger = new Logger(IntradayOhlcService.name);
  private readonly timezone = "Asia/Tehran";

  constructor(
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
  ) {}

  /**
   * Record data points from API fetch
   *
   * NOTE: This method is now a no-op. The ohlc_permanent collection is
   * populated by the OhlcCollectorService which runs in parallel.
   * This method is kept for backwards compatibility but does not
   * write to any collection.
   *
   * @deprecated Data is now recorded directly to ohlc_permanent by OhlcCollectorService
   */
  async recordDataPoints(_data: {
    currencies: CurrencyData[];
    crypto: CryptoData[];
    gold: GoldData[];
  }): Promise<void> {
    // No-op: ohlc_permanent is populated by OhlcCollectorService
    // This method is kept for backwards compatibility
    this.logger.debug(
      "recordDataPoints called - data is recorded to ohlc_permanent by OhlcCollectorService",
    );
  }

  /**
   * Get today's OHLC data for a specific item
   * Queries ohlc_permanent collection which has the actual data
   */
  async getTodayOhlc(itemCode: string): Promise<OhlcResponse | null> {
    const today = moment().tz(this.timezone).format("YYYY-MM-DD");
    const jalaliDate = momentJalaali().format("jYYYY/jMM/jDD");
    const startOfDay = new Date(today + "T00:00:00.000Z");
    const endOfDay = new Date(today + "T23:59:59.999Z");

    try {
      // Query ohlc_permanent for today's 1d data
      // Use UPPERCASE itemCode to match ohlc_permanent storage format
      const dailyRecord = await this.ohlcPermanentModel
        .findOne({
          itemCode: itemCode.toUpperCase(),
          timeframe: "1d",
          timestamp: { $gte: startOfDay, $lte: endOfDay },
        })
        .exec();

      if (dailyRecord) {
        const changePercent =
          ((dailyRecord.close - dailyRecord.open) / dailyRecord.open) * 100;
        return {
          itemCode: itemCode.toLowerCase(),
          date: today,
          dateJalali: jalaliDate,
          open: dailyRecord.open,
          high: dailyRecord.high,
          low: dailyRecord.low,
          close: dailyRecord.close,
          change: parseFloat(changePercent.toFixed(2)),
          dataPoints: [],
        };
      }

      // Fallback: aggregate from 1m data
      const minuteData = await this.ohlcPermanentModel
        .aggregate([
          {
            $match: {
              itemCode: itemCode.toUpperCase(),
              timeframe: "1m",
              timestamp: { $gte: startOfDay, $lte: endOfDay },
            },
          },
          { $sort: { timestamp: 1 } },
          {
            $group: {
              _id: null,
              open: { $first: "$open" },
              high: { $max: "$high" },
              low: { $min: "$low" },
              close: { $last: "$close" },
            },
          },
        ])
        .exec();

      if (minuteData.length > 0) {
        const data = minuteData[0];
        const changePercent = ((data.close - data.open) / data.open) * 100;
        return {
          itemCode: itemCode.toLowerCase(),
          date: today,
          dateJalali: jalaliDate,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          change: parseFloat(changePercent.toFixed(2)),
          dataPoints: [],
        };
      }

      return null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get today's OHLC for ${itemCode}: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Get yesterday's OHLC data for comparison
   * Queries ohlc_permanent collection for yesterday's 1d data
   */
  async getYesterdayOhlc(itemCode: string): Promise<OhlcResponse | null> {
    const yesterday = moment().tz(this.timezone).subtract(1, "day");
    const yesterdayDate = yesterday.format("YYYY-MM-DD");
    const jalaliDate = momentJalaali(yesterday.toDate()).format("jYYYY/jMM/jDD");
    const startOfDay = new Date(yesterdayDate + "T00:00:00.000Z");
    const endOfDay = new Date(yesterdayDate + "T23:59:59.999Z");

    try {
      // Query ohlc_permanent for yesterday's 1d data
      const dailyRecord = await this.ohlcPermanentModel
        .findOne({
          itemCode: itemCode.toUpperCase(),
          timeframe: "1d",
          timestamp: { $gte: startOfDay, $lte: endOfDay },
        })
        .lean()
        .exec();

      if (dailyRecord) {
        const changePercent =
          ((dailyRecord.close - dailyRecord.open) / dailyRecord.open) * 100;
        return {
          itemCode: itemCode.toLowerCase(),
          date: yesterdayDate,
          dateJalali: jalaliDate,
          open: dailyRecord.open,
          high: dailyRecord.high,
          low: dailyRecord.low,
          close: dailyRecord.close,
          change: parseFloat(changePercent.toFixed(2)),
          dataPoints: [],
        };
      }

      return null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get yesterday's OHLC for ${itemCode}: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Calculate daily change percentage
   * Returns percentage change from open to current close price
   */
  async getDailyChangePercent(itemCode: string): Promise<number> {
    const today = await this.getTodayOhlc(itemCode);

    if (!today || !today.open) {
      return 0;
    }

    const change = ((today.close - today.open) / today.open) * 100;
    return parseFloat(change.toFixed(2));
  }

  /**
   * Get all items' OHLC for today
   * Queries ohlc_permanent collection for today's 1d data
   * Useful for dashboard/listing pages
   */
  async getAllTodayOhlc(): Promise<OhlcResponse[]> {
    const today = moment().tz(this.timezone).format("YYYY-MM-DD");
    const jalaliDate = momentJalaali().format("jYYYY/jMM/jDD");
    const startOfDay = new Date(today + "T00:00:00.000Z");
    const endOfDay = new Date(today + "T23:59:59.999Z");

    try {
      // Query ohlc_permanent for all items with 1d timeframe for today
      const dailyRecords = await this.ohlcPermanentModel
        .find({
          timeframe: "1d",
          timestamp: { $gte: startOfDay, $lte: endOfDay },
        })
        .lean()
        .exec();

      if (dailyRecords.length > 0) {
        return dailyRecords.map((record) => {
          const changePercent =
            ((record.close - record.open) / record.open) * 100;
          return {
            itemCode: record.itemCode.toLowerCase(),
            date: today,
            dateJalali: jalaliDate,
            open: record.open,
            high: record.high,
            low: record.low,
            close: record.close,
            change: parseFloat(changePercent.toFixed(2)),
            dataPoints: [],
          };
        });
      }

      // Fallback: aggregate from 1m data for all items
      const minuteData = await this.ohlcPermanentModel
        .aggregate([
          {
            $match: {
              timeframe: "1m",
              timestamp: { $gte: startOfDay, $lte: endOfDay },
            },
          },
          { $sort: { timestamp: 1 } },
          {
            $group: {
              _id: "$itemCode",
              open: { $first: "$open" },
              high: { $max: "$high" },
              low: { $min: "$low" },
              close: { $last: "$close" },
            },
          },
        ])
        .exec();

      return minuteData.map((data) => {
        const changePercent = ((data.close - data.open) / data.open) * 100;
        return {
          itemCode: data._id.toLowerCase(),
          date: today,
          dateJalali: jalaliDate,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          change: parseFloat(changePercent.toFixed(2)),
          dataPoints: [],
        };
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get all today's OHLC: ${err.message}`,
        err.stack,
      );
      return [];
    }
  }

  /**
   * Get OHLC data for a specific date (for historical calendar view)
   * Queries ohlc_permanent collection for the specified date
   */
  async getOhlcByDate(
    itemCode: string,
    date: string,
  ): Promise<OhlcResponse | null> {
    const jalaliDate = momentJalaali(new Date(date)).format("jYYYY/jMM/jDD");
    const startOfDay = new Date(date + "T00:00:00.000Z");
    const endOfDay = new Date(date + "T23:59:59.999Z");

    try {
      const dailyRecord = await this.ohlcPermanentModel
        .findOne({
          itemCode: itemCode.toUpperCase(),
          timeframe: "1d",
          timestamp: { $gte: startOfDay, $lte: endOfDay },
        })
        .lean()
        .exec();

      if (dailyRecord) {
        const changePercent =
          ((dailyRecord.close - dailyRecord.open) / dailyRecord.open) * 100;
        return {
          itemCode: itemCode.toLowerCase(),
          date,
          dateJalali: jalaliDate,
          open: dailyRecord.open,
          high: dailyRecord.high,
          low: dailyRecord.low,
          close: dailyRecord.close,
          change: parseFloat(changePercent.toFixed(2)),
          dataPoints: [],
        };
      }

      return null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get OHLC for ${itemCode} on ${date}: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Get statistics about OHLC data from ohlc_permanent
   * Useful for monitoring and debugging
   */
  async getStatistics(): Promise<{
    totalRecords: number;
    todayRecords: number;
    yesterdayRecords: number;
    oldestRecord: string | null;
    newestRecord: string | null;
  }> {
    const today = moment().tz(this.timezone);
    const startOfToday = today.clone().startOf("day").toDate();
    const endOfToday = today.clone().endOf("day").toDate();
    const startOfYesterday = today.clone().subtract(1, "day").startOf("day").toDate();
    const endOfYesterday = today.clone().subtract(1, "day").endOf("day").toDate();

    try {
      const [totalRecords, todayRecords, yesterdayRecords, oldest, newest] =
        await Promise.all([
          this.ohlcPermanentModel.countDocuments({ timeframe: "1d" }),
          this.ohlcPermanentModel.countDocuments({
            timeframe: "1d",
            timestamp: { $gte: startOfToday, $lte: endOfToday },
          }),
          this.ohlcPermanentModel.countDocuments({
            timeframe: "1d",
            timestamp: { $gte: startOfYesterday, $lte: endOfYesterday },
          }),
          this.ohlcPermanentModel
            .findOne({ timeframe: "1d" })
            .sort({ timestamp: 1 })
            .select("timestamp")
            .lean(),
          this.ohlcPermanentModel
            .findOne({ timeframe: "1d" })
            .sort({ timestamp: -1 })
            .select("timestamp")
            .lean(),
        ]);

      return {
        totalRecords,
        todayRecords,
        yesterdayRecords,
        oldestRecord: oldest
          ? moment(oldest.timestamp).format("YYYY-MM-DD")
          : null,
        newestRecord: newest
          ? moment(newest.timestamp).format("YYYY-MM-DD")
          : null,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get OHLC statistics: ${err.message}`,
        err.stack,
      );
      return {
        totalRecords: 0,
        todayRecords: 0,
        yesterdayRecords: 0,
        oldestRecord: null,
        newestRecord: null,
      };
    }
  }
}
