import { Injectable, Logger } from "@nestjs/common";
import { ChartService } from "../chart/chart.service";
import { TimeRange, ItemType } from "../chart/dto/chart-query.dto";

export interface HistoryDataPoint {
  date: string; // ISO 8601 date (YYYY-MM-DD)
  price: number; // Price in Toman
  timestamp: number; // Unix timestamp
}

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(private readonly chartService: ChartService) {}

  /**
   * Get historical price data for an item by leveraging the chart service
   * This reuses the existing Navasan OHLC API integration with caching and fallback
   *
   * @param itemCode - The item code (e.g., 'USD', 'BTC', 'SEKKEH')
   * @param itemType - The item type (currency, crypto, gold)
   * @param days - Number of days of historical data to fetch
   * @returns Array of historical price data points
   */
  async getHistory(
    itemCode: string,
    itemType: "currency" | "digital-currency" | "gold",
    days: number = 7,
  ): Promise<HistoryDataPoint[]> {
    try {
      // Map days to TimeRange enum
      const timeRange = this.mapDaysToTimeRange(days);

      // Map itemType to ItemType enum
      const chartItemType = this.mapItemTypeToChartType(itemType);

      this.logger.log(
        `Fetching ${days} days of history for ${itemType}:${itemCode} (timeRange: ${timeRange})`,
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
        `Successfully fetched ${historyData.length} historical data points for ${itemCode}`,
      );

      return historyData;
    } catch (error) {
      this.logger.error(
        `Failed to fetch history for ${itemType}:${itemCode}: ${error instanceof Error ? error.message : String(error)}`,
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
