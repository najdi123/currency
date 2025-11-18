# Database Schemas - Phase 2 Implementation

## Overview

This directory contains the new simplified database schema architecture with 4 clean collections designed for optimal performance and automatic data retention.

## Schema Files

### 1. `tracked-item.schema.ts`
Configuration for tracked items (currencies, crypto, gold, coins).

**Purpose**: Define which items to track and their metadata.

**Usage Example**:
```typescript
import { TrackedItem, TrackedItemDocument } from '@/schemas';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ItemService {
  constructor(
    @InjectModel(TrackedItem.name)
    private trackedItemModel: Model<TrackedItemDocument>,
  ) {}

  async getActiveItems() {
    return this.trackedItemModel.find({ isActive: true });
  }

  async addNewItem(code: string, type: string, name: string) {
    return this.trackedItemModel.create({
      code,
      type,
      name,
      isActive: true,
      metadata: {},
    });
  }
}
```

---

### 2. `current-price.schema.ts`
Latest price for each tracked item (upsert pattern).

**Purpose**: Store the current price for each item (one record per item).

**Usage Example**:
```typescript
import { CurrentPrice, CurrentPriceDocument } from '@/schemas';

@Injectable()
export class PriceService {
  constructor(
    @InjectModel(CurrentPrice.name)
    private currentPriceModel: Model<CurrentPriceDocument>,
  ) {}

  async updatePrice(itemCode: string, price: number, source: string) {
    return this.currentPriceModel.updateOne(
      { itemCode },
      {
        $set: {
          price,
          priceTimestamp: new Date(),
          source,
        },
        $setOnInsert: {
          itemCode,
          change: 0,
        },
      },
      { upsert: true }
    );
  }

  async getCurrentPrice(itemCode: string) {
    return this.currentPriceModel.findOne({ itemCode });
  }
}
```

---

### 3. `intraday-ohlc.schema.ts`
Today's OHLC data with automatic 48-hour TTL cleanup.

**Purpose**: Track today's open, high, low, close prices.

**Usage Example**:
```typescript
import { IntradayOhlc, IntradayOhlcDocument } from '@/schemas';
import * as moment from 'moment-timezone';

@Injectable()
export class IntradayService {
  constructor(
    @InjectModel(IntradayOhlc.name)
    private intradayOhlcModel: Model<IntradayOhlcDocument>,
  ) {}

  async updateTodayOhlc(itemCode: string, price: number) {
    const today = moment().tz('Asia/Tehran').startOf('day').toDate();
    const expiresAt = moment(today).add(48, 'hours').toDate();

    return this.intradayOhlcModel.updateOne(
      { itemCode, date: today },
      {
        $setOnInsert: {
          itemCode,
          date: today,
          open: price,
          expiresAt,
        },
        $max: { high: price },
        $min: { low: price },
        $set: { close: price, lastUpdate: new Date() },
        $inc: { updateCount: 1 },
      },
      { upsert: true }
    );
  }

  async getTodayOhlc(itemCode: string) {
    const today = moment().tz('Asia/Tehran').startOf('day').toDate();
    return this.intradayOhlcModel.findOne({ itemCode, date: today });
  }
}
```

---

### 4. `historical-ohlc.schema.ts`
Long-term tiered storage (hourly, daily, weekly, monthly).

**Purpose**: Store historical OHLC data with different timeframes.

**Usage Example**:
```typescript
import { HistoricalOhlc, HistoricalOhlcDocument, OhlcTimeframe } from '@/schemas';

@Injectable()
export class HistoricalService {
  constructor(
    @InjectModel(HistoricalOhlc.name)
    private historicalOhlcModel: Model<HistoricalOhlcDocument>,
  ) {}

  async saveHistoricalData(
    itemCode: string,
    timeframe: OhlcTimeframe,
    periodStart: Date,
    periodEnd: Date,
    ohlc: { open: number; high: number; low: number; close: number }
  ) {
    return this.historicalOhlcModel.create({
      itemCode,
      timeframe,
      periodStart,
      periodEnd,
      ...ohlc,
      dataPoints: 1,
    });
  }

  async getHistoricalRange(
    itemCode: string,
    timeframe: OhlcTimeframe,
    startDate: Date,
    endDate: Date
  ) {
    return this.historicalOhlcModel
      .find({
        itemCode,
        timeframe,
        periodStart: { $gte: startDate, $lte: endDate },
      })
      .sort({ periodStart: 1 })
      .lean();
  }
}
```

