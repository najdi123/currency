# Current System Problems Analysis

## Executive Summary

This document analyzes the existing currency/crypto/gold tracking system and identifies issues that need to be addressed before implementing the new PersianAPI-based architecture. The current system uses Navasan API and has several architectural and UX problems that impact usability, scalability, and maintainability.

---

## 1. API Provider Lock-in

### Problem
The system is tightly coupled to Navasan API with hardcoded endpoints, data structures, and item lists.

### Details
- **Hardcoded Base URL**: `http://api.navasan.tech/latest/` in `navasan.service.ts:18`
- **Hardcoded Item Lists**:
  ```typescript
  // apps/backend/src/navasan/navasan.service.ts:23-42
  items = {
    all: 'usd_sell,eur,gbp,cad,...',  // 60+ items hardcoded
    currencies: 'usd_sell,eur,gbp,...',  // 42 currencies
    crypto: 'usdt,btc,eth,bnb,...',      // 11 cryptocurrencies
    gold: 'sekkeh,bahar,nim,...'         // 7 gold items
  }
  ```
- **API-Specific Data Parsing**: Code expects Navasan's exact response structure
- **Gold Price Multipliers**: Hardcoded 1000x multipliers for specific coin types

### Impact
- Cannot switch to PersianAPI without major refactoring
- Adding/removing items requires code changes and deployment
- Different API response structures require rewriting parsers
- No flexibility for multi-provider support

### Required Changes
- Abstract API layer with provider interface
- Move item lists to database configuration
- Create adapter pattern for different API providers
- Dynamic item discovery from API

---

## 2. Rate Limiting Too Restrictive for Development/Testing

### Problem
Current rate limits are so aggressive that normal testing is impossible, severely impacting development workflow.

### Current Configuration

#### Layer 1: Express Rate Limit
```typescript
// apps/backend/src/main.ts:37-44
windowMs: 15 * 60 * 1000  // 15 minutes
max: 100                   // 100 requests per IP
```
**Result**: Only 100 requests per 15 minutes = 6.67 requests/minute

#### Layer 2: NestJS Throttler
```typescript
// apps/backend/src/app.module.ts
ttl: 60000,  // 60 seconds
limit: 5000  // Production: 5000/min, Dev: 10000/min
```

### Developer Experience Issues
- User reports: *"every time I try to test it soon I can't fetch"*
- Cannot test normal user workflows without hitting limits
- IP-based limiting means local dev and frontend share same quota
- No way to bypass limits for testing
- No distinction between expensive vs cheap operations

### Business Impact
- Slow development velocity
- Cannot perform load testing
- Difficult to debug issues that require multiple requests
- Real users also affected (100 requests = ~3-4 complete app sessions)

### Required Changes
- Separate rate limits for:
  - Fresh data fetches (user-triggered, should be limited)
  - Stale data requests (cached, can be generous)
  - Admin operations (should be unrestricted)
- User-based limits instead of IP-based (track by session/token)
- Development mode with relaxed limits
- Whitelisting for testing accounts

---

## 3. Poor User Experience When Rate Limited

### Problem
When users hit rate limits, the system shows cryptic errors and hides ALL data instead of gracefully degrading.

### Current Behavior
```typescript
// Current approach (navasan.service.ts)
if (rateLimited) {
  throw new HttpException('Rate limit exceeded', 429);
}
// Frontend shows: "Failed to fetch data" or "No access to data"
```

### User Expectation vs Reality

| User Expects | Current System Shows |
|-------------|---------------------|
| "Show me old data" | Blank screen or error |
| "When can I retry?" | No information |
| "What did I do wrong?" | Generic error |
| "Let me see something" | Nothing displayed |

### Impact on User Trust
- Users think the app is broken
- No transparency about what happened
- Forces users to leave the app
- No recovery path shown
- Feels like punishment, not protection

### Required Changes
- Show stale data when fresh data unavailable due to rate limiting
- Display clear message: *"You've used your refresh quota. Fresh data available in X minutes"*
- Show timestamp of currently displayed (stale) data
- Provide countdown timer for when fresh fetches available again
- Visual indicator (e.g., amber icon) that data is not real-time

---

## 4. Missing Current Day Tracking Features

### Problem
No infrastructure to track intraday changes, daily open prices, or current day OHLC data.

### Missing Features

#### 4.1 No Daily Open Price Storage
- Cannot calculate "% change since market open"
- System only knows "current price" vs "yesterday's close"
- No tracking of when "today" started (timezone-aware)

