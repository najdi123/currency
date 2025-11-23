# New Database Schema Design

## Overview

Simplified from **7 collections** (old system) to **5 collections** (new system).

### Old System (Complex):
1. `caches` - Multi-tier caching
2. `price_snapshots` - Hourly snapshots (no TTL, grows forever)
3. `ohlc_snapshots` - OHLC cache (90-day TTL)
4. `ohlc_permanent` - Permanent OHLC (overlaps with snapshots)
5. `daily_aggregates` - Daily summaries
6. `ohlc_aggregation_rules` - Configuration
7. `ohlc_update_logs` - Audit logs

### New System (Simplified):
1. **`tracked_items`** - Configuration: what to track
2. **`current_prices`** - Latest prices (hot data)
3. **`intraday_ohlc`** - Today's OHLC + mini-chart data
4. **`historical_ohlc`** - Time-series with tiered resolution
5. **`user_rate_limits`** - Rate limiting per user

---

## Collection 1: `tracked_items`

**Purpose**: Configuration for which items to track (replaces hardcoded lists)

**Documents**: ~100-200 (one per item)

**Growth**: Minimal (only grows when adding new items)

### Schema:
```typescript
{
  itemCode: 'usd_sell',              // Unique identifier
  itemType: 'currency',              // currency | crypto | gold | coin
  displayName: {
    fa: 'دلار آمریکا (فروش)',
    en: 'US Dollar (Sell)',
    ar: 'الدولار الأمريكي'
  },
  enabled: true,                     // Is tracking active?
  provider: 'persianapi',            // Which API provides this
  metadata: {
    multiplier: 1,                   // For gold coins needing 1000x
    category: 'ارز آزاد',            // API category
    icon: 'usd',                     // Frontend icon
    sortOrder: 1,                    // Display order
    originalKey: '137202'            // Original API key
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes:
- Primary: `{ itemCode: 1 }` (unique)
- Query: `{ itemType: 1, enabled: 1 }`
- Query: `{ provider: 1, enabled: 1 }`

### Use Cases:
- Admin panel: List all tracked items
- Admin panel: Enable/disable items
- Data fetcher: Get list of items to fetch
- Frontend: Get display names and icons

---

## Collection 2: `current_prices`

**Purpose**: Latest known price for each item (hot data, queried most)

**Documents**: ~100-200 (one per tracked item)

**Growth**: None (fixed size, continuous upsert)

**Update Frequency**: Every 10 minutes (peak hours) to 2 hours (weekends)

### Schema:
```typescript
{
  itemCode: 'usd_sell',
  itemType: 'currency',
  price: 1135200,                    // Current price
  change: 1585,                      // Absolute change
  changePercent: 0.14,               // Percentage change
  high24h: 1141500,                  // 24h high
  low24h: 1132800,                   // 24h low
  volume24h: null,                   // For crypto
  marketCap: null,                   // For crypto
  lastUpdated: Date,                 // When fetched
  source: 'api',                     // api | cache | fallback
  dataAge: 'fresh',                  // fresh | stale
  metadata: {
    apiTimestamp: Date,
    fetchDuration: 234,              // ms
    category: 'ارز آزاد',
    originalKey: '137202'
  }
}
```

### Indexes:
- Primary: `{ itemCode: 1 }` (unique)
- Query: `{ itemType: 1 }`
- Query: `{ lastUpdated: -1 }`
- Query: `{ itemType: 1, dataAge: 1 }`

### Use Cases:
- Main page: Display all current prices
- API endpoints: Return latest prices
- Monitoring: Check data freshness
- Fallback: Use stale data when API unavailable

---

## Collection 3: `intraday_ohlc`

**Purpose**: Today's OHLC tracking + data points for mini-charts

**Documents**: ~200 per day (one per item per day)

**Growth**: ~6,000 docs/month (auto-deleted after 2 days)

**TTL**: 2 days (keep today + yesterday)

### Schema:
```typescript
{
  itemCode: 'usd_sell',
  date: '2025-01-16',                // YYYY-MM-DD (Tehran)
  dateJalali: '1403/10/27',          // For display
  open: 1132000,                     // First price of day
  high: 1141500,                     // Highest today
  low: 1132800,                      // Lowest today
  close: 1135200,                    // Latest price
  dataPoints: [                      // Intraday samples
    { time: '08:00', price: 1132000 },
    { time: '08:10', price: 1133500 },
    { time: '08:20', price: 1134200 },
    // ... up to 144 points (24h at 10min intervals)
  ],
  updateCount: 45,                   // Times updated today
  firstUpdate: Date,                 // Market open
  lastUpdate: Date,                  // Latest update
  createdAt: Date                    // TTL index trigger
}
```

### Indexes:
- Primary: `{ itemCode: 1, date: -1 }`
- Query: `{ date: -1 }`
- TTL: `{ createdAt: 1 }` with `expireAfterSeconds: 172800` (2 days)

### Use Cases:
- Main page: Show daily change % and high/low
- Mini-charts: Display today's price movement
- Yesterday's data: Show comparison
- Historical: Build daily aggregates from this data

### Data Flow:
```
Scheduler fetches data every 10 min (peak) / 1 hour (normal) / 2 hours (weekend)
  ↓
