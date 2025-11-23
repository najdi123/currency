# Database Schema Architecture Diagram

## Overview

This document provides a visual representation of the new database schema architecture with clear relationships and data flow.

---

## Schema Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEW DATABASE ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│   TRACKED_ITEMS          │  Configuration Layer
│  (100 records)           │  - What to track
├──────────────────────────┤  - Item metadata
│ • code (PK, unique)      │  - Active/inactive status
│ • type (enum)            │
│ • name                   │  Relationships:
│ • metadata               │  └─> Referenced by all other collections
│ • isActive               │      via "itemCode" field
│ • lastPriceUpdate        │
│ • timestamps             │
└──────────────────────────┘
         │
         │ Referenced by (1:1)
         ├─────────────────────────────────────┬─────────────────────┐
         │                                     │                     │
         ▼                                     ▼                     ▼
┌──────────────────────────┐    ┌──────────────────────────┐   ┌──────────────────────────┐
│   CURRENT_PRICES         │    │   INTRADAY_OHLC          │   │   HISTORICAL_OHLC        │
│  (100 records)           │    │  (~200 records)          │   │  (~2M records)           │
├──────────────────────────┤    ├──────────────────────────┤   ├──────────────────────────┤
│ • itemCode (PK, FK)      │    │ • itemCode (FK)          │   │ • itemCode (FK)          │
│ • price                  │    │ • date (PK)              │   │ • timeframe (PK part)    │
│ • change (%)             │    │ • open                   │   │ • periodStart (PK part)  │
│ • previousPrice          │    │ • high                   │   │ • periodEnd              │
│ • priceTimestamp         │    │ • low                    │   │ • open                   │
│ • source                 │    │ • close                  │   │ • high                   │
│ • rawData                │    │ • updateCount            │   │ • low                    │
│ • timestamps             │    │ • lastUpdate             │   │ • close                  │
└──────────────────────────┘    │ • expiresAt (TTL)        │   │ • dataPoints             │
                                │ • timestamps             │   │ • expiresAt (TTL)        │
  Latest Price                  └──────────────────────────┘   │ • timestamps             │
  (Upsert Pattern)                                             └──────────────────────────┘
  No TTL (permanent)              Today's OHLC
                                  TTL: 48 hours                  Long-term Storage
                                                                 Tiered Retention
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW PIPELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

                          ┌──────────────────┐
                          │   PersianAPI     │
                          │   Data Fetcher   │
                          └────────┬─────────┘
                                   │
                         Every 10-60 minutes (dynamic)
                                   │
                                   ▼
                ┌──────────────────────────────────────┐
                │  Price Update Service                │
                │  - Validates data                    │
                │  - Calculates changes                │
                │  - Timestamps records                │
                └──────┬────────────────────┬──────────┘
                       │                    │
            Upsert (replace)         Update OHLC
                       │                    │
                       ▼                    ▼
        ┌─────────────────────┐   ┌─────────────────────┐
        │  CURRENT_PRICES     │   │  INTRADAY_OHLC      │
        │                     │   │                     │
        │  itemCode: 'usd'    │   │  itemCode: 'usd'    │
        │  price: 42500       │   │  date: 2025-01-16   │
        │  change: 2.3%       │   │  open: 42000        │
        │  timestamp: now     │   │  high: 43000        │
        └─────────────────────┘   │  low: 41800         │
                                  │  close: 42500       │
                                  │  expiresAt: +48h    │
                                  └──────────┬──────────┘
                                             │
                                   Daily at midnight
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │  Aggregation Job     │
                                  │  - Snapshot to hist  │
                                  │  - Calculate daily   │
                                  └──────────┬───────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │  HISTORICAL_OHLC     │
                                  │                      │
                                  │  timeframe: 'daily'  │
                                  │  periodStart: date   │
                                  │  open/high/low/close │
                                  └──────────────────────┘
                                             │
                                    Tiered Aggregation
                                    (hourly → daily → weekly)
