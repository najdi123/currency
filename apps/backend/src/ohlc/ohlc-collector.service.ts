import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { MarketDataOrchestratorService } from "../market-data/market-data-orchestrator.service";
import { ChartService } from "../chart/chart.service";
import { OHLCManagerService } from "./ohlc-manager.service";

interface TrackedItem {
  code: string;
  type: "currency" | "crypto" | "gold";
  navasanKey?: string; // Optional: if the key in navasan response is different
}

@Injectable()
export class OHLCCollectorService implements OnModuleInit {
  private readonly logger = new Logger(OHLCCollectorService.name);
  private readonly isEnabled: boolean;
  private readonly realtimeEnabled: boolean;
  private readonly aggregationEnabled: boolean;

  private readonly ITEMS_TO_TRACK: TrackedItem[] = [
    // Currencies
    { code: "USD_SELL", type: "currency", navasanKey: "usd_sell" },
    { code: "USD_BUY", type: "currency", navasanKey: "usd_buy" },
    { code: "EUR", type: "currency", navasanKey: "eur" },
    { code: "GBP", type: "currency", navasanKey: "gbp" },
    { code: "CAD", type: "currency", navasanKey: "cad" },
    { code: "AUD", type: "currency", navasanKey: "aud" },
    { code: "AED", type: "currency", navasanKey: "aed" },
    { code: "AED_SELL", type: "currency", navasanKey: "aed_sell" },
    { code: "CNY", type: "currency", navasanKey: "cny" },
    { code: "TRY", type: "currency", navasanKey: "try" },
    { code: "CHF", type: "currency", navasanKey: "chf" },
    { code: "JPY", type: "currency", navasanKey: "jpy" },
    { code: "RUB", type: "currency", navasanKey: "rub" },
    { code: "INR", type: "currency", navasanKey: "inr" },
    { code: "PKR", type: "currency", navasanKey: "pkr" },
    { code: "IQD", type: "currency", navasanKey: "iqd" },
    { code: "KWD", type: "currency", navasanKey: "kwd" },
    { code: "SAR", type: "currency", navasanKey: "sar" },
    { code: "QAR", type: "currency", navasanKey: "qar" },
    { code: "OMR", type: "currency", navasanKey: "omr" },
    { code: "BHD", type: "currency", navasanKey: "bhd" },

    // USD Variants
    { code: "USD_HARAT_SELL", type: "currency", navasanKey: "usd_harat_sell" },
    {
      code: "USD_HARAT_CASH_SELL",
      type: "currency",
      navasanKey: "usd_harat_cash_sell",
    },
    {
      code: "USD_HARAT_CASH_BUY",
      type: "currency",
      navasanKey: "usd_harat_cash_buy",
    },
    { code: "USD_FARDA_SELL", type: "currency", navasanKey: "usd_farda_sell" },
    { code: "USD_FARDA_BUY", type: "currency", navasanKey: "usd_farda_buy" },
    { code: "USD_SHAKHS", type: "currency", navasanKey: "usd_shakhs" },
    { code: "USD_SHERKAT", type: "currency", navasanKey: "usd_sherkat" },
    { code: "USD_PP", type: "currency", navasanKey: "usd_pp" },
    {
      code: "USD_MASHAD_SELL",
      type: "currency",
      navasanKey: "usd_mashad_sell",
    },
    {
      code: "USD_KORDESTAN_SELL",
      type: "currency",
      navasanKey: "usd_kordestan_sell",
    },
    {
      code: "USD_SOLEIMANIE_SELL",
      type: "currency",
      navasanKey: "usd_soleimanie_sell",
    },

    // Other currency variants
    { code: "DIRHAM_DUBAI", type: "currency", navasanKey: "dirham_dubai" },
    { code: "EUR_HAV", type: "currency", navasanKey: "eur_hav" },
    { code: "GBP_HAV", type: "currency", navasanKey: "gbp_hav" },
    { code: "GBP_WHT", type: "currency", navasanKey: "gbp_wht" },
    { code: "CAD_HAV", type: "currency", navasanKey: "cad_hav" },
    { code: "CAD_CASH", type: "currency", navasanKey: "cad_cash" },
    { code: "AUD_HAV", type: "currency", navasanKey: "aud_hav" },
    { code: "AUD_WHT", type: "currency", navasanKey: "aud_wht" },

    // Cryptocurrencies
    { code: "USDT", type: "crypto", navasanKey: "usdt" },
    { code: "BTC", type: "crypto", navasanKey: "btc" },
    { code: "ETH", type: "crypto", navasanKey: "eth" },
    { code: "BNB", type: "crypto", navasanKey: "bnb" },
    { code: "XRP", type: "crypto", navasanKey: "xrp" },
    { code: "ADA", type: "crypto", navasanKey: "ada" },
    { code: "DOGE", type: "crypto", navasanKey: "doge" },
    { code: "SOL", type: "crypto", navasanKey: "sol" },
    { code: "MATIC", type: "crypto", navasanKey: "matic" },
    { code: "DOT", type: "crypto", navasanKey: "dot" },
    { code: "LTC", type: "crypto", navasanKey: "ltc" },

    // Gold Items
    { code: "SEKKEH", type: "gold", navasanKey: "sekkeh" },
    { code: "BAHAR", type: "gold", navasanKey: "bahar" },
    { code: "NIM", type: "gold", navasanKey: "nim" },
    { code: "ROB", type: "gold", navasanKey: "rob" },
    { code: "GERAMI", type: "gold", navasanKey: "gerami" },
    { code: "18AYAR", type: "gold", navasanKey: "18ayar" },
    { code: "ABSHODEH", type: "gold", navasanKey: "abshodeh" },
  ];