---

### 5. `schemas.module.ts`
NestJS module for schema registration.

**Purpose**: Centralized module for all schemas.

**Usage Example**:
```typescript
import { SchemasModule } from '@/schemas';

@Module({
  imports: [
    SchemasModule,  // Import schemas
    // ... other imports
  ],
  controllers: [MyController],
  providers: [MyService],
})
export class MyFeatureModule {}
```

---

### 6. `index.ts`
Barrel export for clean imports.

**Purpose**: Simplify imports from a single location.

**Usage Example**:
```typescript
// Instead of:
import { TrackedItem } from './schemas/tracked-item.schema';
import { CurrentPrice } from './schemas/current-price.schema';
import { IntradayOhlc } from './schemas/intraday-ohlc.schema';

// Use:
import {
  TrackedItem,
  CurrentPrice,
  IntradayOhlc,
  HistoricalOhlc,
  OhlcTimeframe,
  SchemasModule
} from '@/schemas';
```

---

## Module Integration

To use these schemas in a NestJS module:

```typescript
import { Module } from '@nestjs/common';
import { SchemasModule } from '@/schemas';
import { MyService } from './my.service';

@Module({
  imports: [SchemasModule],
  providers: [MyService],
  exports: [MyService],
})
export class MyModule {}
```

---

## Indexes

All schemas include optimized indexes for common query patterns:

### TrackedItem Indexes
- `{ code: 1 }` (unique) - Primary lookup
- `{ type: 1, isActive: 1 }` - Filter queries

### CurrentPrice Indexes
- `{ itemCode: 1 }` (unique) - Primary lookup
- `{ priceTimestamp: -1 }` - Time-based queries
- `{ updatedAt: -1 }` - Recent updates

### IntradayOhlc Indexes
- `{ itemCode: 1, date: -1 }` - Compound query
- `{ expiresAt: 1 }` - TTL cleanup

### HistoricalOhlc Indexes
- `{ itemCode: 1, timeframe: 1, periodStart: -1 }` - Primary queries
- `{ itemCode: 1, periodStart: -1 }` - Cross-timeframe queries
- `{ expiresAt: 1 }` - TTL cleanup (optional)

---

## Data Retention Policies

### TrackedItems
- **Retention**: Permanent
- **Cleanup**: Manual (admin removes items)

### CurrentPrices
- **Retention**: Permanent (upsert pattern keeps only latest)
- **Cleanup**: None needed (constant size)

### IntradayOhlc
- **Retention**: 48 hours
- **Cleanup**: Automatic via MongoDB TTL index

### HistoricalOhlc
- **Retention**: Tiered
  - Hourly: 7 days
  - Daily: 90 days
  - Weekly: 1 year
  - Monthly: Forever
- **Cleanup**: TTL index + scheduled aggregation job

---

## TypeScript Types

All schemas export proper TypeScript types:

```typescript
// Document types (includes Mongoose Document methods)
import {
  TrackedItemDocument,
  CurrentPriceDocument,
  IntradayOhlcDocument,
  HistoricalOhlcDocument
} from '@/schemas';

// Schema classes (for model injection)
import {
  TrackedItem,
  CurrentPrice,
  IntradayOhlc,
  HistoricalOhlc
} from '@/schemas';

// Enums
import { OhlcTimeframe } from '@/schemas';

// Usage in service
@Injectable()
export class MyService {
  constructor(
    @InjectModel(TrackedItem.name)
    private model: Model<TrackedItemDocument>,  // Use Document type here
  ) {}

  async getItem(code: string): Promise<TrackedItemDocument | null> {
    return this.model.findOne({ code });
  }
}
```

---

## Query Patterns

### Get Current Price
```typescript
const price = await this.currentPriceModel.findOne({ itemCode: 'usd_sell' });
```