Update intraday_ohlc:
  - If first update of day: set open = price
  - Update high = max(high, price)
  - Update low = min(low, price)
  - Set close = price
  - Push { time, price } to dataPoints
```

---

## Collection 4: `historical_ohlc`

**Purpose**: Long-term time-series OHLC with tiered resolution

**Documents**:
- Recent (7 days): ~1,000 docs/day (10-min resolution)
- Medium (7-90 days): ~2,000 docs (1-hour resolution)
- Long-term (90+ days): ~275 docs/year per item (1-day resolution)

**Total Growth**: ~50,000 docs/year (manageable)

**Retention**:
- 10-min data: 7 days
- 1-hour data: 90 days
- 1-day data: Forever

### Schema:
```typescript
{
  itemCode: 'usd_sell',
  itemType: 'currency',
  timestamp: Date,                   // UTC timestamp
  date: '2025-01-16',                // Tehran date
  timeframe: '10m',                  // 10m | 1h | 1d
  open: 1132000,
  high: 1133500,
  low: 1131800,
  close: 1132800,
  volume: null,                      // For crypto
  dataPoints: 6,                     // Number of samples aggregated
  isComplete: true,                  // All expected data present?
  hasMissingData: false,             // Were there gaps?
  source: 'api',                     // api | calculated | interpolated
  lastUpdated: Date,
  createdAt: Date
}
```

### Indexes:
- Primary: `{ itemCode: 1, timeframe: 1, timestamp: -1 }`
- Query: `{ itemCode: 1, timestamp: -1 }`
- Cleanup: `{ timeframe: 1, createdAt: 1 }`
- Daily: `{ date: -1 }`

### Use Cases:
- Charts: Fetch OHLC data for any time range
- Historical queries: "What was price on Jan 15?"
- Comparison: "Price change last week vs this week"
- Analytics: Volatility, trends, patterns

### Tiered Storage Strategy:

#### Recent (Last 7 Days): 10-Minute Resolution
- **Why**: Users want detailed recent data for intraday analysis
- **Storage**: 144 points/day/item × 7 days × 100 items = ~100,000 docs
- **Query**: "Show me BTC price movement today"

#### Medium (7-90 Days): 1-Hour Resolution
- **Why**: Balance between detail and storage
- **Storage**: 24 points/day/item × 83 days × 100 items = ~200,000 docs
- **Query**: "Show me USD trend last month"
- **Aggregation**: Runs hourly, combines 10-min data into 1-hour

#### Long-Term (90+ Days): 1-Day Resolution
- **Why**: Long-term trends, kept forever
- **Storage**: 1 point/day/item × 365 days × 100 items = ~36,500 docs/year
- **Query**: "Show me gold price history for 2024"
- **Aggregation**: Runs daily, combines 1-hour data into 1-day

### Aggregation Jobs:

**Hourly Job** (Cron: `0 * * * *`):
```typescript
// Find 10-min data older than 7 days
const oldData = find({ timeframe: '10m', createdAt: { $lt: sevenDaysAgo } })

// Group by itemCode and hour
const hourlyGroups = groupByHour(oldData)

// Create 1-hour aggregates
hourlyGroups.forEach(group => {
  insert({
    itemCode: group.itemCode,
    timeframe: '1h',
    timestamp: group.hourStart,
    open: group.data[0].open,
    high: max(group.data.map(d => d.high)),
    low: min(group.data.map(d => d.low)),
    close: group.data[last].close,
    dataPoints: group.data.length
  })
})

// Delete old 10-min data
delete({ timeframe: '10m', createdAt: { $lt: sevenDaysAgo } })
```

**Daily Job** (Cron: `0 0 * * *` Tehran time):
```typescript
// Find 1-hour data older than 90 days
const oldData = find({ timeframe: '1h', createdAt: { $lt: ninetyDaysAgo } })

// Group by itemCode and day
const dailyGroups = groupByDay(oldData)

// Create 1-day aggregates
dailyGroups.forEach(group => {
  insert({
    itemCode: group.itemCode,
    timeframe: '1d',
    timestamp: group.dayStart,
    open: group.data[0].open,
    high: max(group.data.map(d => d.high)),
    low: min(group.data.map(d => d.low)),
    close: group.data[last].close,
    dataPoints: group.data.length
  })
})