  constructor(
    private readonly marketDataService: MarketDataOrchestratorService,
    private readonly chartService: ChartService,
    private readonly ohlcManager: OHLCManagerService,
    private readonly configService: ConfigService,
  ) {
    this.isEnabled =
      this.configService.get<string>("OHLC_COLLECTION_ENABLED", "true") ===
      "true";
    this.realtimeEnabled =
      this.configService.get<string>("OHLC_REALTIME_ENABLED", "true") ===
      "true";
    this.aggregationEnabled =
      this.configService.get<string>("OHLC_AGGREGATION_ENABLED", "true") ===
      "true";

    if (!this.isEnabled) {
      this.logger.warn("OHLC collection is DISABLED");
    } else {
      this.logger.log("OHLC collection is ENABLED");
      this.logger.log(`Tracking ${this.ITEMS_TO_TRACK.length} items`);
    }
  }

  async onModuleInit() {
    if (
      this.isEnabled &&
      this.configService.get<string>("OHLC_BACKFILL_ON_STARTUP", "false") ===
        "true"
    ) {
      this.logger.log("Starting initial backfill...");
      await this.backfillRecentData();
    }
  }

  /**
   * Collect real-time data every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMinuteData(): Promise<void> {
    if (!this.isEnabled || !this.realtimeEnabled) {
      return;
    }

    const startTime = Date.now();
    this.logger.debug("Starting minute OHLC collection");

    try {
      // Get current prices from MarketData service
      const response = await this.marketDataService.getLatestRates();

      if (!response || !response.data) {
        this.logger.warn("No data received from MarketData service");
        return;
      }

      const latestRates = response.data;

      const timestamp = new Date();
      timestamp.setSeconds(0, 0); // Round to minute

      const ohlcData = [];

      // Process each tracked item
      for (const item of this.ITEMS_TO_TRACK) {
        const price = this.extractPrice(latestRates, item);

        if (price !== null && price > 0) {
          // Check if we have an existing record for this minute
          const existing = await this.ohlcManager.getOHLCData(
            item.code,
            item.type,
            "1m",
            timestamp,
            new Date(timestamp.getTime() + 59999), // End of the same minute
          );

          if (existing.length > 0) {
            // Update existing record
            ohlcData.push({
              itemCode: item.code,
              itemType: item.type,
              timeframe: "1m",
              timestamp,
              open: existing[0].open, // Keep original open
              high: Math.max(existing[0].high, price),
              low: Math.min(existing[0].low, price),
              close: price, // Update close
              volume: 0,
              source: "api",
              isComplete: false, // Will be true after minute ends
              hasMissingData: false,
            });
          } else {
            // Create new record
            ohlcData.push({
              itemCode: item.code,
              itemType: item.type,
              timeframe: "1m",
              timestamp,
              open: price,
              high: price,
              low: price,
              close: price,
              volume: 0,
              source: "api",
              isComplete: false,
              hasMissingData: false,
            });
          }
        }
      }

      if (ohlcData.length > 0) {
        await this.ohlcManager.saveOHLCData(ohlcData);
        const duration = Date.now() - startTime;
        this.logger.log(
          `Collected ${ohlcData.length} minute OHLC records (${duration}ms)`,
        );
      } else {
        this.logger.warn("No valid price data to collect");
      }
    } catch (error) {
      this.logger.error("Failed to collect minute data", error);
    }
  }

  /**
   * Aggregate to higher timeframes every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async aggregateTimeframes(): Promise<void> {
    if (!this.isEnabled || !this.aggregationEnabled) {
      return;
    }

    this.logger.debug("Starting timeframe aggregation");
    const startTime = Date.now();

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 3600000); // Last hour

    try {
      let totalAggregated = 0;

      for (const item of this.ITEMS_TO_TRACK) {
        try {
          // Aggregate 1m -> 5m
          await this.ohlcManager.aggregateTimeframes(
            item.code,
            item.type,
            "1m",
            "5m",
            startDate,
            endDate,
          );

          // Aggregate 5m -> 15m
          await this.ohlcManager.aggregateTimeframes(
            item.code,
            item.type,
            "5m",
            "15m",
            new Date(endDate.getTime() - 7200000), // Last 2 hours
            endDate,
          );

          totalAggregated++;
        } catch (error) {
          this.logger.error(`Failed to aggregate ${item.code}`, error);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Aggregated timeframes for ${totalAggregated} items (${duration}ms)`,
      );
    } catch (error) {
      this.logger.error("Failed to aggregate timeframes", error);
    }
  }

  /**
   * Hourly aggregation
   */
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyAggregation(): Promise<void> {
    if (!this.isEnabled || !this.aggregationEnabled) {
      return;
    }

    this.logger.debug("Starting hourly aggregation");
    const startTime = Date.now();

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 86400000); // Last 24 hours