### Get All Active Items
```typescript
const items = await this.trackedItemModel.find({ isActive: true });
```

### Get Today's OHLC
```typescript
const today = moment().tz('Asia/Tehran').startOf('day').toDate();
const ohlc = await this.intradayOhlcModel.findOne({ itemCode: 'usd_sell', date: today });
```

### Get Historical Range
```typescript
const data = await this.historicalOhlcModel.find({
  itemCode: 'usd_sell',
  timeframe: OhlcTimeframe.DAILY,
  periodStart: { $gte: startDate, $lte: endDate }
}).sort({ periodStart: 1 });
```

### Update Current Price (Upsert)
```typescript
await this.currentPriceModel.updateOne(
  { itemCode: 'usd_sell' },
  {
    $set: { price: 42500, priceTimestamp: new Date() },
    $setOnInsert: { itemCode: 'usd_sell' }
  },
  { upsert: true }
);
```

### Update OHLC (Atomic Operations)
```typescript
await this.intradayOhlcModel.updateOne(
  { itemCode: 'usd_sell', date: today },
  {
    $setOnInsert: { open: price },
    $max: { high: price },
    $min: { low: price },
    $set: { close: price },
    $inc: { updateCount: 1 }
  },
  { upsert: true }
);
```

---

## Migration from Old Schema

When migrating from the old Navasan schema:

1. **Keep old schemas intact** - Don't delete until migration is complete
2. **Run services in parallel** - Write to both old and new schemas
3. **Backfill data** - Use migration scripts to populate new collections
4. **Verify integrity** - Compare data between old and new
5. **Cutover** - Switch reads to new schema
6. **Archive old data** - Keep backups before deletion

See `PHASE_2_SCHEMA_IMPLEMENTATION_COMPLETE.md` for detailed migration steps.

---

## Best Practices

### 1. Use Atomic Operations
```typescript
// GOOD: Atomic upsert
await model.updateOne(filter, update, { upsert: true });

// BAD: Find-then-update (race condition)
const doc = await model.findOne(filter);
if (doc) {
  doc.field = value;
  await doc.save();
}
```

### 2. Use Compound Indexes
```typescript
// GOOD: Filter by timeframe first
.find({ itemCode: 'usd', timeframe: 'daily', periodStart: { $gte: date } })

// BAD: Missing timeframe filter
.find({ itemCode: 'usd', periodStart: { $gte: date } })
```

### 3. Set TTL expiresAt Correctly
```typescript
// GOOD: Set expiresAt to specific time
const expiresAt = moment(date).add(48, 'hours').toDate();

// BAD: Relative time (TTL counts from document creation)
const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
```

---

## Testing

Unit tests should verify:
- Schema validation (required fields, enums)
- Index creation
- Upsert behavior
- TTL cleanup (integration test)

Example test:
```typescript
describe('CurrentPriceSchema', () => {
  it('should enforce unique itemCode', async () => {
    await model.create({ itemCode: 'usd', price: 42000 });
    await expect(
      model.create({ itemCode: 'usd', price: 42500 })
    ).rejects.toThrow();
  });

  it('should upsert successfully', async () => {
    await model.updateOne(
      { itemCode: 'usd' },
      { $set: { price: 42000 } },
      { upsert: true }
    );

    const count = await model.countDocuments({ itemCode: 'usd' });
    expect(count).toBe(1);
  });
});
```

---

## Performance Monitoring

Key metrics to track:
- Index hit rate (should be >95%)
- Query latency (p95 should be <100ms)
- Collection size growth
- TTL cleanup frequency

---

## Related Documentation

- `PHASE_2_SCHEMA_IMPLEMENTATION_COMPLETE.md` - Implementation details and verification
- `DATABASE_SCHEMA_DIAGRAM.md` - Visual architecture and data flow
- `IMPLEMENTATION_PLAN.md` - Overall project roadmap

---

## Status

✓ All schemas implemented
✓ TypeScript compilation successful
✓ Indexes properly defined
✓ Module integration complete
✓ Ready for Phase 3 (Service Layer Implementation)
