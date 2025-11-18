import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import moment from 'moment-timezone';
import momentJalaali from 'moment-jalaali';
import { IntradayOhlc, IntradayOhlcDocument, DataPoint } from '../schemas/intraday-ohlc.schema';
import { CurrencyData, CryptoData, GoldData } from '../../api-providers/api-provider.interface';

/**
 * Intraday OHLC Service
 *
 * Tracks today's open, high, low, close prices and intraday data points.
 * Provides data for daily change calculations and mini-charts.
 */
@Injectable()
export class IntradayOhlcService {
  private readonly logger = new Logger(IntradayOhlcService.name);
  private readonly timezone = 'Asia/Tehran';

  constructor(
    @InjectModel(IntradayOhlc.name)
    private intradayModel: Model<IntradayOhlcDocument>,
  ) {}

  /**
   * Record data points from API fetch
   * Updates OHLC values and adds to intraday data points
   */
  async recordDataPoints(data: {
    currencies: CurrencyData[];
    crypto: CryptoData[];
    gold: GoldData[];
  }): Promise<void> {
    const tehranNow = moment().tz(this.timezone);
    const dateKey = tehranNow.format('YYYY-MM-DD');
    const jalaliDate = momentJalaali(tehranNow.toDate()).format('jYYYY/jMM/jDD');
    const timeKey = tehranNow.format('HH:mm');

    const allItems = [
      ...data.currencies,
      ...data.crypto,
      ...data.gold,
    ];

    if (allItems.length === 0) {
      this.logger.debug('No data points to record');
      return;
    }

    const bulkOps = [];

    for (const item of allItems) {
      const price = typeof item.price === 'number' ? item.price : parseFloat(String(item.price));

      if (isNaN(price) || price <= 0) {
        this.logger.warn(`Invalid price for ${item.code}: ${item.price}`);
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { itemCode: item.code, date: dateKey },
          update: {
            $setOnInsert: {
              itemCode: item.code,
              date: dateKey,
              dateJalali: jalaliDate,
              open: price,
              high: price,
              low: price,
              firstUpdate: new Date(),
            },
            $max: { high: price },
            $min: { low: price },
            $set: {
              close: price,
              lastUpdate: new Date(),
            },
            $push: {
              dataPoints: {
                $each: [{ time: timeKey, price }],
                $slice: -144, // Keep max 144 points (24h at 10min intervals)
              },
            },
            $inc: { updateCount: 1 },
          },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      try {
        await this.intradayModel.bulkWrite(bulkOps);
        this.logger.log(
          `📊 Recorded ${bulkOps.length} intraday OHLC updates for ${dateKey} at ${timeKey}`
        );
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Failed to record intraday OHLC: ${err.message}`,
          err.stack
        );
      }
    }
  }

  /**
   * Get today's OHLC data for a specific item
   */
  async getTodayOhlc(itemCode: string): Promise<IntradayOhlc | null> {
    const dateKey = moment().tz(this.timezone).format('YYYY-MM-DD');

    try {
      return await this.intradayModel.findOne({
        itemCode,
        date: dateKey,
      }).lean();
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get today's OHLC for ${itemCode}: ${err.message}`,
        err.stack
      );
      return null;
    }
  }

  /**
   * Get yesterday's OHLC data for comparison
   */
  async getYesterdayOhlc(itemCode: string): Promise<IntradayOhlc | null> {
    const yesterdayDate = moment()
      .tz(this.timezone)
      .subtract(1, 'day')
      .format('YYYY-MM-DD');

    try {
      return await this.intradayModel.findOne({
        itemCode,
        date: yesterdayDate,
      }).lean();
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get yesterday's OHLC for ${itemCode}: ${err.message}`,
        err.stack
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
   * Useful for dashboard/listing pages
   */
  async getAllTodayOhlc(): Promise<IntradayOhlc[]> {
    const dateKey = moment().tz(this.timezone).format('YYYY-MM-DD');

    try {
      return await this.intradayModel.find({ date: dateKey }).lean();
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get all today's OHLC: ${err.message}`,
        err.stack
      );
      return [];
    }
  }

  /**
   * Get OHLC data for a specific date (for historical calendar view)
   */
  async getOhlcByDate(itemCode: string, date: string): Promise<IntradayOhlc | null> {
    try {
      return await this.intradayModel.findOne({
        itemCode,
        date,
      }).lean();
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get OHLC for ${itemCode} on ${date}: ${err.message}`,
        err.stack
      );
      return null;
    }
  }

  /**
   * Cleanup old intraday data
   * Runs daily at midnight Tehran time
   * Deletes records older than 2 days (keeps today + yesterday)
   */
  @Cron('0 0 * * *', { timeZone: 'Asia/Tehran' })
  async cleanupOldIntraday(): Promise<void> {
    const twoDaysAgo = moment()
      .tz(this.timezone)
      .subtract(2, 'days')
      .startOf('day')
      .toDate();

    try {
      const result = await this.intradayModel.deleteMany({
        createdAt: { $lt: twoDaysAgo },
      });

      if (result.deletedCount > 0) {
        this.logger.log(
          `🧹 Cleaned up ${result.deletedCount} old intraday OHLC records (older than 2 days)`
        );
      } else {
        this.logger.debug('No old intraday records to clean up');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to cleanup old intraday data: ${err.message}`,
        err.stack
      );
    }
  }

  /**
   * Get statistics about intraday data
   * Useful for monitoring and debugging
   */
  async getStatistics(): Promise<{
    totalRecords: number;
    todayRecords: number;
    yesterdayRecords: number;
    oldestRecord: string | null;
    newestRecord: string | null;
  }> {
    const dateKey = moment().tz(this.timezone).format('YYYY-MM-DD');
    const yesterdayDate = moment()
      .tz(this.timezone)
      .subtract(1, 'days')
      .format('YYYY-MM-DD');

    try {
      const [totalRecords, todayRecords, yesterdayRecords, oldest, newest] = await Promise.all([
        this.intradayModel.countDocuments(),
        this.intradayModel.countDocuments({ date: dateKey }),
        this.intradayModel.countDocuments({ date: yesterdayDate }),
        this.intradayModel.findOne().sort({ date: 1 }).select('date').lean(),
        this.intradayModel.findOne().sort({ date: -1 }).select('date').lean(),
      ]);

      return {
        totalRecords,
        todayRecords,
        yesterdayRecords,
        oldestRecord: oldest?.date || null,
        newestRecord: newest?.date || null,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get intraday statistics: ${err.message}`,
        err.stack
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
