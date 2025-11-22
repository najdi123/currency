import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  OHLCPermanent,
  OHLCPermanentDocument,
} from "../navasan/schemas/ohlc-permanent.schema";
import {
  UpdateLog,
  UpdateLogDocument,
} from "../navasan/schemas/update-log.schema";

@Injectable()
export class OHLCManagerService {
  private readonly logger = new Logger(OHLCManagerService.name);

  constructor(
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanentDocument>,
    @InjectModel(UpdateLog.name)
    private updateLogModel: Model<UpdateLogDocument>,
  ) {}

  /**
   * Save or update OHLC data
   */
  async saveOHLCData(data: Partial<OHLCPermanent>[]): Promise<void> {
    if (!data || data.length === 0) {
      return;
    }

    const startTime = Date.now();
    const bulkOps = data.map((item) => ({
      updateOne: {
        filter: {
          itemCode: item.itemCode,
          itemType: item.itemType,
          timeframe: item.timeframe,
          timestamp: item.timestamp,
        },
        update: {
          $set: {
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume,
            source: item.source,
            lastUpdated: new Date(),
            isComplete: item.isComplete,
            hasMissingData: item.hasMissingData,
          },
          $inc: { updateCount: 1 },
        },
        upsert: true,
      },
    }));

    try {
      const result = await this.ohlcPermanentModel.bulkWrite(bulkOps);
      const duration = Date.now() - startTime;

      this.logger.log(
        `Saved OHLC data: ${result.upsertedCount} new, ${result.modifiedCount} updated (${duration}ms)`,
      );

      // Log the update
      if (data.length > 0) {
        await this.logUpdate({
          itemCode: data[0].itemCode,
          itemType: data[0].itemType,
          timeframe: data[0].timeframe,
          startDate: new Date(
            Math.min(...data.map((d) => d.timestamp?.getTime() || 0)),
          ),
          endDate: new Date(
            Math.max(...data.map((d) => d.timestamp?.getTime() || 0)),
          ),
          updateType: "realtime",
          recordsAffected: result.upsertedCount + result.modifiedCount,
          status: "success",
          duration,
        });
      }
    } catch (error) {
      this.logger.error("Failed to save OHLC data", error);
      throw error;
    }
  }