#### 4.2 No Intraday OHLC Tracking
- No record of today's high/low prices
- Cannot show "Today's range: 42,000 - 43,500"
- No mini-chart for current day movements

#### 4.3 No Current Day Charts
- User wants short charts showing today's price action
- Current system only has historical multi-day charts
- Cannot zoom into "today only" view

### Database Gap
Current schema:
- ✅ `price_snapshots`: Historical hourly snapshots
- ✅ `daily_aggregates`: Past days OHLC
- ❌ **Missing**: `current_day_ohlc` collection for today's running stats

### Impact
- Cannot show "USD: 42,500 (↑2.3% today)"
- No visualization of intraday volatility
- Missing key feature for traders/users who check frequently
- Cannot compete with financial apps that show daily change

### Required Changes
- Add `current_day_ohlc` collection with running high/low/open
- Track daily open at market start (configurable time, e.g., 8 AM Tehran)
- Calculate and store intraday change percentage
- Build API endpoint for current day mini-charts
- Reset daily stats at midnight Tehran time

---

## 5. Date Navigation Limitations

### Problem
Users can only navigate dates sequentially (back/forward arrows). Cannot jump to specific dates or use date pickers.

### Current Implementation
```typescript
// Frontend calendar component (assumed)
<button onClick={() => goToPreviousDay()}>←</button>
<span>{currentDate}</span>
<button onClick={() => goToNextDay()}>→</button>
```

### User Frustration Scenarios
1. **Looking for specific date**: "I want to see prices on March 15th"
   - Current: Must click back arrow 30+ times
   - Should: Click date, type "1403/12/24" or pick from calendar

2. **Comparing dates**: "What was the difference between Jan 1 and Feb 15?"
   - Current: Write down first price, click 45 times, compare manually
   - Should: Open two date pickers, select dates, see comparison

3. **Accessibility**: Keyboard users cannot easily navigate dates

### Missing UI Components
- No Iranian (Jalali) date picker
- No Gregorian date picker
- No direct date input field
- Clicking on date display doesn't make it editable

### Required Changes
- Add dual date picker component (switch between Jalali/Gregorian)
- Make date display clickable → transforms to input field
- Validate date input (no future dates, must have data)
- Add keyboard shortcuts (e.g., Ctrl+D for date picker)
- Consider date range selector for comparisons

---

## 6. Overcomplicated Database Structure

### Problem
Seven (7) different MongoDB collections with overlapping purposes, unclear data flows, and redundant storage.

### Current Collections

| Collection | Purpose | TTL | Records/Month | Issues |
|-----------|---------|-----|--------------|--------|
| `caches` | Multi-tier caching | 7 days | ~3,000 | ✅ Good design |
| `price_snapshots` | Hourly price history | **None** | 2,160 | ⚠️ Grows forever |
| `ohlc_snapshots` | Chart data cache | 90 days | ~1,500 | ❓ Overlaps with permanent |
| `ohlc_permanent` | OHLC long-term storage | **None** | ~43,000 | ❓ Redundant with snapshots? |
| `daily_aggregates` | Daily OHLC summaries | **None** | ~3,000 | ✅ Good for compression |
| `ohlc_aggregation_rules` | Timeframe aggregation config | **None** | <10 | ❓ Over-engineered |
| `ohlc_update_logs` | Audit trail | **None** | ~500 | ⚠️ Audit spam |

**Total**: 7 collections, ~52,000 new records/month

### Specific Issues

#### 6.1 Overlapping OHLC Storage
```
ohlc_snapshots (90-day TTL) vs ohlc_permanent (no TTL)
```
- Both store OHLC data
- Unclear which is source of truth
- Queries check both collections
- Possible inconsistencies

#### 6.2 Unbounded Growth
- `price_snapshots`: 2,160 records/month × 12 months = 25,920 records/year
- `ohlc_permanent`: 43,000 records/month × 12 months = 516,000 records/year
- No aggregation to compress old data

#### 6.3 Complex Queries
Fetching historical chart requires:
1. Check `caches` (fresh)
2. Check `ohlc_snapshots`
3. Fallback to `ohlc_permanent`
4. If not found, query `price_snapshots` and build OHLC
5. Update multiple caches

**Result**: 3-5 database queries for single chart request

#### 6.4 Unclear Retention Policy
- Some collections never delete (price_snapshots)
- Some delete after 90 days (ohlc_snapshots)
- Some delete after 7 days (caches)
- No unified retention strategy

