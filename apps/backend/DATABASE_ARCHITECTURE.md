# Currency App Database Architecture - Educational Guide 📚

**Author**: Backend Documentation
**Last Updated**: 2025-11-22
**Audience**: Frontend developers and anyone wanting to understand our data storage

---

## Table of Contents

1. [Overview](#overview)
2. [Database Collections](#database-collections)
3. [Current Prices Collection](#1-current-prices-collection)
4. [Intraday OHLC Collection](#2-intraday-ohlc-collection)
5. [Historical OHLC Collection](#3-historical-ohlc-collection)
6. [Tracked Items Collection](#4-tracked-items-collection)
7. [Data Flow](#data-flow)
8. [Query Examples](#query-examples)
9. [Performance Optimizations](#performance-optimizations)
10. [Frontend Best Practices](#frontend-best-practices)

---

## Overview

Our system uses **4 MongoDB collections** that work together to provide:
- **Real-time prices** - Current value for each item
- **Today's charts** - Intraday price movements
- **Historical data** - Past prices with multiple timeframes
- **Item metadata** - Master list of tracked items

```
┌─────────────────────────────────────────────────────────────┐
│                     TRACKED_ITEMS                           │
│  (Master list of all items we track)                        │
│  • usd_sell, eur, btc, 18ayar, sekkeh, etc.                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ references
                              ▼
        ┌─────────────────────┴─────────────────────┐
        │                                             │
        ▼                                             ▼
┌─────────────────┐                         ┌──────────────────┐
│ CURRENT_PRICES  │                         │  INTRADAY_OHLC   │
│ (Latest values) │                         │  (Today's chart) │
│                 │                         │                  │
│ • Latest price  │                         │ • Open           │
│ • Change %      │                         │ • High           │
│ • Timestamp     │                         │ • Low            │
└─────────────────┘                         │ • Close          │
                                            │ • TTL 48h        │
                                            └──────────────────┘
                                                     │
                                                     │ aggregates to
                                                     ▼
                                            ┌──────────────────┐
                                            │ HISTORICAL_OHLC  │
                                            │ (Past charts)    │
                                            │                  │
                                            │ • Hourly         │
                                            │ • Daily          │
                                            │ • Weekly         │
                                            │ • Monthly        │
                                            └──────────────────┘
```

---

## Database Collections

### Collection Summary

| Collection | Purpose | Update Frequency | Retention |
|-----------|---------|------------------|-----------|
| `current_prices` | Latest price for each item | Every 60s | Forever |
| `intraday_ohlc` | Today's price movements | Every 60s | 48 hours (TTL) |
| `historical_ohlc` | Historical charts (multiple timeframes) | Daily aggregation | Forever |
| `tracked_items` | Master list of all tracked items | Manual updates | Forever |

---

## 1. Current Prices Collection

**Collection Name**: `current_prices`

**Purpose**: Stores the **latest/current price** for each item.

### Schema

**File**: `apps/backend/src/schemas/current-price.schema.ts`

```typescript
@Schema({ collection: 'current_prices', timestamps: true })
export class CurrentPrice {
  @Prop({ required: true })
  itemCode: string; // References TrackedItem.code (e.g., 'usd_sell', 'btc')

  @Prop({ required: true, type: Number })
  price: number; // Current price in Toman

  @Prop({ type: Number, default: 0 })
  change: number; // Percentage change

  @Prop({ type: Number })
  previousPrice?: number; // Previous price for comparison

  @Prop({ required: true, type: Date })
  priceTimestamp: Date; // When this price was recorded

  @Prop({ type: String })
  source: string; // Data source (e.g., 'persianapi', 'tgju')

  @Prop({ type: Object })
  rawData?: Record<string, any>; // Original API response
}
```

### Indexes

```typescript
// Fast lookup by item code (unique - one document per item)
CurrentPriceSchema.index({ itemCode: 1 }, { unique: true });

// Query by timestamp for recent prices
CurrentPriceSchema.index({ priceTimestamp: -1 });
```

### Example Document

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "itemCode": "usd_sell",
  "price": 65000,
  "change": 1.5,
  "previousPrice": 64050,
  "priceTimestamp": "2025-11-22T10:30:00.000Z",
  "source": "persianapi",
  "rawData": { /* original API response */ },
  "createdAt": "2025-11-22T10:30:00.000Z",
  "updatedAt": "2025-11-22T10:30:00.000Z"
}
```

### Key Features

- ✅ **One document per item** - Unique index ensures only latest value
- ✅ **Always overwrites** - When new data arrives, document is updated
- ✅ **Fast lookups** - Indexed by `itemCode` for instant retrieval
- ✅ **Change tracking** - Stores previous price for comparison

### Frontend Usage

```typescript
// ItemCard component shows this data:
<ItemCard
  name="دلار"
  price={65000}        // from current_prices.price
  change={1.5}         // from current_prices.change
  timestamp={...}      // from current_prices.priceTimestamp
/>
```

### API Endpoint

```bash
# Get all current prices
GET /api/navasan/all

# Get single item price
GET /api/navasan/price/:itemCode
```

---

## 2. Intraday OHLC Collection

**Collection Name**: `intraday_ohlc`

**Purpose**: Tracks **today's price movements** for mini-charts.

### Schema

**File**: `apps/backend/src/schemas/intraday-ohlc.schema.ts`

```typescript
@Schema({ collection: 'intraday_ohlc', timestamps: true })
export class IntradayOhlc {
  @Prop({ required: true })
  itemCode: string; // References TrackedItem.code

  @Prop({ required: true, type: Date })
  date: Date; // Start of day (midnight) - e.g., 2025-11-22T00:00:00Z

  @Prop({ type: Number })
  open?: number; // First price of the day

  @Prop({ type: Number })
  high?: number; // Highest price today

  @Prop({ type: Number })
  low?: number; // Lowest price today

  @Prop({ type: Number })
  close?: number; // Most recent price

  @Prop({ type: Number, default: 0 })
  updateCount: number; // How many times updated today

  @Prop({ type: Date })
  lastUpdate?: Date; // Last update timestamp

  @Prop({ type: Date })
  expiresAt: Date; // TTL - auto-delete 48h after date
}
```

### Indexes

```typescript
// Compound index for finding today's data
IntradayOhlcSchema.index({ itemCode: 1, date: -1 });

// TTL index for automatic cleanup
IntradayOhlcSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

### Example Document

```json
{
  "_id": "507f1f77bcf86cd799439012",
  "itemCode": "usd_sell",
  "date": "2025-11-22T00:00:00.000Z",
  "open": 64000,
  "high": 66000,
  "low": 63500,
  "close": 65000,
  "updateCount": 42,
  "lastUpdate": "2025-11-22T10:30:00.000Z",
  "expiresAt": "2025-11-24T00:00:00.000Z",
  "createdAt": "2025-11-22T00:05:00.000Z",
  "updatedAt": "2025-11-22T10:30:00.000Z"
}
```

### OHLC Explained

**OHLC = Open, High, Low, Close**

```
Price over time today:

66000 ┤     ╭──╮  ← high = 66000 (highest price reached)
      │    ╱    ╰╮
65000 ┤   ╱      ╰─── ← close = 65000 (current/latest price)
      │  ╱
64000 ┼─╯          ← open = 64000 (first price of the day)
      │
63500 ┤ ← low = 63500 (lowest price reached)
      └─────────────────────→ time
     9am              now
```

### Update Logic

Every time we fetch new data (every 60 seconds):

```typescript
// IntradayOhlcService.updateOhlcData()

await IntradayOhlc.findOneAndUpdate(
  { itemCode: "usd_sell", date: startOfDay(new Date()) },
  {
    $setOnInsert: { open: newPrice },  // Set only if new document (first price)
    $max: { high: newPrice },          // Update if new price is higher
    $min: { low: newPrice },           // Update if new price is lower
    $set: {
      close: newPrice,                 // Always update to latest price
      lastUpdate: new Date()
    },
    $inc: { updateCount: 1 }           // Increment counter
  },
  { upsert: true }
);
```

### Auto-Cleanup with TTL

- MongoDB automatically deletes documents 48 hours after `expiresAt` timestamp
- This keeps the collection small and fast
- Gives us time to aggregate data to `historical_ohlc` before deletion

### Frontend Usage

```typescript
// IntradayMiniChart.tsx shows today's price movement
<IntradayMiniChart
  data={{
    open: 64000,
    high: 66000,
    low: 63500,
    close: 65000
  }}
/>
```

### API Endpoint

```bash
# Get today's OHLC for one item
GET /api/navasan/intraday/:itemCode
```

---

## 3. Historical OHLC Collection

**Collection Name**: `historical_ohlc`

**Purpose**: Stores **aggregated historical data** for different timeframes.

### Schema

**File**: `apps/backend/src/schemas/historical-ohlc.schema.ts`

```typescript
export enum OhlcTimeframe {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Schema({ collection: 'historical_ohlc', timestamps: true })
export class HistoricalOhlc {
  @Prop({ required: true })
  itemCode: string; // References TrackedItem.code

  @Prop({ required: true, enum: Object.values(OhlcTimeframe) })
  timeframe: OhlcTimeframe; // hourly | daily | weekly | monthly

  @Prop({ required: true, type: Date })
  periodStart: Date; // Start of period

  @Prop({ required: true, type: Date })
  periodEnd: Date; // End of period

  @Prop({ required: true, type: Number })
  open: number; // First price in period

  @Prop({ required: true, type: Number })
  high: number; // Highest price in period

  @Prop({ required: true, type: Number })
  low: number; // Lowest price in period

  @Prop({ required: true, type: Number })
  close: number; // Last price in period

  @Prop({ type: Number, default: 0 })
  dataPoints: number; // How many samples were aggregated

  @Prop({ type: Date })
  expiresAt?: Date; // Optional - for cleanup of old data
}
```

### Indexes

```typescript
// Compound index for efficient timeframe queries
HistoricalOhlcSchema.index({ itemCode: 1, timeframe: 1, periodStart: -1 });

// General date range queries
HistoricalOhlcSchema.index({ itemCode: 1, periodStart: -1 });
```

### Example Documents

**Daily Timeframe:**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "itemCode": "usd_sell",
  "timeframe": "daily",
  "periodStart": "2025-11-22T00:00:00.000Z",
  "periodEnd": "2025-11-23T00:00:00.000Z",
  "open": 64000,
  "high": 66000,
  "low": 63500,
  "close": 65000,
  "dataPoints": 48,
  "createdAt": "2025-11-23T00:01:00.000Z",
  "updatedAt": "2025-11-23T00:01:00.000Z"
}
```

**Weekly Timeframe:**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "itemCode": "usd_sell",
  "timeframe": "weekly",
  "periodStart": "2025-11-16T00:00:00.000Z",
  "periodEnd": "2025-11-23T00:00:00.000Z",
  "open": 62000,
  "high": 67000,
  "low": 61500,
  "close": 65000,
  "dataPoints": 7,
  "createdAt": "2025-11-23T00:05:00.000Z",
  "updatedAt": "2025-11-23T00:05:00.000Z"
}
```

### Timeframe Examples

| Timeframe | Period Duration | Use Case |
|-----------|----------------|----------|
| `hourly` | 1 hour | Detailed view of today/yesterday |
| `daily` | 1 day (midnight to midnight) | Week/month charts |
| `weekly` | 7 days (Monday to Sunday) | Multi-month trends |
| `monthly` | ~30 days (1st to last day) | Year+ historical view |

### Aggregation Logic

```typescript
// Example: Creating daily OHLC from intraday data

// Step 1: Get yesterday's intraday OHLC
const yesterday = subDays(startOfDay(new Date()), 1);
const intradayData = await IntradayOhlc.findOne({
  itemCode: "usd_sell",
  date: yesterday
});

// Step 2: Copy to historical_ohlc as daily
await HistoricalOhlc.create({
  itemCode: "usd_sell",
  timeframe: "daily",
  periodStart: yesterday,
  periodEnd: startOfDay(new Date()),
  open: intradayData.open,
  high: intradayData.high,
  low: intradayData.low,
  close: intradayData.close,
  dataPoints: intradayData.updateCount
});

// Step 3: Aggregate multiple days into weekly
// (Run this on Sundays at midnight)
const weekStart = startOfWeek(yesterday);
const weekEnd = endOfWeek(yesterday);

const dailyData = await HistoricalOhlc.find({
  itemCode: "usd_sell",
  timeframe: "daily",
  periodStart: { $gte: weekStart, $lte: weekEnd }
}).sort({ periodStart: 1 });

await HistoricalOhlc.create({
  itemCode: "usd_sell",
  timeframe: "weekly",
  periodStart: weekStart,
  periodEnd: addDays(weekEnd, 1),
  open: dailyData[0].open,                           // Monday's open
  high: Math.max(...dailyData.map(d => d.high)),     // Highest across all days
  low: Math.min(...dailyData.map(d => d.low)),       // Lowest across all days
  close: dailyData[dailyData.length - 1].close,      // Sunday's close
  dataPoints: dailyData.length
});
```

### Frontend Usage

```typescript
// When user selects "Last 30 days" chart:
GET /api/navasan/historical/usd_sell?timeframe=daily&days=30

// Response:
[
  { date: "2025-11-22", open: 64000, high: 66000, low: 63500, close: 65000 },
  { date: "2025-11-21", open: 63000, high: 64500, low: 62800, close: 64000 },
  // ... 28 more days
]
```

### API Endpoint

```bash
# Get historical data with timeframe
GET /api/navasan/historical/:itemCode?timeframe=daily&days=30

# Get specific date
GET /api/navasan/historical/:itemCode?date=2025-11-15
```

---

## 4. Tracked Items Collection

**Collection Name**: `tracked_items`

**Purpose**: **Master list** of all items being tracked (currencies, crypto, gold, coins).

### Schema

**File**: `apps/backend/src/schemas/tracked-item.schema.ts`

```typescript
@Schema({ collection: 'tracked_items', timestamps: true })
export class TrackedItem {
  @Prop({ required: true })
  code: string; // Unique identifier (e.g., 'usd_sell', 'btc', '18ayar')

  @Prop({ required: true, enum: ['currency', 'crypto', 'gold', 'coin'] })
  type: string; // Item type

  @Prop({ required: true })
  name: string; // Display name (e.g., 'دلار', 'بیت کوین')

  @Prop({ type: Object })
  metadata: {
    symbol?: string;           // e.g., '$', '₿'
    decimalPlaces?: number;    // Decimal precision for display
    displayOrder?: number;     // Sort order in UI
    category?: string;         // e.g., 'ارز آزاد', 'طلا'
  };

  @Prop({ default: true })
  isActive: boolean; // Can disable items without deleting

  @Prop({ type: Date })
  lastPriceUpdate?: Date; // Last time price was updated
}
```

### Indexes

```typescript
// Unique code (primary key)
TrackedItemSchema.index({ code: 1 }, { unique: true });
```

### Example Documents

```json
{
  "_id": "507f1f77bcf86cd799439015",
  "code": "usd_sell",
  "type": "currency",
  "name": "دلار",
  "metadata": {
    "symbol": "$",
    "decimalPlaces": 0,
    "displayOrder": 1,
    "category": "ارز آزاد"
  },
  "isActive": true,
  "lastPriceUpdate": "2025-11-22T10:30:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-11-22T10:30:00.000Z"
}
```

```json
{
  "_id": "507f1f77bcf86cd799439016",
  "code": "18ayar",
  "type": "gold",
  "name": "طلای 18 عیار",
  "metadata": {
    "symbol": "گرم",
    "decimalPlaces": 0,
    "displayOrder": 10,
    "category": "طلا"
  },
  "isActive": true,
  "lastPriceUpdate": "2025-11-22T10:30:00.000Z"
}
```

### Frontend Usage

```typescript
// Get all active currencies
GET /api/navasan/tracked-items?type=currency&active=true

// Used to populate category filters:
const currencies = trackedItems.filter(item => item.type === 'currency');
const gold = trackedItems.filter(item => item.type === 'gold');
const crypto = trackedItems.filter(item => item.type === 'crypto');
const coins = trackedItems.filter(item => item.type === 'coin');
```

### API Endpoint

```bash
# Get all tracked items
GET /api/navasan/tracked-items

# Get items by type
GET /api/navasan/tracked-items?type=currency

# Get active items only
GET /api/navasan/tracked-items?active=true
```

---

## Data Flow

### Complete Data Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: API Fetches New Data (Every 60 seconds)             │
├──────────────────────────────────────────────────────────────┤
│  NavasanService.fetchAndUpdate()                             │
│    ↓                                                          │
│  PersianApiProvider.fetchAllData()                           │
│    ↓                                                          │
│  Response: [                                                 │
│    { key: 137202, title: "دلار", price: "65,000", ... },   │
│    { key: 137204, title: "یورو", price: "70,000", ... }    │
│  ]                                                            │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 2: Update Current Prices                                │
├──────────────────────────────────────────────────────────────┤
│  For each item:                                              │
│    CurrentPrice.findOneAndUpdate(                            │
│      { itemCode: "usd_sell" },                              │
│      {                                                        │
│        price: 65000,                                         │
│        change: 1.5,                                          │
│        previousPrice: 64050,                                 │
│        priceTimestamp: new Date()                            │
│      },                                                       │
│      { upsert: true }                                        │
│    )                                                          │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 3: Update Today's OHLC                                  │
├──────────────────────────────────────────────────────────────┤
│  IntradayOhlcService.updateOhlcData()                        │
│    ↓                                                          │
│  IntradayOhlc.findOneAndUpdate(                              │
│    { itemCode: "usd_sell", date: startOfDay(new Date()) },  │
│    {                                                          │
│      $setOnInsert: { open: 65000 },                         │
│      $max: { high: 65000 },                                  │
│      $min: { low: 65000 },                                   │
│      $set: { close: 65000 },                                 │
│      $inc: { updateCount: 1 }                                │
│    },                                                         │
│    { upsert: true }                                          │
│  )                                                            │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 4: Aggregate to Historical (Scheduled - Midnight)       │
├──────────────────────────────────────────────────────────────┤
│  OhlcAggregationScheduler.aggregateDailyData()               │
│    ↓                                                          │
│  Get yesterday's intraday data:                              │
│    intradayData = IntradayOhlc.findOne({                     │
│      itemCode: "usd_sell",                                   │
│      date: yesterday                                          │
│    })                                                         │
│    ↓                                                          │
│  Copy to historical_ohlc as daily:                           │
│    HistoricalOhlc.create({                                   │
│      itemCode: "usd_sell",                                   │
│      timeframe: "daily",                                     │
│      periodStart: yesterday,                                  │
│      periodEnd: today,                                        │
│      open: intradayData.open,                                │
│      high: intradayData.high,                                │
│      low: intradayData.low,                                  │
│      close: intradayData.close                               │
│    })                                                         │
│                                                               │
│  On Sundays - Aggregate to weekly                            │
│  On 1st of month - Aggregate to monthly                      │
└──────────────────────────────────────────────────────────────┘
```

### Update Frequency

| Operation | Frequency | Scheduler |
|-----------|-----------|-----------|
| Fetch API data | Every 60 seconds | `NavasanService.startScheduledFetch()` |
| Update current prices | Every 60 seconds | Same as above |
| Update intraday OHLC | Every 60 seconds | Same as above |
| Aggregate to daily | Once per day (00:01 AM) | `OhlcAggregationScheduler.aggregateDaily()` |
| Aggregate to weekly | Once per week (Sunday 00:05 AM) | `OhlcAggregationScheduler.aggregateWeekly()` |
| Aggregate to monthly | Once per month (1st, 00:10 AM) | `OhlcAggregationScheduler.aggregateMonthly()` |

---

## Query Examples

### Get Today's Value + Change

```typescript
// GET /api/navasan/price/usd_sell
const currentPrice = await CurrentPrice.findOne({
  itemCode: "usd_sell"
});

// Response:
{
  price: 65000,
  change: 1.5,
  timestamp: "2025-11-22T10:30:00Z"
}
```

### Get Today's Mini Chart

```typescript
// GET /api/navasan/intraday/usd_sell
const today = await IntradayOhlc.findOne({
  itemCode: "usd_sell",
  date: { $gte: startOfDay(new Date()) }
});

// Response:
{
  open: 64000,
  high: 66000,
  low: 63500,
  close: 65000,
  updateCount: 42
}
```

### Get Last 7 Days Chart

```typescript
// GET /api/navasan/historical/usd_sell?timeframe=daily&days=7
const sevenDaysAgo = subDays(new Date(), 7);

const historicalData = await HistoricalOhlc.find({
  itemCode: "usd_sell",
  timeframe: "daily",
  periodStart: { $gte: sevenDaysAgo }
})
.sort({ periodStart: 1 })  // Oldest first
.lean();

// Response:
[
  { date: "2025-11-16", open: 62000, high: 63000, low: 61500, close: 62500 },
  { date: "2025-11-17", open: 62500, high: 64000, low: 62000, close: 63500 },
  { date: "2025-11-18", open: 63500, high: 64500, low: 63000, close: 64000 },
  { date: "2025-11-19", open: 64000, high: 65000, low: 63500, close: 64500 },
  { date: "2025-11-20", open: 64500, high: 65500, low: 64000, close: 65000 },
  { date: "2025-11-21", open: 65000, high: 65500, low: 64500, close: 65000 },
  { date: "2025-11-22", open: 65000, high: 66000, low: 63500, close: 65000 }
]
```

### Get Specific Historical Date

```typescript
// GET /api/navasan/historical/usd_sell?date=2025-11-15
const specificDate = new Date("2025-11-15");

const historicalData = await HistoricalOhlc.findOne({
  itemCode: "usd_sell",
  timeframe: "daily",
  periodStart: {
    $gte: startOfDay(specificDate),
    $lt: startOfDay(addDays(specificDate, 1))
  }
});

// Response:
{
  date: "2025-11-15",
  open: 61000,
  high: 62000,
  low: 60500,
  close: 61500,
  dataPoints: 45
}
```

### Get Last 30 Days with Weekly Aggregation

```typescript
// GET /api/navasan/historical/usd_sell?timeframe=weekly&weeks=4
const fourWeeksAgo = subWeeks(new Date(), 4);

const weeklyData = await HistoricalOhlc.find({
  itemCode: "usd_sell",
  timeframe: "weekly",
  periodStart: { $gte: fourWeeksAgo }
})
.sort({ periodStart: 1 })
.lean();

// Response: 4 weeks of aggregated data
[
  {
    weekStart: "2025-10-28",
    weekEnd: "2025-11-04",
    open: 58000,
    high: 60000,
    low: 57500,
    close: 59500
  },
  {
    weekStart: "2025-11-04",
    weekEnd: "2025-11-11",
    open: 59500,
    high: 62000,
    low: 59000,
    close: 61000
  },
  // ... 2 more weeks
]
```

### Batch Query - All Current Prices

```typescript
// GET /api/navasan/all
const allPrices = await CurrentPrice.find({})
  .sort({ itemCode: 1 })
  .lean();

// Response:
[
  { itemCode: "usd_sell", price: 65000, change: 1.5, ... },
  { itemCode: "eur", price: 70000, change: 0.8, ... },
  { itemCode: "btc", price: 3500000000, change: 2.3, ... },
  // ... all items
]
```

---

## Performance Optimizations

### 1. Indexes

**Current Prices**:
```typescript
// Instant lookup by itemCode (unique constraint)
{ itemCode: 1 } (unique)

// Query recent prices by timestamp
{ priceTimestamp: -1 }
```

**Intraday OHLC**:
```typescript
// Find today's data fast
{ itemCode: 1, date: -1 }

// TTL index for automatic cleanup
{ expiresAt: 1 } with expireAfterSeconds: 0
```

**Historical OHLC**:
```typescript
// Efficient timeframe queries
{ itemCode: 1, timeframe: 1, periodStart: -1 }

// General date range queries
{ itemCode: 1, periodStart: -1 }
```

**Tracked Items**:
```typescript
// Primary key
{ code: 1 } (unique)
```

### 2. TTL (Time To Live)

```typescript
// Intraday OHLC auto-deletes after 48h
IntradayOhlcSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Why 48 hours?
// - Gives us 24h buffer to aggregate to historical
// - Allows querying "yesterday's" data
// - Automatically cleans up old intraday data
```

**How TTL Works**:
```typescript
// When creating intraday document:
const expiresAt = addHours(startOfDay(new Date()), 48);

await IntradayOhlc.create({
  itemCode: "usd_sell",
  date: startOfDay(new Date()),
  open: 65000,
  expiresAt: expiresAt  // MongoDB deletes document after this timestamp
});
```

### 3. Compound Indexes

```typescript
// Single query for itemCode + date range uses one index:
db.historical_ohlc.find({
  itemCode: "usd_sell",
  periodStart: { $gte: sevenDaysAgo }
})

// Uses compound index { itemCode: 1, periodStart: -1 }
// FAST! - Single B-tree lookup
```

### 4. Atomic Updates with MongoDB Operators

```typescript
// Instead of read-modify-write (3 operations):
const doc = await IntradayOhlc.findOne({ ... });
doc.high = Math.max(doc.high, newPrice);
await doc.save();

// Use atomic operators (1 operation, no race conditions):
await IntradayOhlc.updateOne(
  { itemCode: "usd_sell", date: today },
  {
    $max: { high: newPrice },  // Atomic: only update if newPrice > current
    $min: { low: newPrice },   // Atomic: only update if newPrice < current
    $set: { close: newPrice }, // Always update
    $inc: { updateCount: 1 }   // Atomic increment
  }
);
```

### 5. Lean Queries

```typescript
// Don't use when you don't need Mongoose documents:
const data = await HistoricalOhlc.find({ ... });  // Returns Mongoose documents (heavy)

// Use lean() for read-only data (5-10x faster):
const data = await HistoricalOhlc.find({ ... }).lean();  // Returns plain JavaScript objects
```

### 6. Projection

```typescript
// Don't fetch fields you don't need:
const prices = await CurrentPrice.find({}, {
  itemCode: 1,
  price: 1,
  change: 1,
  _id: 0  // Exclude _id
});

// Instead of fetching entire document with rawData
```

---

## Frontend Best Practices

### 1. Use the Right Collection

```typescript
// ❌ Don't query historical for today's value:
const today = await HistoricalOhlc.findOne({
  timeframe: "daily",
  periodStart: startOfDay(new Date())
});

// ✅ Use current_prices for latest value:
const current = await fetch('/api/navasan/price/usd_sell');

// ✅ Use intraday_ohlc for today's chart:
const todayChart = await fetch('/api/navasan/intraday/usd_sell');

// ✅ Use historical_ohlc for past data:
const lastWeek = await fetch('/api/navasan/historical/usd_sell?days=7');
```

### 2. Batch Queries

```typescript
// ❌ Don't make 50 individual requests:
currencies.forEach(async (currency) => {
  const price = await fetch(`/api/navasan/price/${currency.code}`);
  // Process each one...
});

// ✅ Get all at once:
const allPrices = await fetch('/api/navasan/all');
const priceMap = new Map(allPrices.map(p => [p.itemCode, p]));

currencies.forEach(currency => {
  const price = priceMap.get(currency.code);
  // Process...
});
```

### 3. Cache Appropriately

```typescript
// Current prices change every 60s - cache for 30s:
const { data: currentPrices } = useQuery({
  queryKey: ['currentPrices'],
  queryFn: fetchCurrentPrices,
  staleTime: 30000,      // Consider fresh for 30s
  refetchInterval: 60000 // Refetch every 60s
});

// Today's intraday chart updates every 60s - cache for 30s:
const { data: todayChart } = useQuery({
  queryKey: ['intraday', itemCode],
  queryFn: () => fetchIntradayChart(itemCode),
  staleTime: 30000,
  refetchInterval: 60000
});

// Historical data doesn't change - cache for 5 minutes:
const { data: historicalData } = useQuery({
  queryKey: ['historical', itemCode, days],
  queryFn: () => fetchHistorical(itemCode, days),
  staleTime: 300000,     // Consider fresh for 5 minutes
  refetchInterval: false // Don't auto-refetch
});
```

### 4. Optimize Chart Rendering

```typescript
// ❌ Don't fetch all data points for a small chart:
const data = await fetch('/api/navasan/historical/usd_sell?days=365');
// 365 data points for a 200px wide chart = wasted bandwidth

// ✅ Match data resolution to chart size:
// For small mini-chart (last 24 hours):
const hourlyData = await fetch('/api/navasan/historical/usd_sell?timeframe=hourly&hours=24');
// 24 data points

// For week view:
const dailyData = await fetch('/api/navasan/historical/usd_sell?timeframe=daily&days=7');
// 7 data points

// For month view:
const dailyData = await fetch('/api/navasan/historical/usd_sell?timeframe=daily&days=30');
// 30 data points

// For year view:
const weeklyData = await fetch('/api/navasan/historical/usd_sell?timeframe=weekly&weeks=52');
// 52 data points (much less than 365!)
```

### 5. Handle Loading States

```typescript
// Show skeleton for current price while loading:
if (isLoadingPrice) {
  return <Skeleton className="h-8 w-24" />;
}

// Show empty chart with message for missing historical data:
if (!historicalData || historicalData.length === 0) {
  return (
    <div className="text-center text-muted">
      No historical data available for this period
    </div>
  );
}

// Show stale data indicator when refetching:
{isRefetching && (
  <div className="absolute top-2 right-2">
    <Spinner size="sm" />
  </div>
)}
```

### 6. Error Handling

```typescript
// Handle specific error cases:
try {
  const data = await fetch('/api/navasan/price/usd_sell');
} catch (error) {
  if (error.status === 404) {
    // Item not found - show different UI
    return <ItemNotFound />;
  } else if (error.status === 429) {
    // Rate limited - show retry message
    return <RateLimitError onRetry={refetch} />;
  } else {
    // Generic error
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }
}
```

---

## Summary

### Quick Reference

| Need | Collection | API Endpoint | Cache Duration |
|------|-----------|--------------|----------------|
| Latest price | `current_prices` | `/api/navasan/price/:code` | 30 seconds |
| All latest prices | `current_prices` | `/api/navasan/all` | 30 seconds |
| Today's chart | `intraday_ohlc` | `/api/navasan/intraday/:code` | 30 seconds |
| Last 7 days | `historical_ohlc` | `/api/navasan/historical/:code?days=7` | 5 minutes |
| Last 30 days | `historical_ohlc` | `/api/navasan/historical/:code?days=30` | 5 minutes |
| Specific date | `historical_ohlc` | `/api/navasan/historical/:code?date=YYYY-MM-DD` | Permanent |
| Item metadata | `tracked_items` | `/api/navasan/tracked-items` | 1 hour |

### Data Flow Summary

```
API Data (every 60s)
  → current_prices (upsert)
  → intraday_ohlc (atomic update)
  → historical_ohlc (daily aggregation at midnight)
```

### Key Takeaways

1. ✅ **current_prices** - Always the freshest data (1 doc per item)
2. ✅ **intraday_ohlc** - Today's price movements (auto-deleted after 48h)
3. ✅ **historical_ohlc** - Long-term storage with multiple timeframes
4. ✅ **tracked_items** - Master reference for all items
5. ✅ Use compound indexes for efficient queries
6. ✅ Cache appropriately based on data freshness
7. ✅ Batch queries when possible
8. ✅ Match data resolution to chart size

---

**Last Updated**: November 22, 2025
**Questions?** Check the code in `apps/backend/src/schemas/` or ask the backend team!