```

---

## Indexing Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                        INDEX ARCHITECTURE                         │
└──────────────────────────────────────────────────────────────────┘

TRACKED_ITEMS:
  Primary:   { code: 1 } UNIQUE          → O(1) lookup by code
  Filter:    { type: 1, isActive: 1 }    → O(log n) filtered queries

CURRENT_PRICES:
  Primary:   { itemCode: 1 } UNIQUE      → O(1) lookup by item
  Timeline:  { priceTimestamp: -1 }      → O(log n) time-based queries
  Recent:    { updatedAt: -1 }           → O(log n) recent updates

INTRADAY_OHLC:
  Compound:  { itemCode: 1, date: -1 }   → O(1) item's today OHLC
  TTL:       { expiresAt: 1 }            → Automatic cleanup

HISTORICAL_OHLC:
  Compound:  { itemCode: 1, timeframe: 1, periodStart: -1 }
             → O(log n) range queries with timeframe filter

  Timeline:  { itemCode: 1, periodStart: -1 }
             → O(log n) cross-timeframe queries

  TTL:       { expiresAt: 1 }            → Tiered retention cleanup
```

---

## TTL (Time To Live) Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│                     DATA RETENTION POLICIES                       │
└──────────────────────────────────────────────────────────────────┘

TRACKED_ITEMS:
  Retention: ∞ (Permanent)
  Reason: Configuration data, small size

CURRENT_PRICES:
  Retention: ∞ (Permanent, upsert pattern)
  Reason: Always need latest price, constant size (1 record per item)

INTRADAY_OHLC:
  Retention: 48 hours
  Mechanism: MongoDB TTL index on 'expiresAt'
  Cleanup: Automatic, every 60 seconds (MongoDB background task)

  Example:
    Document created: 2025-01-16 00:00:00
    expiresAt set to: 2025-01-18 00:00:00
    Auto-deleted after: 2025-01-18 00:00:00 (approx)

HISTORICAL_OHLC:
  Retention: Tiered based on timeframe

  ┌──────────┬──────────────┬─────────────────────────┐
  │ Timeframe│ Keep Period  │ Cleanup Method          │
  ├──────────┼──────────────┼─────────────────────────┤
  │ HOURLY   │ 7 days       │ expiresAt TTL index     │
  │ DAILY    │ 90 days      │ expiresAt TTL index     │
  │ WEEKLY   │ 1 year       │ expiresAt TTL index     │
  │ MONTHLY  │ ∞ (forever)  │ No TTL                  │
  └──────────┴──────────────┴─────────────────────────┘

  Cleanup: Automatic via TTL + manual cron for aggregation
```

---

## Storage Growth Projection

```
┌──────────────────────────────────────────────────────────────────┐
│                    STORAGE GROWTH OVER TIME                       │
└──────────────────────────────────────────────────────────────────┘

100 Tracked Items, 10-minute update frequency:

Day 1:
  tracked_items:     50 KB      (one-time)
  current_prices:    100 KB     (constant)
  intraday_ohlc:     100 KB     (2 days × 100 items)
  historical_ohlc:   500 KB     (144 records/day × 100 items)
  TOTAL:             ~750 KB

Week 1:
  tracked_items:     50 KB
  current_prices:    100 KB
  intraday_ohlc:     100 KB     (TTL keeps only 2 days)
  historical_ohlc:   3.5 MB     (7 days hourly)
  TOTAL:             ~3.75 MB

Month 1:
  tracked_items:     50 KB
  current_prices:    100 KB
  intraday_ohlc:     100 KB
  historical_ohlc:   50 MB      (30 days daily + hourly)
  TOTAL:             ~50 MB

Year 1:
  tracked_items:     50 KB
  current_prices:    100 KB
  intraday_ohlc:     100 KB
  historical_ohlc:   250 MB     (tiered: hourly 7d + daily 90d + weekly)
  TOTAL:             ~250 MB