  /**
   * Get OHLC data for a specific item and timeframe
   */
  async getOHLCData(
    itemCode: string,
    itemType: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OHLCPermanent[]> {
    return this.ohlcPermanentModel
      .find({
        itemCode,
        itemType,
        timeframe,
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ timestamp: 1 })
      .lean()
      .exec();
  }

  /**
   * Aggregate lower timeframe data to higher timeframes
   */
  async aggregateTimeframes(
    itemCode: string,
    itemType: string,
    sourceTimeframe: string,
    targetTimeframe: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Get the aggregation period based on target timeframe
      const periodMs = this.getTimeframeMs(targetTimeframe);

      // Fetch source data
      const sourceData = await this.getOHLCData(
        itemCode,
        itemType,
        sourceTimeframe,
        startDate,
        endDate,
      );

      if (sourceData.length === 0) {
        this.logger.warn(
          `No source data found for aggregation: ${itemCode} ${sourceTimeframe}`,
        );
        return;
      }

      // Group data by target timeframe periods
      const grouped = this.groupByPeriod(sourceData, periodMs);

      // Convert grouped data to OHLC format
      const aggregatedData = Array.from(grouped.entries()).map(
        ([periodStart, points]) => ({
          itemCode,
          itemType,
          timeframe: targetTimeframe,
          timestamp: new Date(periodStart),
          open: points[0].open,
          high: Math.max(...points.map((p) => p.high)),
          low: Math.min(...points.map((p) => p.low)),
          close: points[points.length - 1].close,
          volume: points.reduce((sum, p) => sum + (p.volume || 0), 0),
          source: "calculated" as const,
          isComplete: true,
          hasMissingData: points.some((p) => p.hasMissingData),
        }),
      );

      await this.saveOHLCData(aggregatedData);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Aggregated ${sourceData.length} ${sourceTimeframe} records to ${aggregatedData.length} ${targetTimeframe} records for ${itemCode} (${duration}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to aggregate timeframes for ${itemCode}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check and fill missing data points
   */
  async fillMissingData(
    itemCode: string,
    itemType: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const existingData = await this.getOHLCData(
      itemCode,
      itemType,
      timeframe,
      startDate,
      endDate,
    );

    if (existingData.length < 2) {
      return; // Not enough data to interpolate
    }

    const gaps = this.identifyGaps(existingData, timeframe, startDate, endDate);

    if (gaps.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${gaps.length} gaps in ${itemCode} ${timeframe} data`,
    );

    for (const gap of gaps) {
      await this.interpolateGap(
        itemCode,
        itemType,
        timeframe,
        gap.start,
        gap.end,
        existingData,
      );
    }
  }

  /**
   * Get the latest OHLC record for an item
   */
  async getLatestOHLC(
    itemCode: string,
    itemType: string,
    timeframe: string,
  ): Promise<OHLCPermanent | null> {
    return this.ohlcPermanentModel
      .findOne({ itemCode, itemType, timeframe })
      .sort({ timestamp: -1 })
      .lean()
      .exec();
  }

  /**
   * Get data coverage statistics
   */
  async getDataCoverage(
    itemCode: string,
    itemType: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    expectedPoints: number;
    actualPoints: number;
    coverage: number;
    missingPeriods: Array<{ start: Date; end: Date }>;
  }> {
    const data = await this.getOHLCData(
      itemCode,
      itemType,
      timeframe,
      startDate,
      endDate,
    );
    const expectedPoints = this.getExpectedDataPoints(
      startDate,
      endDate,
      timeframe,
    );
    const actualPoints = data.length;
    const coverage = actualPoints / expectedPoints;
    const missingPeriods = this.identifyGaps(
      data,
      timeframe,
      startDate,
      endDate,
    );

    return {
      expectedPoints,
      actualPoints,
      coverage,
      missingPeriods,
    };
  }

  // Helper methods

  private groupByPeriod(
    data: OHLCPermanent[],
    periodMs: number,
  ): Map<number, OHLCPermanent[]> {
    const grouped = new Map<number, OHLCPermanent[]>();

    for (const point of data) {
      const periodStart =
        Math.floor(point.timestamp.getTime() / periodMs) * periodMs;

      if (!grouped.has(periodStart)) {
        grouped.set(periodStart, []);
      }

      grouped.get(periodStart)!.push(point);
    }

    return grouped;
  }

  private identifyGaps(
    data: OHLCPermanent[],
    timeframe: string,
    startDate: Date,
    endDate: Date,
  ): Array<{ start: Date; end: Date }> {
    const gaps: Array<{ start: Date; end: Date }> = [];
    const intervalMs = this.getTimeframeMs(timeframe);

    // Check for gap at the beginning
    if (
      data.length > 0 &&
      data[0].timestamp.getTime() - startDate.getTime() > intervalMs
    ) {
      gaps.push({
        start: startDate,
        end: new Date(data[0].timestamp.getTime() - intervalMs),
      });
    }

    // Check for gaps between consecutive data points
    for (let i = 1; i < data.length; i++) {
      const prevTime = data[i - 1].timestamp.getTime();
      const currTime = data[i].timestamp.getTime();

      if (currTime - prevTime > intervalMs * 1.5) {
        gaps.push({
          start: new Date(prevTime + intervalMs),
          end: new Date(currTime - intervalMs),
        });
      }
    }

    // Check for gap at the end
    if (
      data.length > 0 &&
      endDate.getTime() - data[data.length - 1].timestamp.getTime() > intervalMs
    ) {
      gaps.push({
        start: new Date(data[data.length - 1].timestamp.getTime() + intervalMs),
        end: endDate,
      });
    }

    return gaps;
  }

  private async interpolateGap(
    itemCode: string,
    itemType: string,
    timeframe: string,
    gapStart: Date,
    gapEnd: Date,
    existingData: OHLCPermanent[],
  ): Promise<void> {
    // Find data points before and after the gap
    const before = existingData
      .filter((d) => d.timestamp < gapStart)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    const after = existingData
      .filter((d) => d.timestamp > gapEnd)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

    if (!before || !after) {
      return; // Cannot interpolate without both endpoints
    }

    const intervalMs = this.getTimeframeMs(timeframe);
    const interpolatedData: Partial<OHLCPermanent>[] = [];
    let currentTime = new Date(gapStart.getTime());

    while (currentTime <= gapEnd) {
      const ratio =
        (currentTime.getTime() - before.timestamp.getTime()) /
        (after.timestamp.getTime() - before.timestamp.getTime());

      interpolatedData.push({
        itemCode,
        itemType,
        timeframe,
        timestamp: new Date(currentTime),
        open: this.lerp(before.close, after.open, ratio),
        high: this.lerp(before.high, after.high, ratio),
        low: this.lerp(before.low, after.low, ratio),
        close: this.lerp(before.close, after.close, ratio),
        volume: 0,
        source: "interpolated",
        isComplete: false,
        hasMissingData: true,
      });

      currentTime = new Date(currentTime.getTime() + intervalMs);
    }

    if (interpolatedData.length > 0) {
      await this.saveOHLCData(interpolatedData);
      this.logger.log(
        `Interpolated ${interpolatedData.length} data points for ${itemCode}`,
      );
    }
  }

  private lerp(start: number, end: number, ratio: number): number {
    return start + (end - start) * ratio;
  }

  private getTimeframeMs(timeframe: string): number {
    const intervals: Record<string, number> = {
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "1h": 3600000,
      "1d": 86400000,
      "1w": 604800000,
      "1M": 2592000000,
    };
    return intervals[timeframe] || 60000;
  }

  private getExpectedDataPoints(
    startDate: Date,
    endDate: Date,
    timeframe: string,
  ): number {
    const duration = endDate.getTime() - startDate.getTime();
    const interval = this.getTimeframeMs(timeframe);
    return Math.floor(duration / interval) + 1;
  }

  private async logUpdate(data: Partial<UpdateLog>): Promise<void> {
    try {
      await this.updateLogModel.create({
        ...data,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Failed to log update", error);
    }
  }
}