    try {
      for (const item of this.ITEMS_TO_TRACK) {
        try {
          // Aggregate 15m -> 1h
          await this.ohlcManager.aggregateTimeframes(
            item.code,
            item.type,
            "15m",
            "1h",
            startDate,
            endDate,
          );
        } catch (error) {
          this.logger.error(
            `Failed hourly aggregation for ${item.code}`,
            error,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Completed hourly aggregation (${duration}ms)`);
    } catch (error) {
      this.logger.error("Failed hourly aggregation", error);
    }
  }

  /**
   * Daily aggregation and cleanup
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyAggregation(): Promise<void> {
    if (!this.isEnabled || !this.aggregationEnabled) {
      return;
    }

    this.logger.log("Starting daily aggregation");
    const startTime = Date.now();

    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate.getTime() - 86400000); // Yesterday

    try {
      for (const item of this.ITEMS_TO_TRACK) {
        try {
          // Aggregate 1h -> 1d
          await this.ohlcManager.aggregateTimeframes(
            item.code,
            item.type,
            "1h",
            "1d",
            startDate,
            endDate,
          );

          // Check and fill missing data for the last 30 days
          await this.ohlcManager.fillMissingData(
            item.code,
            item.type,
            "1d",
            new Date(endDate.getTime() - 30 * 86400000),
            endDate,
          );
        } catch (error) {
          this.logger.error(`Failed daily aggregation for ${item.code}`, error);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Completed daily aggregation (${duration}ms)`);
    } catch (error) {
      this.logger.error("Failed daily aggregation", error);
    }
  }

  /**
   * Backfill historical data from Navasan API
   */
  async backfillHistoricalData(
    itemCode: string,
    itemType: "currency" | "crypto" | "gold",
    timeRange: string,
  ): Promise<void> {
    this.logger.log(`Backfilling ${itemCode} for ${timeRange}`);

    try {
      // Import TimeRange and ItemType from chart module
      const { TimeRange, ItemType } = await import(
        "../chart/dto/chart-query.dto"
      );

      // Convert string timeRange to TimeRange enum
      const timeRangeEnum =
        TimeRange[
          timeRange
            .toUpperCase()
            .replace(/(\d)([A-Z])/g, "$1_$2") as keyof typeof TimeRange
        ] || TimeRange.ONE_MONTH;

      // Convert itemType to ItemType enum
      const itemTypeEnum =
        ItemType[itemType.toUpperCase() as keyof typeof ItemType] ||
        ItemType.CURRENCY;

      // Fetch from Navasan API via ChartService
      const chartData = await this.chartService.getChartData(
        itemCode,
        timeRangeEnum,
        itemTypeEnum,
      );

      if (!chartData || !chartData.data || chartData.data.length === 0) {
        this.logger.warn(`No data available for ${itemCode} ${timeRange}`);
        return;
      }

      // Convert to OHLC format
      const timeframe = this.determineTimeframe(timeRange);
      const ohlcData = chartData.data.map((point: any) => ({
        itemCode,
        itemType,
        timeframe,
        timestamp: new Date(point.timestamp),
        open: point.open || point.value,
        high: point.high || point.value,
        low: point.low || point.value,
        close: point.close || point.value,
        volume: point.volume || 0,
        source: "api" as const,
        isComplete: !!(point.open && point.high && point.low && point.close),
        hasMissingData: false,
      }));

      // Save to database
      await this.ohlcManager.saveOHLCData(ohlcData);

      this.logger.log(
        `Backfilled ${ohlcData.length} records for ${itemCode} ${timeRange}`,
      );
    } catch (error) {
      this.logger.error(`Failed to backfill ${itemCode} ${timeRange}`, error);
      throw error;
    }
  }

  /**
   * Backfill recent data for all items (last 7 days)
   */
  async backfillRecentData(): Promise<void> {
    this.logger.log("Starting recent data backfill");
    const startTime = Date.now();

    let successCount = 0;
    let failCount = 0;

    for (const item of this.ITEMS_TO_TRACK) {
      try {
        await this.backfillHistoricalData(item.code, item.type, "1w");
        successCount++;

        // Rate limiting - wait 500ms between requests
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        failCount++;
        this.logger.error(`Failed to backfill ${item.code}`, error);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Backfill completed: ${successCount} success, ${failCount} failed (${duration}ms)`,
    );
  }

  // Helper methods

  private extractPrice(data: any, item: TrackedItem): number | null {
    try {
      const key = item.navasanKey || item.code.toLowerCase();
      const value = data[key]?.value;

      if (value === undefined || value === null) {
        return null;
      }

      const price = typeof value === "string" ? parseFloat(value) : value;

      if (isNaN(price)) {
        return null;
      }

      return price;
    } catch (error) {
      this.logger.warn(
        `Failed to extract price for ${item.code}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private determineTimeframe(timeRange: string): string {
    const mapping: Record<string, string> = {
      "1d": "15m",
      "1w": "1h",
      "1m": "1h",
      "3m": "1d",
      "1y": "1d",
      all: "1w",
    };
    return mapping[timeRange] || "1h";
  }
}