Year 2+:
  tracked_items:     50 KB
  current_prices:    100 KB
  intraday_ohlc:     100 KB
  historical_ohlc:   500 MB     (adds monthly data, hourly/daily roll off)
  TOTAL:             ~500 MB    (plateaus due to tiered cleanup)

With MongoDB compression (70%): ~150 MB steady state
```

---

## Query Performance Characteristics

```
┌──────────────────────────────────────────────────────────────────┐
│                    QUERY PERFORMANCE MATRIX                       │
└──────────────────────────────────────────────────────────────────┘

Query Type                          Index Used              Time Complexity    Typical Latency
─────────────────────────────────────────────────────────────────────────────────────────────
Get current price for item          { itemCode: 1 }         O(1)              <5ms
Get all active items                { type: 1, isActive: 1 }O(log n)          <10ms
Get today's OHLC for item          { itemCode: 1, date: -1} O(1)              <10ms
Get historical range (1 month)      Compound index          O(log n + k)      <50ms
Get all current prices              Collection scan          O(n)              <20ms (n=100)
Update current price (upsert)       { itemCode: 1 }         O(1)              <5ms
Insert historical OHLC              Compound index          O(log n)          <10ms

Where:
  n = total documents in collection
  k = number of results returned

Assumptions:
  - MongoDB with indexes loaded in memory
  - SSD storage
  - 100 tracked items
  - 2M historical records
  - Single region deployment
```

---

## Concurrent Access Patterns

```
┌──────────────────────────────────────────────────────────────────┐
│                    CONCURRENCY HANDLING                           │
└──────────────────────────────────────────────────────────────────┘

