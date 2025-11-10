# OHLC Database Implementation Plan
## Complete Guide for Persistent OHLC Data Storage and Management

---

## Executive Summary

This document provides a comprehensive, step-by-step plan to enhance your currency exchange application to:
1. **Record all OHLC values permanently** in MongoDB
2. **Update today's and future data** from new API requests
3. **Read from database** when displaying historical data
4. **Maintain data consistency** between real-time and historical records

**Current State:** You have OHLC caching with 90-day TTL, but no permanent storage
**Target State:** Permanent OHLC database with intelligent update mechanisms and efficient retrieval

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Proposed Architecture](#2-proposed-architecture)
3. [Implementation Phases](#3-implementation-phases)
4. [Phase 1: Database Schema Enhancement](#phase-1-database-schema-enhancement)
5. [Phase 2: Data Collection Service](#phase-2-data-collection-service)
6. [Phase 3: Data Update Mechanisms](#phase-3-data-update-mechanisms)
7. [Phase 4: Query and Retrieval System](#phase-4-query-and-retrieval-system)
8. [Phase 5: Migration and Backfill](#phase-5-migration-and-backfill)
9. [Phase 6: Frontend Integration](#phase-6-frontend-integration)
10. [Testing Strategy](#7-testing-strategy)
11. [Monitoring and Maintenance](#8-monitoring-and-maintenance)
12. [Timeline and Milestones](#9-timeline-and-milestones)

---

## 1. Current Architecture Analysis

### Existing OHLC Implementation

**Location:** `apps/backend/src/chart/chart.service.ts`

**Current Features:**
- Fetches OHLC from Navasan API on-demand
- Caches in `ohlc_snapshots` collection (90-day TTL)
- Falls back to building synthetic OHLC from price snapshots
- Supports multiple time ranges (1d, 1w, 1m, 3m, 1y, all)

**Current Limitations:**
- ❌ Data expires after 90 days
- ❌ No permanent OHLC storage
- ❌ Cannot update partial data efficiently
- ❌ No aggregation for different time periods
- ❌ Relies heavily on external API availability

### Current Database Collections

```typescript
// ohlc_snapshots (TEMPORARY - 90 day TTL)
{
  itemCode: string,
  itemType: string,
  timeRange: string,
  data: OHLC[],
  timestamp: Date,
  expireAt: Date  // TTL index
}

// price_snapshots (PERMANENT)
{
  category: string,
  data: any,
  timestamp: Date,
  metadata: {...}
}
```

---

## 2. Proposed Architecture

### New Database Collections

#### 2.1. `ohlc_permanent` - Permanent OHLC Storage
```typescript
interface OHLCPermanent {
  // Identification
  itemCode: string;           // 'USD_SELL', 'BTC', 'SEKKEH'
  itemType: string;           // 'currency' | 'crypto' | 'gold'

  // Time Information
  timestamp: Date;            // Candle timestamp (start of period)
  timeframe: string;          // '1m', '5m', '15m', '1h', '1d', '1w', '1M'

  // OHLC Data
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;            // Optional volume data

  // Metadata
  source: string;             // 'api' | 'calculated' | 'interpolated'
  lastUpdated: Date;          // When this record was last modified
  updateCount: number;        // Number of times updated

  // Data Quality
  isComplete: boolean;        // All OHLC values present
  hasMissingData: boolean;    // Indicates interpolated values
}

// Indexes
- Compound: [itemCode, itemType, timeframe, timestamp] - UNIQUE
- Compound: [itemCode, timestamp]
- Single: [timestamp]
- Single: [lastUpdated]
```

#### 2.2. `ohlc_aggregation_rules` - Aggregation Configuration
```typescript
interface AggregationRule {
  sourceTimeframe: string;    // '1m'
  targetTimeframe: string;    // '5m', '15m', '1h', '1d'
  aggregationMethod: string;  // 'standard' | 'weighted' | 'custom'
  minDataPoints: number;      // Minimum points needed for aggregation
  enabled: boolean;
}
```

#### 2.3. `ohlc_update_log` - Update History
```typescript
interface UpdateLog {
  itemCode: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  updateType: string;         // 'backfill' | 'realtime' | 'correction'
  recordsAffected: number;
  timestamp: Date;
  status: string;             // 'success' | 'partial' | 'failed'
  errorDetails?: string;
}
```

---

## 3. Implementation Phases

### Overview of Phases

| Phase | Title | Duration | Dependencies |
|-------|-------|----------|--------------|
| **1** | Database Schema Enhancement | 2 days | None |
| **2** | Data Collection Service | 3 days | Phase 1 |
| **3** | Data Update Mechanisms | 3 days | Phase 2 |
| **4** | Query and Retrieval System | 2 days | Phase 3 |
| **5** | Migration and Backfill | 2 days | Phase 4 |
| **6** | Frontend Integration | 2 days | Phase 5 |

**Total Duration:** ~14 days (2-3 weeks)

---

## Phase 1: Database Schema Enhancement

### Step 1.1: Create New Schemas

**File:** `apps/backend/src/navasan/schemas/ohlc-permanent.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OHLCPermanentDocument = OHLCPermanent & Document;

@Schema({
  timestamps: true,
  collection: 'ohlc_permanent'
})
export class OHLCPermanent {
  @Prop({ required: true, index: true })
  itemCode: string;

  @Prop({ required: true, enum: ['currency', 'crypto', 'gold'] })
  itemType: string;

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop({ required: true, enum: ['1m', '5m', '15m', '1h', '1d', '1w', '1M'] })
  timeframe: string;

  @Prop({ required: true })
  open: number;

  @Prop({ required: true })
  high: number;

  @Prop({ required: true })
  low: number;

  @Prop({ required: true })
  close: number;

  @Prop({ default: null })
  volume: number;

  @Prop({ required: true, enum: ['api', 'calculated', 'interpolated'] })
  source: string;

  @Prop({ default: Date.now })
  lastUpdated: Date;

  @Prop({ default: 0 })
  updateCount: number;

  @Prop({ default: true })
  isComplete: boolean;

  @Prop({ default: false })
  hasMissingData: boolean;
}

export const OHLCPermanentSchema = SchemaFactory.createForClass(OHLCPermanent);

// Create compound unique index
OHLCPermanentSchema.index(
  { itemCode: 1, itemType: 1, timeframe: 1, timestamp: 1 },
  { unique: true }
);

// Additional performance indexes
OHLCPermanentSchema.index({ itemCode: 1, timestamp: 1 });
OHLCPermanentSchema.index({ lastUpdated: 1 });
```

### Step 1.2: Update Module Registration

**File:** `apps/backend/src/navasan/navasan.module.ts`

```typescript
import { OHLCPermanent, OHLCPermanentSchema } from './schemas/ohlc-permanent.schema';
import { AggregationRule, AggregationRuleSchema } from './schemas/aggregation-rule.schema';
import { UpdateLog, UpdateLogSchema } from './schemas/update-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      // ... existing schemas ...
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
      { name: AggregationRule.name, schema: AggregationRuleSchema },
      { name: UpdateLog.name, schema: UpdateLogSchema },
    ]),
    // ... rest of imports
  ],
  // ... rest of module config
})
```

---

## Phase 2: Data Collection Service

### Step 2.1: Create OHLC Manager Service

**File:** `apps/backend/src/ohlc/ohlc-manager.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OHLCPermanent } from '../navasan/schemas/ohlc-permanent.schema';

@Injectable()
export class OHLCManagerService {
  private readonly logger = new Logger(OHLCManagerService.name);

  constructor(
    @InjectModel(OHLCPermanent.name)
    private ohlcPermanentModel: Model<OHLCPermanent>,
  ) {}

  /**
   * Save or update OHLC data
   */
  async saveOHLCData(data: Partial<OHLCPermanent>[]): Promise<void> {
    const bulkOps = data.map(item => ({
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
      this.logger.log(`Saved ${result.upsertedCount} new, updated ${result.modifiedCount} OHLC records`);
    } catch (error) {
      this.logger.error('Failed to save OHLC data', error);
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
    // Implementation for aggregating 1m -> 5m -> 15m -> 1h -> 1d
    const pipeline = [
      {
        $match: {
          itemCode,
          itemType,
          timeframe: sourceTimeframe,
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            // Group by target timeframe periods
            period: this.getAggregationPeriod(targetTimeframe),
          },
          open: { $first: '$open' },
          high: { $max: '$high' },
          low: { $min: '$low' },
          close: { $last: '$close' },
          volume: { $sum: '$volume' },
          timestamp: { $first: '$timestamp' },
        },
      },
    ];

    const aggregatedData = await this.ohlcPermanentModel.aggregate(pipeline);

    // Save aggregated data
    const formattedData = aggregatedData.map(item => ({
      itemCode,
      itemType,
      timeframe: targetTimeframe,
      timestamp: item.timestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      source: 'calculated',
      isComplete: true,
      hasMissingData: false,
    }));

    await this.saveOHLCData(formattedData);
  }

  private getAggregationPeriod(timeframe: string): any {
    // Return MongoDB aggregation expression for grouping by period
    const periods = {
      '5m': { $floor: { $divide: ['$timestamp', 300000] } },     // 5 minutes
      '15m': { $floor: { $divide: ['$timestamp', 900000] } },    // 15 minutes
      '1h': { $floor: { $divide: ['$timestamp', 3600000] } },    // 1 hour
      '1d': { $floor: { $divide: ['$timestamp', 86400000] } },   // 1 day
      '1w': { $floor: { $divide: ['$timestamp', 604800000] } },  // 1 week
    };
    return periods[timeframe];
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

    // Identify gaps in data
    const gaps = this.identifyGaps(existingData, timeframe, startDate, endDate);

    // Fill gaps with interpolated data
    for (const gap of gaps) {
      await this.interpolateGap(
        itemCode,
        itemType,
        timeframe,
        gap.start,
        gap.end,
      );
    }
  }

  private identifyGaps(
    data: OHLCPermanent[],
    timeframe: string,
    startDate: Date,
    endDate: Date,
  ): Array<{ start: Date; end: Date }> {
    const gaps = [];
    const intervalMs = this.getTimeframeMs(timeframe);

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

    return gaps;
  }

  private getTimeframeMs(timeframe: string): number {
    const intervals = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '1d': 86400000,
      '1w': 604800000,
      '1M': 2592000000,
    };
    return intervals[timeframe] || 60000;
  }

  private async interpolateGap(
    itemCode: string,
    itemType: string,
    timeframe: string,
    gapStart: Date,
    gapEnd: Date,
  ): Promise<void> {
    // Get data points before and after the gap
    const before = await this.ohlcPermanentModel
      .findOne({
        itemCode,
        itemType,
        timeframe,
        timestamp: { $lt: gapStart },
      })
      .sort({ timestamp: -1 });

    const after = await this.ohlcPermanentModel
      .findOne({
        itemCode,
        itemType,
        timeframe,
        timestamp: { $gt: gapEnd },
      })
      .sort({ timestamp: 1 });

    if (!before || !after) return;

    // Linear interpolation
    const intervalMs = this.getTimeframeMs(timeframe);
    const currentTime = new Date(gapStart);
    const interpolatedData = [];

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
        source: 'interpolated',
        isComplete: false,
        hasMissingData: true,
      });

      currentTime.setTime(currentTime.getTime() + intervalMs);
    }

    await this.saveOHLCData(interpolatedData);
  }

  private lerp(start: number, end: number, ratio: number): number {
    return start + (end - start) * ratio;
  }
}
```

### Step 2.2: Create OHLC Collector Service

**File:** `apps/backend/src/ohlc/ohlc-collector.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NavasanService } from '../navasan/navasan.service';
import { ChartService } from '../chart/chart.service';
import { OHLCManagerService } from './ohlc-manager.service';

@Injectable()
export class OHLCCollectorService {
  private readonly logger = new Logger(OHLCCollectorService.name);
  private readonly ITEMS_TO_TRACK = [
    // Currencies
    { code: 'USD_SELL', type: 'currency' },
    { code: 'EUR', type: 'currency' },
    { code: 'GBP', type: 'currency' },
    // ... add all items

    // Crypto
    { code: 'BTC', type: 'crypto' },
    { code: 'ETH', type: 'crypto' },
    // ... add all crypto

    // Gold
    { code: 'SEKKEH', type: 'gold' },
    { code: 'BAHAR', type: 'gold' },
    // ... add all gold items
  ];

  constructor(
    private readonly navasanService: NavasanService,
    private readonly chartService: ChartService,
    private readonly ohlcManager: OHLCManagerService,
  ) {}

  /**
   * Collect real-time data every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMinuteData(): Promise<void> {
    this.logger.log('Starting minute OHLC collection');

    try {
      // Get current prices from Navasan
      const latestRates = await this.navasanService.getLatestRates();
      const timestamp = new Date();
      timestamp.setSeconds(0, 0); // Round to minute

      const ohlcData = [];

      // Process each tracked item
      for (const item of this.ITEMS_TO_TRACK) {
        const price = this.extractPrice(latestRates, item.code, item.type);

        if (price !== null) {
          ohlcData.push({
            itemCode: item.code,
            itemType: item.type,
            timeframe: '1m',
            timestamp,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
            source: 'api',
            isComplete: true,
            hasMissingData: false,
          });
        }
      }

      // Save to database
      await this.ohlcManager.saveOHLCData(ohlcData);

      this.logger.log(`Collected ${ohlcData.length} minute OHLC records`);
    } catch (error) {
      this.logger.error('Failed to collect minute data', error);
    }
  }

  /**
   * Aggregate to higher timeframes every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async aggregateTimeframes(): Promise<void> {
    this.logger.log('Starting timeframe aggregation');

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 3600000); // Last hour

    try {
      for (const item of this.ITEMS_TO_TRACK) {
        // Aggregate 1m -> 5m
        await this.ohlcManager.aggregateTimeframes(
          item.code,
          item.type,
          '1m',
          '5m',
          startDate,
          endDate,
        );

        // Aggregate 5m -> 15m
        await this.ohlcManager.aggregateTimeframes(
          item.code,
          item.type,
          '5m',
          '15m',
          startDate,
          endDate,
        );
      }

      this.logger.log('Timeframe aggregation completed');
    } catch (error) {
      this.logger.error('Failed to aggregate timeframes', error);
    }
  }

  /**
   * Daily aggregation and cleanup
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyAggregation(): Promise<void> {
    this.logger.log('Starting daily aggregation');

    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate.getTime() - 86400000); // Yesterday

    try {
      for (const item of this.ITEMS_TO_TRACK) {
        // Aggregate 1h -> 1d
        await this.ohlcManager.aggregateTimeframes(
          item.code,
          item.type,
          '1h',
          '1d',
          startDate,
          endDate,
        );

        // Check and fill missing data
        await this.ohlcManager.fillMissingData(
          item.code,
          item.type,
          '1d',
          new Date(endDate.getTime() - 30 * 86400000), // Last 30 days
          endDate,
        );
      }

      this.logger.log('Daily aggregation completed');
    } catch (error) {
      this.logger.error('Failed to perform daily aggregation', error);
    }
  }

  /**
   * Backfill historical data from Navasan API
   */
  async backfillHistoricalData(
    itemCode: string,
    itemType: string,
    timeRange: string,
  ): Promise<void> {
    this.logger.log(`Backfilling ${itemCode} for ${timeRange}`);

    try {
      // Fetch from Navasan API
      const chartData = await this.chartService.getChartData(
        itemCode,
        timeRange,
        itemType,
      );

      if (!chartData || chartData.length === 0) {
        this.logger.warn(`No data available for ${itemCode}`);
        return;
      }

      // Convert to OHLC format
      const ohlcData = chartData.map(point => ({
        itemCode,
        itemType,
        timeframe: this.determineTimeframe(timeRange),
        timestamp: new Date(point.timestamp),
        open: point.open || point.value,
        high: point.high || point.value,
        low: point.low || point.value,
        close: point.close || point.value,
        volume: point.volume || 0,
        source: 'api',
        isComplete: !!(point.open && point.high && point.low && point.close),
        hasMissingData: false,
      }));

      // Save to database
      await this.ohlcManager.saveOHLCData(ohlcData);

      this.logger.log(`Backfilled ${ohlcData.length} records for ${itemCode}`);
    } catch (error) {
      this.logger.error(`Failed to backfill ${itemCode}`, error);
      throw error;
    }
  }

  private extractPrice(data: any, itemCode: string, itemType: string): number | null {
    // Extract price based on item type and code
    try {
      if (itemType === 'currency') {
        return parseFloat(data[itemCode.toLowerCase()]?.value || 0);
      } else if (itemType === 'crypto') {
        return parseFloat(data[itemCode.toLowerCase()]?.value || 0);
      } else if (itemType === 'gold') {
        return parseFloat(data[itemCode.toLowerCase()]?.value || 0);
      }
    } catch (error) {
      this.logger.warn(`Failed to extract price for ${itemCode}`);
    }
    return null;
  }

  private determineTimeframe(timeRange: string): string {
    const mapping = {
      '1d': '15m',
      '1w': '1h',
      '1m': '1h',
      '3m': '1d',
      '1y': '1d',
      'all': '1w',
    };
    return mapping[timeRange] || '1h';
  }
}
```

---

## Phase 3: Data Update Mechanisms

### Step 3.1: Create Update Strategy Service

**File:** `apps/backend/src/ohlc/ohlc-update.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OHLCManagerService } from './ohlc-manager.service';

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
    itemType: string,
    currentPrice: number,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's OHLC record
    const todayRecord = await this.ohlcManager.getOHLCData(
      itemCode,
      itemType,
      '1d',
      today,
      new Date(today.getTime() + 86400000),
    );

    if (todayRecord.length === 0) {
      // Create new record for today
      await this.ohlcManager.saveOHLCData([{
        itemCode,
        itemType,
        timeframe: '1d',
        timestamp: today,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        source: 'api',
        isComplete: false, // Not complete until day ends
      }]);
    } else {
      // Update existing record
      const record = todayRecord[0];
      await this.ohlcManager.saveOHLCData([{
        itemCode,
        itemType,
        timeframe: '1d',
        timestamp: today,
        open: record.open, // Keep original open
        high: Math.max(record.high, currentPrice),
        low: Math.min(record.low, currentPrice),
        close: currentPrice, // Update close
        source: 'api',
        isComplete: false,
      }]);
    }
  }

  /**
   * Correct historical data when discrepancies found
   */
  async correctHistoricalData(
    itemCode: string,
    itemType: string,
    corrections: Array<{
      timestamp: Date;
      open?: number;
      high?: number;
      low?: number;
      close?: number;
    }>,
  ): Promise<void> {
    const bulkOps = corrections.map(correction => ({
      updateOne: {
        filter: {
          itemCode,
          itemType,
          timestamp: correction.timestamp,
        },
        update: {
          $set: {
            ...(correction.open && { open: correction.open }),
            ...(correction.high && { high: correction.high }),
            ...(correction.low && { low: correction.low }),
            ...(correction.close && { close: correction.close }),
            lastUpdated: new Date(),
            source: 'corrected',
          },
          $inc: { updateCount: 1 },
        },
      },
    }));

    await this.ohlcManager.ohlcPermanentModel.bulkWrite(bulkOps);

    this.logger.log(`Corrected ${corrections.length} historical records for ${itemCode}`);
  }

  /**
   * Merge new API data with existing database records
   */
  async mergeApiData(
    itemCode: string,
    itemType: string,
    apiData: any[],
    timeframe: string,
  ): Promise<void> {
    // Get date range from API data
    const timestamps = apiData.map(d => new Date(d.timestamp));
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
      const timestamp = new Date(apiRecord.timestamp);
      const existing = existingMap.get(timestamp.toISOString());

      if (!existing) {
        // New record
        return {
          itemCode,
          itemType,
          timeframe,
          timestamp,
          open: apiRecord.open,
          high: apiRecord.high,
          low: apiRecord.low,
          close: apiRecord.close,
          volume: apiRecord.volume || 0,
          source: 'api',
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
          source: 'api',
          isComplete: true,
          hasMissingData: false,
        };
      }

      return null; // No update needed
    }).filter(Boolean);

    if (mergedData.length > 0) {
      await this.ohlcManager.saveOHLCData(mergedData);
      this.logger.log(`Merged ${mergedData.length} records for ${itemCode}`);
    }
  }

  private shouldUpdateRecord(existing: any, apiData: any): boolean {
    // Update if:
    // 1. Source was 'interpolated' or 'calculated'
    // 2. Data is marked as incomplete
    // 3. API has more complete data
    return (
      existing.source === 'interpolated' ||
      existing.source === 'calculated' ||
      !existing.isComplete ||
      existing.hasMissingData ||
      (apiData.volume && !existing.volume)
    );
  }
}
```

---

## Phase 4: Query and Retrieval System

### Step 4.1: Enhanced Chart Service

**File:** `apps/backend/src/chart/chart.service.enhanced.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { OHLCManagerService } from '../ohlc/ohlc-manager.service';

@Injectable()
export class EnhancedChartService {
  constructor(
    private readonly ohlcManager: OHLCManagerService,
  ) {}

  /**
   * Get chart data - Database first, API fallback
   */
  async getChartData(
    itemCode: string,
    timeRange: string,
    itemType: string,
  ): Promise<any[]> {
    const { startDate, endDate, timeframe } = this.parseTimeRange(timeRange);

    // 1. Try to get from permanent database
    const dbData = await this.ohlcManager.getOHLCData(
      itemCode,
      itemType,
      timeframe,
      startDate,
      endDate,
    );

    if (dbData && dbData.length > 0) {
      // Check data completeness
      const coverage = this.calculateCoverage(dbData, startDate, endDate, timeframe);

      if (coverage >= 0.8) {
        // 80% or more coverage - use database data
        return this.formatChartData(dbData);
      }
    }

    // 2. Fallback to API if database doesn't have enough data
    const apiData = await this.fetchFromApi(itemCode, timeRange, itemType);

    if (apiData && apiData.length > 0) {
      // Save API data to database for future use
      await this.ohlcManager.saveOHLCData(
        this.convertApiToOHLC(apiData, itemCode, itemType, timeframe)
      );

      return apiData;
    }

    // 3. Return partial data if available
    if (dbData && dbData.length > 0) {
      return this.formatChartData(dbData);
    }

    throw new Error('No data available');
  }

  /**
   * Get real-time chart updates
   */
  async getRealTimeUpdate(
    itemCode: string,
    itemType: string,
  ): Promise<any> {
    const now = new Date();
    const minuteAgo = new Date(now.getTime() - 60000);

    const latestData = await this.ohlcManager.getOHLCData(
      itemCode,
      itemType,
      '1m',
      minuteAgo,
      now,
    );

    if (latestData.length > 0) {
      return this.formatChartData(latestData)[0];
    }

    return null;
  }

  private parseTimeRange(timeRange: string): {
    startDate: Date;
    endDate: Date;
    timeframe: string;
  } {
    const now = new Date();
    let startDate: Date;
    let timeframe: string;

    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 86400000);
        timeframe = '15m';
        break;
      case '1w':
        startDate = new Date(now.getTime() - 604800000);
        timeframe = '1h';
        break;
      case '1m':
        startDate = new Date(now.getTime() - 2592000000);
        timeframe = '1h';
        break;
      case '3m':
        startDate = new Date(now.getTime() - 7776000000);
        timeframe = '1d';
        break;
      case '1y':
        startDate = new Date(now.getTime() - 31536000000);
        timeframe = '1d';
        break;
      default:
        startDate = new Date(0);
        timeframe = '1w';
    }

    return { startDate, endDate: now, timeframe };
  }

  private calculateCoverage(
    data: any[],
    startDate: Date,
    endDate: Date,
    timeframe: string,
  ): number {
    const expectedPoints = this.getExpectedDataPoints(startDate, endDate, timeframe);
    const actualPoints = data.filter(d => !d.hasMissingData).length;
    return actualPoints / expectedPoints;
  }

  private getExpectedDataPoints(
    startDate: Date,
    endDate: Date,
    timeframe: string,
  ): number {
    const duration = endDate.getTime() - startDate.getTime();
    const intervals = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '1d': 86400000,
      '1w': 604800000,
    };

    return Math.floor(duration / intervals[timeframe]);
  }

  private formatChartData(data: any[]): any[] {
    return data.map(item => ({
      timestamp: item.timestamp.toISOString(),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      metadata: {
        source: item.source,
        isComplete: item.isComplete,
        hasMissingData: item.hasMissingData,
      },
    }));
  }

  private convertApiToOHLC(
    apiData: any[],
    itemCode: string,
    itemType: string,
    timeframe: string,
  ): any[] {
    return apiData.map(item => ({
      itemCode,
      itemType,
      timeframe,
      timestamp: new Date(item.timestamp),
      open: item.open || item.value,
      high: item.high || item.value,
      low: item.low || item.value,
      close: item.close || item.value,
      volume: item.volume || 0,
      source: 'api',
      isComplete: true,
      hasMissingData: false,
    }));
  }

  private async fetchFromApi(
    itemCode: string,
    timeRange: string,
    itemType: string,
  ): Promise<any[]> {
    // Implementation to fetch from Navasan API
    // This would use the existing chart service logic
    return [];
  }
}
```

### Step 4.2: API Controller Updates

**File:** `apps/backend/src/chart/chart.controller.enhanced.ts`

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { EnhancedChartService } from './chart.service.enhanced';

@Controller('api/chart')
export class EnhancedChartController {
  constructor(
    private readonly chartService: EnhancedChartService,
  ) {}

  @Get(':currencyCode')
  async getChartData(
    @Param('currencyCode') currencyCode: string,
    @Query('timeRange') timeRange: string = '1m',
    @Query('itemType') itemType: string = 'currency',
    @Query('source') source: string = 'auto', // 'auto' | 'db' | 'api'
  ) {
    return this.chartService.getChartData(currencyCode, timeRange, itemType);
  }

  @Get(':currencyCode/realtime')
  async getRealTimeUpdate(
    @Param('currencyCode') currencyCode: string,
    @Query('itemType') itemType: string = 'currency',
  ) {
    return this.chartService.getRealTimeUpdate(currencyCode, itemType);
  }

  @Get('backfill/:currencyCode')
  async triggerBackfill(
    @Param('currencyCode') currencyCode: string,
    @Query('timeRange') timeRange: string = '1m',
    @Query('itemType') itemType: string = 'currency',
  ) {
    // Trigger backfill process
    // This would be protected by admin authentication
    return { message: 'Backfill initiated' };
  }
}
```

---

## Phase 5: Migration and Backfill

### Step 5.1: Migration Script

**File:** `apps/backend/src/scripts/migrate-ohlc-data.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OHLCCollectorService } from '../ohlc/ohlc-collector.service';

async function migrateOHLCData() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const collectorService = app.get(OHLCCollectorService);

  const ITEMS = [
    // List all items to migrate
    { code: 'USD_SELL', type: 'currency' },
    { code: 'EUR', type: 'currency' },
    // ... add all items
  ];

  const TIME_RANGES = ['1d', '1w', '1m', '3m', '1y'];

  console.log('Starting OHLC data migration...');

  for (const item of ITEMS) {
    console.log(`Processing ${item.code}...`);

    for (const timeRange of TIME_RANGES) {
      try {
        await collectorService.backfillHistoricalData(
          item.code,
          item.type,
          timeRange,
        );

        console.log(`  ✓ ${timeRange} completed`);

        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ✗ ${timeRange} failed:`, error.message);
      }
    }
  }

  console.log('Migration completed!');
  await app.close();
}

// Run the migration
migrateOHLCData().catch(console.error);
```

### Step 5.2: Backfill Command

**File:** `package.json` - Add script

```json
{
  "scripts": {
    "backend:migrate-ohlc": "ts-node apps/backend/src/scripts/migrate-ohlc-data.ts"
  }
}
```

---

## Phase 6: Frontend Integration

### Step 6.1: Update API Hooks

**File:** `apps/frontend/src/lib/store/services/api.enhanced.ts`

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const enhancedApi = createApi({
  reducerPath: 'enhancedApi',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  }),
  tagTypes: ['Chart', 'Realtime'],
  endpoints: (builder) => ({
    getChartData: builder.query({
      query: ({ itemCode, timeRange, itemType }) => ({
        url: `/chart/${itemCode}`,
        params: { timeRange, itemType },
      }),
      providesTags: ['Chart'],
    }),

    getRealTimeUpdate: builder.query({
      query: ({ itemCode, itemType }) => ({
        url: `/chart/${itemCode}/realtime`,
        params: { itemType },
      }),
      providesTags: ['Realtime'],
      // Poll every minute for real-time updates
      pollingInterval: 60000,
    }),
  }),
});

export const {
  useGetChartDataQuery,
  useGetRealTimeUpdateQuery,
} = enhancedApi;
```

### Step 6.2: Enhanced Chart Component

**File:** `apps/frontend/src/components/Chart/EnhancedPriceChart.tsx`

```typescript
import React, { useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useGetChartDataQuery, useGetRealTimeUpdateQuery } from '@/lib/store/services/api.enhanced';

interface EnhancedPriceChartProps {
  itemCode: string;
  itemType: string;
  timeRange: string;
  enableRealTime?: boolean;
}

export const EnhancedPriceChart: React.FC<EnhancedPriceChartProps> = ({
  itemCode,
  itemType,
  timeRange,
  enableRealTime = false,
}) => {
  // Fetch historical data
  const { data: chartData, isLoading } = useGetChartDataQuery({
    itemCode,
    timeRange,
    itemType,
  });

  // Fetch real-time updates if enabled
  const { data: realtimeData } = useGetRealTimeUpdateQuery(
    { itemCode, itemType },
    { skip: !enableRealTime }
  );

  // Merge real-time data with historical
  const mergedData = useMemo(() => {
    if (!chartData) return [];

    const data = [...chartData];

    if (realtimeData && enableRealTime) {
      // Update or append real-time data
      const lastIndex = data.length - 1;
      const lastTimestamp = new Date(data[lastIndex]?.timestamp);
      const rtTimestamp = new Date(realtimeData.timestamp);

      if (rtTimestamp > lastTimestamp) {
        data.push(realtimeData);
      } else if (rtTimestamp.getTime() === lastTimestamp.getTime()) {
        data[lastIndex] = realtimeData;
      }
    }

    return data;
  }, [chartData, realtimeData, enableRealTime]);

  const option = useMemo(() => {
    if (!mergedData || mergedData.length === 0) {
      return {};
    }

    // Format data for ECharts candlestick
    const ohlcData = mergedData.map(item => [
      item.timestamp,
      item.open,
      item.close,
      item.low,
      item.high,
    ]);

    return {
      title: {
        text: `${itemCode} - ${timeRange}`,
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: any) => {
          const data = params[0].data;
          return `
            <div>
              <strong>${new Date(data[0]).toLocaleString()}</strong><br/>
              Open: ${data[1]}<br/>
              High: ${data[4]}<br/>
              Low: ${data[3]}<br/>
              Close: ${data[2]}
            </div>
          `;
        },
      },
      xAxis: {
        type: 'time',
      },
      yAxis: {
        type: 'value',
        scale: true,
      },
      series: [
        {
          type: 'candlestick',
          data: ohlcData,
          itemStyle: {
            color: '#26a69a',
            color0: '#ef5350',
            borderColor: '#26a69a',
            borderColor0: '#ef5350',
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 50,
          end: 100,
        },
        {
          show: true,
          type: 'slider',
          top: '90%',
          start: 50,
          end: 100,
        },
      ],
    };
  }, [mergedData, itemCode, timeRange]);

  if (isLoading) {
    return <div>Loading chart data...</div>;
  }

  return (
    <div className="relative">
      <ReactECharts
        option={option}
        style={{ height: '400px' }}
        opts={{ renderer: 'canvas' }}
      />

      {enableRealTime && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-600">Live</span>
        </div>
      )}

      {mergedData.some(d => d.metadata?.hasMissingData) && (
        <div className="text-xs text-yellow-600 mt-2">
          ⚠ Some data points are interpolated
        </div>
      )}
    </div>
  );
};
```

---

## 7. Testing Strategy

### Unit Tests

```typescript
// ohlc-manager.service.spec.ts
describe('OHLCManagerService', () => {
  it('should save OHLC data correctly', async () => {
    // Test save functionality
  });

  it('should aggregate timeframes correctly', async () => {
    // Test aggregation logic
  });

  it('should identify and fill gaps', async () => {
    // Test gap detection and interpolation
  });
});
```

### Integration Tests

```typescript
// chart.e2e-spec.ts
describe('Chart API (e2e)', () => {
  it('should return data from database first', async () => {
    // Test database-first strategy
  });

  it('should fallback to API when database empty', async () => {
    // Test API fallback
  });

  it('should update database with API data', async () => {
    // Test data synchronization
  });
});
```

---

## 8. Monitoring and Maintenance

### Monitoring Dashboard Queries

```javascript
// MongoDB queries for monitoring

// Check data coverage
db.ohlc_permanent.aggregate([
  {
    $group: {
      _id: { itemCode: "$itemCode", timeframe: "$timeframe" },
      count: { $sum: 1 },
      firstDate: { $min: "$timestamp" },
      lastDate: { $max: "$timestamp" },
      gaps: { $sum: { $cond: ["$hasMissingData", 1, 0] } }
    }
  }
]);

// Check update frequency
db.ohlc_permanent.aggregate([
  {
    $match: {
      lastUpdated: { $gte: new Date(Date.now() - 3600000) }
    }
  },
  {
    $group: {
      _id: "$itemCode",
      updates: { $sum: 1 }
    }
  }
]);
```

### Maintenance Tasks

1. **Daily Tasks**
   - Verify data completeness
   - Check for gaps in recent data
   - Monitor API failure rates

2. **Weekly Tasks**
   - Aggregate old minute data to save space
   - Clean up interpolated data that can be replaced
   - Review data quality metrics

3. **Monthly Tasks**
   - Archive old high-frequency data
   - Optimize database indexes
   - Review storage usage

---

## 9. Timeline and Milestones

### Week 1 (Days 1-7)
- **Day 1-2:** Database schema setup (Phase 1)
- **Day 3-5:** Data collection service (Phase 2)
- **Day 6-7:** Update mechanisms (Phase 3 partial)

### Week 2 (Days 8-14)
- **Day 8-9:** Complete update mechanisms (Phase 3)
- **Day 10-11:** Query system (Phase 4)
- **Day 12:** Migration and backfill (Phase 5)
- **Day 13-14:** Frontend integration (Phase 6)

### Milestones
- ✅ **Milestone 1:** Database ready with schemas (Day 2)
- ✅ **Milestone 2:** Real-time collection working (Day 5)
- ✅ **Milestone 3:** Historical data migrated (Day 12)
- ✅ **Milestone 4:** Frontend displaying DB data (Day 14)

---

## 10. Environment Variables

Add to `.env`:

```bash
# OHLC Configuration
OHLC_COLLECTION_ENABLED=true
OHLC_REALTIME_ENABLED=true
OHLC_AGGREGATION_ENABLED=true
OHLC_BACKFILL_ON_STARTUP=false
OHLC_RETENTION_DAYS=365
OHLC_HIGH_FREQ_RETENTION_DAYS=30

# Collection intervals
OHLC_MINUTE_COLLECTION_INTERVAL=1
OHLC_AGGREGATION_INTERVAL=5
OHLC_DAILY_AGGREGATION_HOUR=0

# Data sources priority
OHLC_DATA_SOURCE_PRIORITY=db,api,cache
```

---

## 11. API Documentation

### New Endpoints

```yaml
# Get OHLC data
GET /api/chart/{itemCode}
  Parameters:
    - timeRange: 1d|1w|1m|3m|1y|all
    - itemType: currency|crypto|gold
    - source: auto|db|api
  Response:
    - Array of OHLC points with metadata

# Get real-time updates
GET /api/chart/{itemCode}/realtime
  Parameters:
    - itemType: currency|crypto|gold
  Response:
    - Latest OHLC point

# Trigger backfill (Admin only)
POST /api/chart/backfill/{itemCode}
  Parameters:
    - timeRange: 1d|1w|1m|3m|1y|all
    - itemType: currency|crypto|gold
  Response:
    - Backfill status

# Get data coverage report
GET /api/chart/coverage
  Response:
    - Coverage statistics per item and timeframe
```

---

## 12. Troubleshooting Guide

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Missing data points | API failures during collection | Run backfill for affected period |
| Incorrect OHLC values | Race condition in updates | Implement transaction locks |
| Slow chart loading | Large dataset queries | Add pagination and caching |
| Real-time lag | Collection interval too long | Reduce to 30-second intervals |
| Storage growing fast | Too much high-freq data | Implement aggregation cleanup |

---

## 13. Code Snippets for Quick Implementation

### Quick Start Commands

```bash
# 1. Install dependencies
npm install

# 2. Generate schemas
npm run backend:generate-schemas

# 3. Run migration
npm run backend:migrate-ohlc

# 4. Start collection
npm run backend:start

# 5. Monitor logs
npm run backend:logs -- --follow
```

### MongoDB Index Creation

```javascript
// Run in MongoDB shell
db.ohlc_permanent.createIndex(
  { itemCode: 1, itemType: 1, timeframe: 1, timestamp: 1 },
  { unique: true }
);

db.ohlc_permanent.createIndex({ itemCode: 1, timestamp: 1 });
db.ohlc_permanent.createIndex({ lastUpdated: 1 });
db.ohlc_permanent.createIndex({ timestamp: 1 });
```

---

## Conclusion

This implementation plan provides a robust, scalable solution for managing OHLC data in your currency exchange application. The phased approach ensures minimal disruption to existing functionality while gradually enhancing the system with permanent storage, intelligent updates, and efficient retrieval mechanisms.

**Key Benefits:**
- ✅ Permanent historical data storage
- ✅ Real-time data collection and updates
- ✅ Efficient aggregation across timeframes
- ✅ Database-first approach with API fallback
- ✅ Data quality tracking and gap filling
- ✅ Scalable architecture for future growth

Follow this plan step-by-step, and you'll have a production-ready OHLC data management system that can handle millions of data points efficiently.