### Performance Impact
- Slow queries as collections grow
- High storage costs
- Complex index management (20+ indexes across collections)
- Difficult to debug data issues

### Required Changes
- Simplify to 3-4 core collections:
  1. **current_prices**: Real-time latest prices (small, fast)
  2. **intraday_ohlc**: Today's OHLC tracking (reset daily)
  3. **historical_ohlc**: Time-series data with tiered resolution
     - Recent 7 days: Store every data point
     - 7-90 days: Store hourly aggregates
     - 90+ days: Store daily aggregates only
  4. **metadata**: Item configs, schedules, admin settings
- Remove overlapping collections
- Implement automatic aggregation/compression
- Add TTL-based cleanup for old granular data

---

## 7. Fixed Scheduling - No Time-of-Day Awareness

### Problem
Scheduler runs every hour regardless of market activity, business hours, or weekends.

### Current Implementation
```typescript
// apps/backend/src/scheduler/navasan-scheduler.service.ts
SCHEDULER_INTERVAL_MINUTES=60  // Fixed 1 hour interval
```

**Runs**: 24 times per day, 7 days per week = 168 API calls/week

### Business Logic Issues

#### 7.1 Waste During Off-Peak Hours
- Markets most active: 8 AM - 2 PM Tehran time (6 hours)
- Current: Same 1-hour frequency for all 24 hours
- **Waste**: 75% of API calls during low-activity periods

#### 7.2 No Weekend Optimization
- Iranian weekend: Thursday afternoon + Friday
- Crypto markets: Less volatile on weekends
- Current: Same frequency 7 days/week
- **Waste**: ~28 unnecessary API calls per week

#### 7.3 Insufficient Peak Coverage
- Peak hours need more frequent updates (every 10 minutes)
- Current: Every 60 minutes even during peak trading
- **Result**: Stale data during most important hours

### API Key Constraints
User's PersianAPI plan: **1 request per 5 seconds** = 720 requests/hour max

Current scheduler uses only: **24 requests/day** = Utilizing **0.13%** of available quota

### Required Changes
Implement dynamic scheduling based on Tehran time:

| Time Period | Frequency | Rationale |
|------------|-----------|-----------|
| **Mon-Wed 8AM-2PM** | Every 10 min | Peak trading hours |
| **Mon-Wed Other hours** | Every 1 hour | Normal activity |
| **Thu-Fri All day** | Every 2 hours | Weekend, less activity |

**API usage**:
- Peak: 6 hours × 6 calls/hour × 3 days = 108 calls
- Normal: 18 hours × 1 call/hour × 3 days = 54 calls
- Weekend: 48 hours × 0.5 calls/hour = 24 calls
- **Total**: 186 calls/week (vs current 168, but better distributed)

---

## 8. No Admin Configuration Interface

### Problem
All critical settings are hardcoded in source code, requiring developer intervention for simple changes.

### Hardcoded Settings Requiring Code Changes

#### 8.1 Tracked Items
```typescript
// Must edit source code to add/remove currencies
items = {
  currencies: 'usd_sell,eur,gbp,...',  // Hardcoded list
  crypto: 'usdt,btc,eth,...',
  gold: 'sekkeh,bahar,nim,...'
}
```

**User request**: "I want to track Turkish Lira"
**Current process**:
1. Edit `navasan.service.ts`
2. Add `try` to currencies list
3. Test locally
4. Commit, push, deploy
5. **Time**: 30-60 minutes

**Should be**: Click "Add Currency" → Select "TRY" → Save (30 seconds)

#### 8.2 Sampling Schedules
```typescript
SCHEDULER_INTERVAL_MINUTES=60  // Must edit .env and restart
```

**User request**: "Make updates every 30 minutes during peak hours"
**Current process**: Edit config file, redeploy entire backend

#### 8.3 Rate Limits
```typescript
max: 100  // Edit main.ts line 39, redeploy
```

#### 8.4 Gold Price Multipliers
```typescript
const goldPriceMultipliers: Record<string, number> = {
  sekkeh: 1000,  // Hardcoded multiplier
  // ...
};
```

If API changes format → requires code change

### Impact on Operations
- Cannot respond quickly to user needs
- Requires developer for non-technical changes
- Higher risk (code changes vs config changes)
- Slower iteration cycles

### Required Changes
- Build admin panel APIs:
  - `GET /admin/items/available` - List all items from PersianAPI
  - `POST /admin/items/enable` - Start tracking an item
  - `DELETE /admin/items/{id}` - Stop tracking
  - `PUT /admin/schedule/config` - Update sampling frequencies
  - `PUT /admin/rate-limits` - Adjust user quotas