CURRENT_PRICES (High Write Concurrency):
  Pattern: Upsert with atomic operations

  Operation:
    await currentPriceModel.updateOne(
      { itemCode: 'usd_sell' },
      {
        $set: { price: 42500, change: 2.3, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

  Concurrency: MongoDB handles atomic upserts
  Conflicts: None (last write wins)
  Lock: Document-level lock (milliseconds)

INTRADAY_OHLC (Concurrent Updates):
  Pattern: Atomic $max, $min, $set operations

  Operation:
    await intradayOhlcModel.updateOne(
      { itemCode: 'usd_sell', date: today },
      {
        $setOnInsert: { open: 42000 },
        $max: { high: 42500 },
        $min: { low: 41800 },
        $set: { close: 42500, lastUpdate: new Date() },
        $inc: { updateCount: 1 }
      },
      { upsert: true }
    );

  Concurrency: MongoDB guarantees atomic updates
  Conflicts: None (operations are commutative)
  Lock: Document-level lock (milliseconds)

HISTORICAL_OHLC (Low Write, High Read):
  Pattern: Insert-only (no updates)

  Operation:
    await historicalOhlcModel.create({
      itemCode: 'usd_sell',
      timeframe: 'daily',
      periodStart: dayStart,
      periodEnd: dayEnd,
      open, high, low, close
    });

  Concurrency: No locks on reads during inserts
  Conflicts: Unique constraint on compound key prevents duplicates
  Lock: None (insert-only pattern)
```

---

## Migration Path from Old Schema

```
┌──────────────────────────────────────────────────────────────────┐
│                    MIGRATION STRATEGY                             │
└──────────────────────────────────────────────────────────────────┘

OLD SCHEMA (navasan/schemas)        NEW SCHEMA (schemas)
──────────────────────────────      ────────────────────────

cache.schema.ts                 →   current_prices
  - Extract latest prices           - One document per item
  - Map to itemCode                 - Upsert pattern
  - Copy timestamps

price_snapshot.schema.ts        →   (Deprecated)
  - Historical snapshots            - No longer needed
  - Merge into historical_ohlc      - Aggregation handles this

ohlc_snapshot.schema.ts         →   intraday_ohlc
  - Today's snapshots               - Current day tracking
  - Calculate OHLC                  - TTL cleanup

ohlc_permanent.schema.ts        →   historical_ohlc
  - All timeframes mixed            - Separated by timeframe
  - No retention policy             - Tiered retention

daily_aggregate.schema.ts       →   historical_ohlc (daily)
  - Daily OHLC data                 - Unified with other timeframes
  - Separate collection             - Single collection

aggregation_rule.schema.ts      →   (Deprecated)
  - Configuration for jobs          - Hardcoded in service layer
  - Overly complex                  - Simpler logic

update_log.schema.ts            →   (Optional - outside schema)
  - Track updates                   - Use application logs
  - Not critical path               - Or separate logging service

Migration Steps:
  1. Create new collections (already done)
  2. Backfill tracked_items from existing item codes
  3. Copy latest prices to current_prices
  4. Aggregate historical data to new timeframe structure
  5. Verify data integrity (counts, ranges, values)
  6. Run parallel for 1 week (write to both, read from new)
  7. Cutover to new schema
  8. Archive old collections (don't delete immediately)
```

---

## Best Practices & Patterns

### 1. Upsert Pattern (Current Prices)
```typescript
// GOOD: Atomic upsert
await model.updateOne(
  { itemCode },
  { $set: { price, updatedAt: new Date() } },
  { upsert: true }
);

// BAD: Find then update (race condition)
let doc = await model.findOne({ itemCode });
if (!doc) {
  doc = await model.create({ itemCode, price });
} else {
  doc.price = price;
  await doc.save();
}
```

### 2. OHLC Calculation (Intraday)
```typescript
// GOOD: Atomic operations
await model.updateOne(
  { itemCode, date },
  {
    $setOnInsert: { open: price },
    $max: { high: price },
    $min: { low: price },
    $set: { close: price }
  },
  { upsert: true }
);

// BAD: Read-modify-write
const doc = await model.findOne({ itemCode, date });
if (!doc) {
  await model.create({ itemCode, date, open: price, high: price, low: price, close: price });
} else {
  doc.high = Math.max(doc.high, price);
  doc.low = Math.min(doc.low, price);
  doc.close = price;
  await doc.save();
}
```

### 3. Historical Queries
```typescript
// GOOD: Use compound index
const data = await model.find({
  itemCode: 'usd_sell',
  timeframe: 'daily',
  periodStart: { $gte: startDate, $lte: endDate }
}).sort({ periodStart: 1 });

// BAD: Missing timeframe filter
const data = await model.find({
  itemCode: 'usd_sell',
  periodStart: { $gte: startDate, $lte: endDate }
}).sort({ periodStart: 1 });
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

```yaml
Collection Sizes:
  - tracked_items: Should stay ~100 documents
  - current_prices: Should stay ~100 documents
  - intraday_ohlc: Should stay ~200 documents (alert if >300)
  - historical_ohlc: Linear growth, check rate

Index Usage:
  - Monitor index hit rates (should be >95%)
  - Watch for collection scans in slow query log

TTL Cleanup:
  - Verify intraday_ohlc auto-deletes after 48h
  - Monitor historical_ohlc size vs expected growth

Write Performance:
  - current_prices upserts: <10ms avg
  - intraday_ohlc updates: <15ms avg
  - historical_ohlc inserts: <10ms avg

Query Performance:
  - Current price lookups: <5ms p95
  - Today OHLC: <10ms p95
  - Historical ranges: <100ms p95
```

---

## Conclusion

This schema architecture provides:

✓ **Clear separation of concerns** (config, current, intraday, historical)
✓ **Automatic data retention** (TTL indexes)
✓ **Optimal query performance** (compound indexes)
✓ **Scalable storage** (tiered retention)
✓ **Type safety** (TypeScript + Mongoose)
✓ **Production-ready** (atomic operations, proper indexing)

Ready for Phase 3: Service layer implementation and rate limiting.