// Delete old 1-hour data
delete({ timeframe: '1h', createdAt: { $lt: ninetyDaysAgo } })
```

---

## Collection 5: `user_rate_limits`

**Purpose**: Track fresh data request quota (20 requests per 2 hours per user)

**Documents**: ~1,000 active windows (one per active user per 2-hour window)

**Growth**: Controlled by TTL (auto-delete after 3 hours)

**TTL**: 3 hours (window expires after 2 hours + 1 hour buffer)

### Schema:
```typescript
{
  userId: 'user_123',                // Or IP for anonymous
  windowStart: Date,                 // Start of 2-hour window
  windowEnd: Date,                   // End of window
  freshRequestsUsed: 5,              // Out of 20 allowed
  lastRequest: Date,
  requestHistory: [
    { timestamp: Date, endpoint: '/api/currencies', itemType: 'currency' },
    { timestamp: Date, endpoint: '/api/crypto', itemType: 'crypto' },
    // ... recent requests
  ],
  createdAt: Date                    // TTL trigger
}
```

### Indexes:
- Primary: `{ userId: 1, windowStart: -1 }`
- Query: `{ windowEnd: 1 }`
- TTL: `{ createdAt: 1 }` with `expireAfterSeconds: 10800` (3 hours)

### Use Cases:
- Rate limiting: Check if user has quota left
- Frontend: Show "X/20 refreshes remaining"
- Frontend: Display countdown "Fresh data in 25 minutes"
- Analytics: Track usage patterns

### Rate Limit Logic:
```typescript
async checkQuota(userId: string) {
  const currentWindow = getCurrentWindow() // 2-hour blocks

  const record = await findOne({
    userId,
    windowStart: currentWindow.start
  })

  if (!record) {
    // First request in this window
    return { allowed: true, remaining: 19 }
  }

  if (record.freshRequestsUsed >= 20) {
    // Quota exceeded
    const retryAfter = (windowEnd - now) / 1000
    return {
      allowed: false,
      remaining: 0,
      retryAfter, // seconds
      showStaleData: true
    }
  }

  return {
    allowed: true,
    remaining: 20 - record.freshRequestsUsed
  }
}

async consumeQuota(userId: string) {
  await updateOne(
    { userId, windowStart: currentWindow.start },
    {
      $inc: { freshRequestsUsed: 1 },
      $set: { lastRequest: new Date() },
      $push: { requestHistory: { timestamp: new Date(), endpoint } },
      $setOnInsert: { windowEnd: currentWindow.end }
    },
    { upsert: true }
  )
}
```

---

## Comparison: Old vs New

| Aspect | Old System | New System |
|--------|-----------|------------|
| **Collections** | 7 | 5 |
| **Complexity** | High (overlapping purposes) | Low (clear separation) |
| **Growth/Year** | ~570,000 docs | ~50,000 docs |
| **Retention** | Mixed (some forever, some 90 days) | Clear tiers (7d/90d/forever) |
| **Queries** | 3-5 collections per request | 1-2 collections per request |
| **Indexes** | 20+ indexes | 15 indexes |
| **Admin Config** | Hardcoded in code | Database-driven |
| **Rate Limiting** | IP-based, no fallback | User-based, stale fallback |

---

## Storage Estimates

### Year 1:
- `tracked_items`: 200 docs × 1 KB = 200 KB
- `current_prices`: 200 docs × 1 KB = 200 KB
- `intraday_ohlc`: 200 docs/day × 2 days × 1 KB = 400 KB (stable)
- `historical_ohlc`: 50,000 docs × 1 KB = 50 MB
- `user_rate_limits`: 1,000 docs × 1 KB = 1 MB (stable)

**Total Year 1**: ~51 MB

### Year 5:
- `tracked_items`: 200 KB
- `current_prices`: 200 KB
- `intraday_ohlc`: 400 KB (stable)
- `historical_ohlc`: 250 MB (5 years of daily data)
- `user_rate_limits`: 1 MB (stable)

**Total Year 5**: ~251 MB

**Old system would have been**: ~2.5 GB (10x more!)

---

## Benefits

### 1. Simplified Architecture
- Clear purpose for each collection
- No overlapping data
- Easy to understand and maintain

### 2. Efficient Storage
- Automatic aggregation compresses old data
- TTL-based cleanup prevents unbounded growth
- Tiered resolution balances detail vs storage

### 3. Fast Queries
- Hot data (`current_prices`) always in memory
- Proper indexes for time-series queries
- Single collection per query (no joins)

### 4. Flexible Configuration
- Add/remove items via admin panel
- No code changes needed
- Dynamic scheduling

### 5. Better UX
- Stale data fallback (never show errors)
- Clear rate limit feedback
- Intraday charts for recent activity

---

## Migration Plan

See `IMPLEMENTATION_PLAN.md` Phase 2 for step-by-step migration from old schema to new schema.