- Store all configuration in database `settings` collection
- Hot reload configuration without restarts
- Admin UI for managing these settings

---

## 9. Inefficient Historical Data Retrieval

### Problem
Querying historical data requires checking multiple collections and building OHLC from price snapshots when chart data unavailable.

### Current Flow for Historical Chart
```typescript
// apps/backend/src/chart/chart.service.ts:~100-200
async getChartData(itemCode, timeRange) {
  // 1. Check fresh cache (1 hour TTL)
  let data = await this.checkCache('fresh');
  if (data) return data;

  // 2. Check OHLC snapshot DB
  data = await this.ohlcSnapshotModel.find({...});
  if (data) return data;

  // 3. Call Navasan OHLC API
  data = await this.fetchFromAPI();
  if (data) return data;

  // 4. Check stale cache (72 hours TTL)
  data = await this.checkCache('stale');
  if (data) return data;

  // 5. Build synthetic OHLC from price snapshots
  data = await this.buildFromSnapshots(); // EXPENSIVE
  return data;
}
```

### Performance Issues

#### 9.1 Cascading Fallbacks
- Best case: 1 query (cache hit) ~ 5ms
- Typical case: 3 queries (cache miss, DB hit) ~ 50ms
- Worst case: 5+ queries + computation ~ 500ms

#### 9.2 Synthetic OHLC Building
When OHLC data unavailable, system builds it from hourly snapshots:

```typescript
async buildChartFromPriceSnapshots(itemCode, startDate, endDate) {
  // Fetch ALL snapshots in date range
  const snapshots = await this.priceSnapshotModel.find({
    timestamp: { $gte: startDate, $lte: endDate }
  });

  // Extract price for each snapshot (N operations)
  // Group by time bucket (N operations)
  // Calculate OHLC for each bucket (N operations)
  // Result: O(N) where N can be 100+ snapshots for 1-week chart
}
```

**Cost**:
- Query: 100+ snapshot documents
- Parse: Extract prices from nested JSON
- Compute: Group + aggregate + calculate OHLC
- **Total**: 200-500ms for single chart

#### 9.3 No Query Optimization
- Fetches full snapshot documents (contains all items, all fields)
- Should only need: `{timestamp, items.{itemCode}.price}`
- **Waste**: 90% of data transferred unused

### Required Changes
- Pre-compute OHLC during data ingestion (not at query time)
- Store tiered OHLC data:
  - **1-minute resolution**: Last 7 days
  - **1-hour resolution**: Last 90 days
  - **1-day resolution**: Forever
- Single-query chart retrieval from `historical_ohlc` table
- Projection-based queries (only fetch needed fields)
- Add proper indexes: `(itemCode, timeframe, timestamp)`

---

## 10. Historical Data Gaps

### Problem
System relies on scheduler being continuously online. Downtime creates permanent data gaps.

### Gap Creation Scenarios

#### 10.1 Server Downtime
```
Timeline:
10:00 AM - Scheduler fetches data ✓
11:00 AM - Scheduler should run, but server crashed ✗
12:00 PM - Server back online, scheduler runs ✓

Result: 11:00 AM data missing forever
```

#### 10.2 API Failures
```
Timeline:
2:00 PM - API call fails (timeout) ✗
3:00 PM - API call fails (rate limit) ✗
4:00 PM - API call succeeds ✓

Result: 2-4 PM data missing
```

#### 10.3 Deployment Windows
```
12:30 PM - Start deployment, stop scheduler
12:35 PM - Deploy new code
12:40 PM - Restart services

Result: 5-10 minute gap in data
```

### Current Backfill Mechanism
```typescript
// apps/backend/src/ohlc/ohlc-backfill.service.ts exists but:
// - Disabled by default
// - Must manually trigger
// - Limited to 90-day window
// - No automatic gap detection
```

### Impact on Data Quality
- Charts show interpolated/missing data points
- Users see "data unavailable" for historical queries
- Analytics incomplete
- Cannot trust historical comparisons

### Compound Effect
- 1 hour gap/day × 365 days = 365 missing data points/year
- Over months, gaps accumulate
- Eventually, more gaps than data

### Required Changes
- **Startup Gap Detection**: On boot, check for gaps in last 7 days
- **Automatic Backfill**: Queue jobs to fill gaps from API
- **Gap Monitoring**: Alert when gap detection fails
- **Graceful Degradation**: Mark interpolated data points vs real data
- **Scheduled Backfill**: Daily job to check/fill previous day gaps

