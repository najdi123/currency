import { Injectable, Logger } from '@nestjs/common';
import { OHLCManagerService } from './ohlc-manager.service';
import { OHLCPermanent } from '../navasan/schemas/ohlc-permanent.schema';

@Injectable()
export class OHLCUpdateService {
  private readonly logger = new Logger(OHLCUpdateService.name);

  constructor(
    private readonly ohlcManager: OHLCManagerService,
  ) {}

  /**
   * Update today's OHLC data with new values
   */
  async updateTodayData(
    itemCode: string,
    itemType: 'currency' | 'crypto' | 'gold',
    currentPrice: number,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    // Update for different timeframes
    await this.updateTimeframeData(itemCode, itemType, '1d', today, tomorrow, currentPrice);

    // Also update current hour
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);
    const nextHour = new Date(currentHour.getTime() + 3600000);
    await this.updateTimeframeData(itemCode, itemType, '1h', currentHour, nextHour, currentPrice);

    // Update current 15-minute period
    const current15Min = new Date();
    const minutes = Math.floor(current15Min.getMinutes() / 15) * 15;
    current15Min.setMinutes(minutes, 0, 0);
    const next15Min = new Date(current15Min.getTime() + 900000);
    await this.updateTimeframeData(itemCode, itemType, '15m', current15Min, next15Min, currentPrice);
  }

  /**
   * Update OHLC data for a specific timeframe
   */
  private async updateTimeframeData(
    itemCode: string,
    itemType: 'currency' | 'crypto' | 'gold',
    timeframe: string,
    periodStart: Date,
    periodEnd: Date,
    currentPrice: number,
  ): Promise<void> {
    // Get existing record for this period
    const existingRecords = await this.ohlcManager.getOHLCData(
      itemCode,
      itemType,
      timeframe,
      periodStart,
      periodEnd,
    );

    if (existingRecords.length === 0) {
      // Create new record
      await this.ohlcManager.saveOHLCData([{
        itemCode,
        itemType,
        timeframe,
        timestamp: periodStart,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: 0,
        source: 'api',
        isComplete: false, // Not complete until period ends
        hasMissingData: false,
      }]);

      this.logger.debug(`Created new ${timeframe} OHLC record for ${itemCode}`);
    } else {
      // Update existing record
      const record = existingRecords[0];
      await this.ohlcManager.saveOHLCData([{
        itemCode,
        itemType,
        timeframe,
        timestamp: periodStart,
        open: record.open, // Keep original open
        high: Math.max(record.high, currentPrice),
        low: Math.min(record.low, currentPrice),
        close: currentPrice, // Update close
        volume: record.volume || 0,
        source: 'api',
        isComplete: false,
        hasMissingData: false,
      }]);

      this.logger.debug(`Updated ${timeframe} OHLC record for ${itemCode}`);
    }
  }

  /**
   * Mark completed periods as complete
   */
  async markCompletedPeriods(): Promise<void> {
    const now = new Date();

    // Mark completed minutes (older than 1 minute)
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    await this.markPeriodsComplete('1m', oneMinuteAgo);

    // Mark completed 5-minute periods
    const fiveMinutesAgo = new Date(now.getTime() - 300000);
    await this.markPeriodsComplete('5m', fiveMinutesAgo);

    // Mark completed 15-minute periods
    const fifteenMinutesAgo = new Date(now.getTime() - 900000);
    await this.markPeriodsComplete('15m', fifteenMinutesAgo);

    // Mark completed hours
    const oneHourAgo = new Date(now.getTime() - 3600000);
    await this.markPeriodsComplete('1h', oneHourAgo);

    // Mark completed days
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    await this.markPeriodsComplete('1d', yesterday);
  }

  /**
   * Mark periods as complete
   */
  private async markPeriodsComplete(timeframe: string, beforeTime: Date): Promise<void> {
    // This would be implemented with a direct MongoDB update
    // For now, we'll log it
    this.logger.debug(`Would mark ${timeframe} periods before ${beforeTime.toISOString()} as complete`);
  }

  /**
   * Correct historical data when discrepancies found
   */
  async correctHistoricalData(
    itemCode: string,
    itemType: 'currency' | 'crypto' | 'gold',
    corrections: Array<{
      timestamp: Date;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
    }>,
  ): Promise<void> {
    if (!corrections || corrections.length === 0) {
      return;
    }

    const correctedData = corrections.map(correction => ({
      itemCode,
      itemType,
      timeframe: '1d', // Default to daily for corrections
      timestamp: correction.timestamp,
      open: correction.open,
      high: correction.high,
      low: correction.low,
      close: correction.close,
      source: 'api' as const,
      isComplete: true,
      hasMissingData: false,
    }));

    await this.ohlcManager.saveOHLCData(correctedData);

    this.logger.log(`Corrected ${corrections.length} historical records for ${itemCode}`);
  }

  /**
   * Merge new API data with existing database records
   */
  async mergeApiData(
    itemCode: string,
    itemType: 'currency' | 'crypto' | 'gold',
    apiData: any[],
    timeframe: string,
  ): Promise<void> {
    if (!apiData || apiData.length === 0) {
      return;
    }

    // Get date range from API data
    const timestamps = apiData.map(d => new Date(d.timestamp || d.date));
    const startDate = new Date(Math.min(...timestamps.map(d => d.getTime())));
    const endDate = new Date(Math.max(...timestamps.map(d => d.getTime())));

    // Get existing database records
    const existingData = await this.ohlcManager.getOHLCData(
      itemCode,
      itemType,
      timeframe,
      startDate,
      endDate,
    );

    // Create a map for quick lookup
    const existingMap = new Map(
      existingData.map(d => [d.timestamp.toISOString(), d])
    );

    // Merge data
    const mergedData = apiData.map(apiRecord => {
      const timestamp = new Date(apiRecord.timestamp || apiRecord.date);
      const existing = existingMap.get(timestamp.toISOString());

      if (!existing) {
        // New record
        return {
          itemCode,
          itemType,
          timeframe,
          timestamp,
          open: apiRecord.open || apiRecord.value,
          high: apiRecord.high || apiRecord.value,
          low: apiRecord.low || apiRecord.value,
          close: apiRecord.close || apiRecord.value,
          volume: apiRecord.volume || 0,
          source: 'api' as const,
          isComplete: true,
          hasMissingData: false,
        };
      } else if (this.shouldUpdateRecord(existing, apiRecord)) {
        // Update existing record
        return {
          itemCode,
          itemType,
          timeframe,
          timestamp,
          open: apiRecord.open || existing.open,
          high: Math.max(apiRecord.high || 0, existing.high),
          low: Math.min(apiRecord.low || Infinity, existing.low),
          close: apiRecord.close || existing.close,
          volume: apiRecord.volume || existing.volume,
          source: 'api' as const,
          isComplete: true,
          hasMissingData: false,
        };
      }

      return null; // No update needed
    }).filter((item): item is NonNullable<typeof item> => item !== null) as Partial<OHLCPermanent>[];

    if (mergedData.length > 0) {
      await this.ohlcManager.saveOHLCData(mergedData);
      this.logger.log(`Merged ${mergedData.length} records for ${itemCode}`);
    }
  }

  /**
   * Update OHLC from price snapshot data
   */
  async updateFromPriceSnapshot(
    itemCode: string,
    itemType: 'currency' | 'crypto' | 'gold',
    price: number,
    timestamp: Date,
  ): Promise<void> {
    // Update minute data
    const minute = new Date(timestamp);
    minute.setSeconds(0, 0);
    await this.updateTimeframeData(itemCode, itemType, '1m', minute, new Date(minute.getTime() + 60000), price);

    // Update 5-minute data
    const fiveMin = new Date(timestamp);
    const minutes5 = Math.floor(fiveMin.getMinutes() / 5) * 5;
    fiveMin.setMinutes(minutes5, 0, 0);
    await this.updateTimeframeData(itemCode, itemType, '5m', fiveMin, new Date(fiveMin.getTime() + 300000), price);

    // Update 15-minute data
    const fifteenMin = new Date(timestamp);
    const minutes15 = Math.floor(fifteenMin.getMinutes() / 15) * 15;
    fifteenMin.setMinutes(minutes15, 0, 0);
    await this.updateTimeframeData(itemCode, itemType, '15m', fifteenMin, new Date(fifteenMin.getTime() + 900000), price);

    // Update hourly data
    const hour = new Date(timestamp);
    hour.setMinutes(0, 0, 0);
    await this.updateTimeframeData(itemCode, itemType, '1h', hour, new Date(hour.getTime() + 3600000), price);

    // Update daily data
    const day = new Date(timestamp);
    day.setHours(0, 0, 0, 0);
    await this.updateTimeframeData(itemCode, itemType, '1d', day, new Date(day.getTime() + 86400000), price);
  }

  /**
   * Check if a record should be updated
   */
  private shouldUpdateRecord(existing: OHLCPermanent, apiData: any): boolean {
    // Update if:
    // 1. Source was 'interpolated' or 'calculated'
    // 2. Data is marked as incomplete
    // 3. API has more complete data
    // 4. API data has volume and existing doesn't
    return (
      existing.source === 'interpolated' ||
      existing.source === 'calculated' ||
      !existing.isComplete ||
      existing.hasMissingData ||
      (apiData.volume && !existing.volume) ||
      (apiData.open && apiData.high && apiData.low && apiData.close &&
       (!existing.open || !existing.high || !existing.low || !existing.close))
    );
  }

  /**
   * Get data quality report
   */
  async getDataQualityReport(
    itemCode: string,
    itemType: 'currency' | 'crypto' | 'gold',
    timeframe: string,
    days: number = 30,
  ): Promise<{
    totalRecords: number;
    completeRecords: number;
    interpolatedRecords: number;
    missingDataRecords: number;
    coverage: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);

    const data = await this.ohlcManager.getOHLCData(
      itemCode,
      itemType,
      timeframe,
      startDate,
      endDate,
    );

    const totalRecords = data.length;
    const completeRecords = data.filter(d => d.isComplete && !d.hasMissingData).length;
    const interpolatedRecords = data.filter(d => d.source === 'interpolated').length;
    const missingDataRecords = data.filter(d => d.hasMissingData).length;

    const coverage = await this.ohlcManager.getDataCoverage(
      itemCode,
      itemType,
      timeframe,
      startDate,
      endDate,
    );

    return {
      totalRecords,
      completeRecords,
      interpolatedRecords,
      missingDataRecords,
      coverage: coverage.coverage,
      oldestRecord: data.length > 0 ? data[0].timestamp : null,
      newestRecord: data.length > 0 ? data[data.length - 1].timestamp : null,
    };
  }
}