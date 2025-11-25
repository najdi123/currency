import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import moment from "moment-timezone";
import { ChartService } from "../chart/chart.service";
import { TimeRange, ItemType } from "../chart/dto/chart-query.dto";
import {
  OHLCPermanent,
  OHLCPermanentDocument,
} from "../navasan/schemas/ohlc-permanent.schema";

export interface HistoryDataPoint {
  date: string; // ISO 8601 date (YYYY-MM-DD)
  price: number; // Price in Toman
  timestamp: number; // Unix timestamp
}

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);
  private readonly timezone = "Asia/Tehran";

  constructor(
    private readonly chartService: ChartService,
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
  ) {}

  /**
   * Get historical price data for an item
   * Primary source: ohlc_permanent collection (local database)
   * Fallback: Navasan OHLC API via ChartService
   *
   * @param itemCode - The item code (e.g., 'usd_sell', 'btc', 'sekkeh')
   * @param itemType - The item type (currency, crypto, gold)
   * @param days - Number of days of historical data to fetch
   * @returns Array of historical price data points
   */
  async getHistory(
    itemCode: string,
    itemType: "currency" | "digital-currency" | "gold",
    days: number = 7,
  ): Promise<HistoryDataPoint[]> {
    this.logger.log(
      `Fetching ${days} days of history for ${itemType}:${itemCode}`,
    );

    // Try ohlc_permanent first (primary source)
    const localData = await this.getHistoryFromOhlcPermanent(itemCode, days);

    if (localData && localData.length > 0) {
      this.logger.log(
        `Using ohlc_permanent data: ${localData.length} points for ${itemCode}`,
      );
      return localData;
    }

    // Fallback to Navasan API via ChartService
    this.logger.log(
      `No local data, falling back to Navasan API for ${itemCode}`,
    );
    return this.getHistoryFromChartService(itemCode, itemType, days);
  }

  /**
   * Get history from ohlc_permanent collection
   * Uses 1d timeframe data for daily prices
   */
  private async getHistoryFromOhlcPermanent(
    itemCode: string,
    days: number,
  ): Promise<HistoryDataPoint[]> {
    try {
      const endDate = moment().tz(this.timezone).endOf("day").toDate();
      const startDate = moment()
        .tz(this.timezone)
        .subtract(days, "days")
        .startOf("day")
        .toDate();

      this.logger.log(
        `Querying ohlc_permanent for ${itemCode.toUpperCase()} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // Query ohlc_permanent for 1d timeframe data
      const records = await this.ohlcPermanentModel
        .find({
          itemCode: itemCode.toUpperCase(),
          timeframe: "1d",
          timestamp: { $gte: startDate, $lte: endDate },
        })
        .sort({ timestamp: 1 })
        .lean()
        .exec();

      if (!records || records.length === 0) {
        this.logger.warn(
          `No ohlc_permanent data found for ${itemCode} in the last ${days} days`,
        );
        return [];
      }

      this.logger.log(
        `Found ${records.length} ohlc_permanent records for ${itemCode}`,
      );

      // Transform to HistoryDataPoint format
      return records.map((record) => ({
        date: moment(record.timestamp).format("YYYY-MM-DD"),
        price: record.close, // Use closing price
        timestamp: Math.floor(record.timestamp.getTime() / 1000),
      }));
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to get history from ohlc_permanent for ${itemCode}: ${err.message}`,
        err.stack,
      );
      return [];
    }
  }

  /**
   * Fallback: Get history from ChartService (Navasan API)
   */
  private async getHistoryFromChartService(
    itemCode: string,
    itemType: "currency" | "digital-currency" | "gold",
    days: number,
  ): Promise<HistoryDataPoint[]> {
    try {
      // Map days to TimeRange enum
      const timeRange = this.mapDaysToTimeRange(days);

      // Map itemType to ItemType enum
      const chartItemType = this.mapItemTypeToChartType(itemType);

      this.logger.log(
        `Fetching from ChartService: ${itemCode} (timeRange: ${timeRange})`,
      );

      // Fetch OHLC data from chart service (leverages Navasan API with caching)
      const chartResponse = await this.chartService.getChartData(
        itemCode,
        timeRange,
        chartItemType,
      );

      // Transform OHLC data to simple price history format
      // Use closing price as the representative price for each day
      const historyData = chartResponse.data.map((point) => ({
        date: this.extractDate(point.timestamp),
        price: point.close, // Use closing price
        timestamp: this.convertToUnixTimestamp(point.timestamp),
      }));

      this.logger.log(
        `ChartService returned ${historyData.length} data points for ${itemCode}`,
      );

      return historyData;
    } catch (error) {
      this.logger.error(
        `Failed to fetch history from ChartService for ${itemType}:${itemCode}: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Return empty array on error - caller will handle fallback to mock data
      return [];
    }
  }

  /**
   * Map number of days to TimeRange enum
   * Chooses the closest matching time range
   */
  private mapDaysToTimeRange(days: number): TimeRange {
    if (days <= 1) {
      return TimeRange.ONE_DAY;
    } else if (days <= 7) {
      return TimeRange.ONE_WEEK;
    } else if (days <= 30) {
      return TimeRange.ONE_MONTH;
    } else if (days <= 90) {
      return TimeRange.THREE_MONTHS;
    } else if (days <= 365) {
      return TimeRange.ONE_YEAR;
    } else {
      return TimeRange.ALL;
    }
  }

  /**
   * Map item type string to ChartService ItemType enum
   */
  private mapItemTypeToChartType(
    itemType: "currency" | "digital-currency" | "gold",
  ): ItemType {
    switch (itemType) {
      case "currency":
        return ItemType.CURRENCY;
      case "digital-currency":
        return ItemType.CRYPTO;
      case "gold":
        return ItemType.GOLD;
      default:
        return ItemType.CURRENCY;
    }
  }

  /**
   * Extract date (YYYY-MM-DD) from ISO 8601 timestamp
   */
  private extractDate(timestamp: string): string {
    return timestamp.split("T")[0];
  }

  /**
   * Convert ISO 8601 timestamp to Unix timestamp (seconds)
   */
  private convertToUnixTimestamp(timestamp: string): number {
    return Math.floor(new Date(timestamp).getTime() / 1000);
  }
}