---

## 11. No Timezone-Aware Date Handling

### Problem
Database stores UTC timestamps, but business logic operates on Tehran time. No clear separation causes bugs.

### Issues

#### 11.1 "Daily" Aggregates Misaligned
```typescript
// Current: Daily aggregate created at midnight UTC
// Tehran time: 3:30 AM (UTC+3:30)
// Result: Aggregate includes 3.5 hours of "next day" Tehran time
```

#### 11.2 "Today" Ambiguity
User in Tehran at 11:30 PM wants "today's data"
- System sees: Still "today" in UTC
- Tehran time: Almost midnight, should be current day
- **Result**: Wrong daily OHLC returned

#### 11.3 Scheduler Mismatch
```typescript
SCHEDULER_CRON="0 9 * * *"  // 9 AM UTC
// Tehran time: 12:30 PM (past peak hours)
```

### Required Changes
- Store all timestamps with timezone info (use `Date` + timezone field)
- Add `DateService` that handles Tehran timezone conversions
- Daily aggregates calculated at midnight Tehran time
- Scheduler uses Tehran time (8 AM Tehran, not UTC)
- Clear separation:
  - `timestamp_utc`: Storage
  - `timestamp_tehran`: Business logic
  - `display_date`: UI (localized)

---

## 12. Lack of User-Friendly Error Messages

### Problem
Technical error messages exposed to users, no actionable guidance.

### Current Error Messages

| Scenario | Current Message | User Thinks |
|----------|----------------|-------------|
| Rate limited | `429 Too Many Requests` | "App is broken" |
| API down | `Failed to fetch data` | "Internet problem?" |
| Invalid date | `400 Bad Request` | "What did I do wrong?" |
| No historical data | `Data not found` | "Does this even work?" |

### Missing Context
- No explanation of what happened
- No suggested actions
- No estimate of resolution time
- No fallback options presented

### Required Changes
Create error codes with user-friendly messages:

```typescript
errors = {
  RATE_LIMIT_FRESH: {
    code: 'RATE_LIMIT_001',
    title: 'شما به محدودیت درخواست رسیده‌اید',
    message: 'شما می‌توانید ${remainingTime} دقیقه دیگر داده‌های جدید دریافت کنید',
    action: 'نمایش داده‌های ذخیره شده',
    icon: 'clock'
  },
  API_UNAVAILABLE: {
    code: 'API_ERROR_001',
    title: 'سرویس موقتا در دسترس نیست',
    message: 'آخرین داده‌های موجود را نمایش می‌دهیم',
    action: 'تلاش مجدد در چند لحظه',
    icon: 'warning'
  },
  // ... etc
}
```

---

## 13. No Request Deduplication at User Level

### Problem
Multiple requests from same user for same data (e.g., quick page refreshes) all hit API/DB.

### Current Behavior
```
User refreshes page 5 times in 2 seconds:
Request 1: API call → Cache → Return
Request 2: API call → Cache → Return (duplicate work)
Request 3: API call → Cache → Return (duplicate work)
Request 4: API call → Cache → Return (duplicate work)
Request 5: API call → Cache → Return (duplicate work)
```

### Backend Deduplication Exists (But Incomplete)
```typescript
// navasan.service.ts has pendingRequests map
// Only prevents duplicate API calls in same category
// Doesn't help if requests are for different categories
// Doesn't prevent DB queries
```

### Required Changes
- Frontend: Debounce user actions (500ms)
- Backend: Request deduplication by `user_id + endpoint + params`
- Cache GET requests in memory for 1-2 seconds
- Return same promise for identical concurrent requests

---

## Summary of Problems

### Critical (Must Fix)
1. ✅ API provider lock-in
2. ✅ Rate limiting too restrictive
3. ✅ Poor UX when rate limited
4. ✅ Missing current day tracking
5. ✅ Overcomplicated database structure

### High Priority
6. ✅ Fixed scheduling (no time-awareness)
7. ✅ Date navigation limitations
8. ✅ No admin configuration
9. ✅ Inefficient historical queries

### Medium Priority
10. ✅ Historical data gaps
11. ✅ Timezone handling issues
12. ✅ User-unfriendly error messages

### Low Priority (Nice to Have)
13. ✅ Request deduplication

---

## Next Steps

See **IMPLEMENTATION_PLAN.md** for the phased approach to solving these problems and building the new PersianAPI-based system with improved architecture.
