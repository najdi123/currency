# Implementation Plan: PersianAPI Migration & Feature Enhancement

## Overview

This document provides a step-by-step implementation plan to migrate from Navasan API to PersianAPI and implement the requested features. The plan is organized in phases, with each phase pairing backend implementation followed by frontend integration and testing before moving to the next phase.

---

## Planning Principles

1. **Backend → Frontend → Test**: Complete backend for a feature, then update frontend, then test before next step
2. **Incremental Migration**: Run old and new systems in parallel during transition
3. **Zero Downtime**: Users should never see "site down" message
4. **Data Preservation**: All historical data migrated without loss
5. **Rollback Ready**: Each phase can be reverted if issues found

---

## API Rate Limit Budget

**PersianAPI Plan**: 1 request per 5 seconds = 720 requests/hour

**Allocation**:
- Scheduled background fetches: 300 requests/hour (peak hours)
- User-triggered fresh fetches: 300 requests/hour (20 users × 15 requests each)
- Buffer for admin/backfill: 120 requests/hour

---

## Phase 1: Backend - PersianAPI Integration Foundation

**Duration**: 3-5 days
**Goal**: Create abstraction layer for API providers and integrate PersianAPI

### 1.1 Create API Provider Interface

**File**: `apps/backend/src/api-providers/api-provider.interface.ts`

```typescript
export interface IApiProvider {
  name: string;
  fetchCurrencies(params?: FetchParams): Promise<CurrencyData[]>;
  fetchCrypto(params?: FetchParams): Promise<CryptoData[]>;
  fetchGold(params?: FetchParams): Promise<GoldData[]>;
  fetchCoins(params?: FetchParams): Promise<CoinData[]>;
  getAvailableItems(): Promise<AvailableItems>;
  validateApiKey(): Promise<boolean>;
  getRateLimitStatus(): Promise<RateLimitStatus>;
}
```

**Why**: Allows switching providers without changing business logic

### 1.2 Implement PersianAPI Provider

**File**: `apps/backend/src/api-providers/persianapi.provider.ts`

**Implementation**:
```typescript
@Injectable()
export class PersianApiProvider implements IApiProvider {
  private readonly baseUrl = 'https://studio.persianapi.com/web-service';
  private readonly apiKey = process.env.PERSIANAPI_KEY;

  async fetchCurrencies(params?: FetchParams): Promise<CurrencyData[]> {
    // GET /common/forex
    const response = await this.httpService.get(
      `${this.baseUrl}/common/forex`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        params: { format: 'json', limit: params?.limit || 30 }
      }
    );
    return this.mapToStandardFormat(response.data);
  }

  // Similar for crypto, gold, coins...
}
```

**Mapping Logic**:
- Convert PersianAPI response structure to internal standard format
- Handle field name differences (e.g., `Price` vs `price`)
- Apply any necessary transformations (gold multipliers, etc.)

**Testing**:
```bash
# Unit test
npm test api-providers/persianapi.provider.spec.ts

# Integration test with real API
npm run test:e2e api-providers
```

### 1.3 Create Legacy Navasan Provider

**File**: `apps/backend/src/api-providers/navasan.provider.ts`

**Why**: Keep old system working during migration

```typescript
@Injectable()
export class NavasanProvider implements IApiProvider {
  // Wrap existing NavasanService logic
  // Implement same interface as PersianApiProvider
}
```

### 1.4 Add Provider Factory

**File**: `apps/backend/src/api-providers/api-provider.factory.ts`

```typescript
@Injectable()
export class ApiProviderFactory {
  constructor(
    private persianApi: PersianApiProvider,
    private navasanApi: NavasanProvider,
  ) {}

  getProvider(name: string): IApiProvider {
    switch (name) {
      case 'persianapi': return this.persianApi;
      case 'navasan': return this.navasanApi;
      default: throw new Error('Unknown provider');
    }
  }

  getActiveProvider(): IApiProvider {
    const provider = process.env.API_PROVIDER || 'persianapi';
    return this.getProvider(provider);
  }
}
```

**Testing**:
- Test provider switching via env variable
- Verify both providers return consistent data structure

---

## Phase 2: Backend - Database Schema Redesign

**Duration**: 4-6 days
**Goal**: Simplify database from 7 collections to 4, with clear data retention

### 2.1 Design New Schema

#### Collection 1: `tracked_items`
**Purpose**: Configuration for which items to track

```typescript
{
  _id: ObjectId,
  itemCode: 'usd_sell',           // Unique identifier
  itemType: 'currency',            // currency | crypto | gold | coin
  displayName: {
    fa: 'دلار آمریکا',
    en: 'US Dollar',
    ar: 'الدولار الأمريكي'
  },
  enabled: true,                   // Is tracking active?
  provider: 'persianapi',          // Which API provides this
  metadata: {
    multiplier: 1,                 // For gold coins
    category: 'major',             // For grouping
    icon: 'usd',                   // Frontend icon
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- Unique: `itemCode`
- Query: `(itemType, enabled)`

#### Collection 2: `current_prices`
**Purpose**: Latest known price for each item (single document per item)

```typescript
{
  _id: ObjectId,
  itemCode: 'usd_sell',
  price: 42500,
  change24h: 2.3,                  // Percentage
  high24h: 43000,
  low24h: 42000,
  lastUpdated: Date,               // When this price was fetched
  source: 'api',                   // api | cache | fallback
  dataAge: 'fresh',                // fresh | stale
  metadata: {
    apiTimestamp: Date,            // Original API timestamp
    fetchDuration: 234,            // ms
  }
}
```

**Indexes**:
- Unique: `itemCode`
- Query: `(lastUpdated)` DESC

**TTL**: None (always keep latest, upsert pattern)

#### Collection 3: `intraday_ohlc`
**Purpose**: Today's OHLC tracking (reset daily)

```typescript
{
  _id: ObjectId,
  itemCode: 'usd_sell',
  date: '2025-01-16',              // Tehran date (YYYY-MM-DD)
  dateJalali: '1403/10/27',        // For display
  open: 42000,                     // First price of day
  high: 43000,                     // Highest seen today
  low: 41800,                      // Lowest seen today
  close: 42500,                    // Latest price
  dataPoints: [                    // Intraday samples
    { time: '08:00', price: 42000 },
    { time: '08:10', price: 42100 },
    // ...
  ],
  updateCount: 45,                 // Number of updates today
  firstUpdate: Date,               // Market open time
  lastUpdate: Date,                // Latest update
}
```

**Indexes**:
- Unique: `(itemCode, date)`
- Query: `(date)` DESC
- TTL: Auto-delete after 2 days (keep today + yesterday)

#### Collection 4: `historical_ohlc`
**Purpose**: Long-term time-series OHLC data with tiered resolution

```typescript
{
  _id: ObjectId,
  itemCode: 'usd_sell',
  timestamp: Date,                 // UTC timestamp
  date: '2025-01-16',              // Tehran date
  timeframe: '1h',                 // 10m | 1h | 1d
  open: 42000,
  high: 42500,
  low: 41800,
  close: 42300,
  volume: null,                    // Future use
  dataPoints: 6,                   // Number of samples in aggregate
  isComplete: true,                // Full data vs interpolated
  createdAt: Date,
}
```

**Tiered Storage**:
- **10-minute resolution**: Last 7 days (1,008 records per item)
- **1-hour resolution**: 7-90 days (1,992 records per item)
- **1-day resolution**: 90+ days (275+ records per item per year)

**Indexes**:
- Unique: `(itemCode, timeframe, timestamp)`
- Query: `(itemCode, timeframe, date)` DESC
- TTL: Custom cleanup based on timeframe and age

**Example TTL Logic**:
```typescript
// In cleanup scheduler
if (timeframe === '10m' && daysOld > 7) delete();
if (timeframe === '1h' && daysOld > 90) delete();
// Daily data kept forever
```

#### Collection 5: `user_rate_limits` (New)
**Purpose**: Track user refresh quotas

```typescript
{
  _id: ObjectId,
  userId: 'user_123',              // Or IP for anonymous
  windowStart: Date,               // Start of 2-hour window
  windowEnd: Date,                 // End of window
  freshRequestsUsed: 5,            // Out of 20 allowed
  lastRequest: Date,
  requestHistory: [                // Recent requests
    { timestamp: Date, endpoint: '/api/currencies' },
    // ...
  ]
}
```

**Indexes**:
- Unique: `(userId, windowStart)`
- TTL: Delete after 3 hours

### 2.2 Create Mongoose Schemas

**Files**:
- `apps/backend/src/schemas/tracked-item.schema.ts`
- `apps/backend/src/schemas/current-price.schema.ts`
- `apps/backend/src/schemas/intraday-ohlc.schema.ts`
- `apps/backend/src/schemas/historical-ohlc.schema.ts`
- `apps/backend/src/schemas/user-rate-limit.schema.ts`

**Example**:
```typescript
// tracked-item.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class TrackedItem {
  @Prop({ required: true, unique: true })
  itemCode: string;

  @Prop({ required: true, enum: ['currency', 'crypto', 'gold', 'coin'] })
  itemType: string;

  @Prop({ type: Object, required: true })
  displayName: {
    fa: string;
    en: string;
    ar: string;
  };

  @Prop({ default: true })
  enabled: boolean;

  // ... rest of fields
}

export const TrackedItemSchema = SchemaFactory.createForClass(TrackedItem);
TrackedItemSchema.index({ itemType: 1, enabled: 1 });
```

### 2.3 Create Migration Script

**File**: `apps/backend/scripts/migrate-to-new-schema.ts`

**Steps**:
1. Create new collections
2. Migrate `tracked_items`:
   - Extract unique item codes from old `items` object
   - Create TrackedItem documents with default settings
3. Migrate `current_prices`:
   - Get latest from old `caches` collection
   - Transform to new format
4. Migrate `historical_ohlc`:
   - Copy from `ohlc_permanent` and `daily_aggregates`
   - Resample to tiered timeframes
5. Verify data integrity
6. Create backup before switching

**Run**:
```bash
npm run migrate:new-schema
```

**Rollback**:
```bash
npm run migrate:rollback
```

### 2.4 Testing

```bash
# Test schema creation
npm run test:db schemas

# Test migration script on test DB
NODE_ENV=test npm run migrate:new-schema

# Verify data integrity
npm run test:e2e migration-validation
```

---

## Phase 3: Backend - Smart Rate Limiting

**Duration**: 2-3 days
**Goal**: Implement user-friendly rate limiting with stale data fallback

### 3.1 Create Rate Limit Service

**File**: `apps/backend/src/rate-limit/rate-limit.service.ts`

```typescript
@Injectable()
export class RateLimitService {
  constructor(
    @InjectModel(UserRateLimit.name)
    private rateLimitModel: Model<UserRateLimit>,
  ) {}

  async checkFreshDataQuota(userId: string): Promise<RateLimitStatus> {
    const window = this.getCurrentWindow();
    const record = await this.rateLimitModel.findOne({
      userId,
      windowStart: window.start,
    });

    const used = record?.freshRequestsUsed || 0;
    const limit = 20; // 20 requests per 2 hours

    return {
      allowed: used < limit,
      remaining: limit - used,
      resetAt: window.end,
      retryAfter: used >= limit ? this.getRetryAfter(window.end) : null,
    };
  }

  async consumeFreshDataQuota(userId: string): Promise<void> {
    const window = this.getCurrentWindow();
    await this.rateLimitModel.updateOne(
      { userId, windowStart: window.start },
      {
        $inc: { freshRequestsUsed: 1 },
        $set: { lastRequest: new Date() },
        $push: {
          requestHistory: {
            timestamp: new Date(),
            endpoint: 'refresh',
          }
        },
        windowEnd: window.end,
      },
      { upsert: true }
    );
  }

  private getCurrentWindow() {
    const now = new Date();
    const windowDuration = 2 * 60 * 60 * 1000; // 2 hours in ms
    const windowStart = new Date(
      Math.floor(now.getTime() / windowDuration) * windowDuration
    );
    const windowEnd = new Date(windowStart.getTime() + windowDuration);
    return { start: windowStart, end: windowEnd };
  }

  private getRetryAfter(resetAt: Date): number {
    return Math.ceil((resetAt.getTime() - Date.now()) / 1000); // seconds
  }
}
```

### 3.2 Update Controllers with Rate Limit Logic

**File**: `apps/backend/src/currencies/currencies.controller.ts`

```typescript
@Controller('api/currencies')
export class CurrenciesController {
  constructor(
    private currencyService: CurrencyService,
    private rateLimitService: RateLimitService,
  ) {}

  @Get()
  async getCurrencies(
    @Query('fresh') requestFresh: boolean,
    @Headers('x-user-id') userId: string,
  ) {
    // Always allow stale data requests
    if (!requestFresh) {
      return this.currencyService.getCachedCurrencies();
    }

    // Check rate limit for fresh data
    const rateLimit = await this.rateLimitService.checkFreshDataQuota(userId);

    if (!rateLimit.allowed) {
      // Return stale data with rate limit info
      const staleData = await this.currencyService.getCachedCurrencies();
      throw new HttpException(
        {
          statusCode: 429,
          message: 'شما به محدودیت درخواست رسیده‌اید',
          messageEn: 'You have reached your refresh limit',
          retryAfter: rateLimit.retryAfter,
          retryAfterMinutes: Math.ceil(rateLimit.retryAfter / 60),
          data: staleData, // Include stale data in error response!
          dataTimestamp: staleData.lastUpdated,
        },
        429,
      );
    }

    // Consume quota
    await this.rateLimitService.consumeFreshDataQuota(userId);

    // Fetch fresh data
    return this.currencyService.getFreshCurrencies();
  }

  @Get('rate-limit-status')
  async getRateLimitStatus(@Headers('x-user-id') userId: string) {
    return this.rateLimitService.checkFreshDataQuota(userId);
  }
}
```

### 3.3 Relax General Rate Limits

**File**: `apps/backend/src/main.ts`

```typescript
// Old: 100 requests per 15 minutes
// New: 1000 requests per 15 minutes (10x increase)

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 1000 : 10000,
    message: 'بیش از حد مجاز درخواست ارسال کرده‌اید',
    skip: (req) => {
      // Skip for stale data requests
      return req.query.fresh !== 'true';
    },
  }),
);
```

### 3.4 Testing

```bash
# Test rate limiting
npm run test:e2e rate-limit

# Simulate 25 refresh requests in 2 hours
npm run test:e2e rate-limit:quota-exceeded

# Verify stale data served on rate limit
npm run test:e2e rate-limit:stale-fallback
```

---

## Phase 4: Frontend - Rate Limit UX Integration

**Duration**: 2-3 days
**Goal**: Show user-friendly messages and stale data when rate limited

### 4.1 Create Rate Limit Context

**File**: `apps/frontend/src/contexts/RateLimitContext.tsx`

```typescript
interface RateLimitContextType {
  remaining: number;
  resetAt: Date | null;
  isLimited: boolean;
  checkStatus: () => Promise<void>;
}

export const RateLimitProvider: React.FC = ({ children }) => {
  const [remaining, setRemaining] = useState(20);
  const [resetAt, setResetAt] = useState<Date | null>(null);
  const [isLimited, setIsLimited] = useState(false);

  const checkStatus = async () => {
    const response = await fetch('/api/currencies/rate-limit-status');
    const data = await response.json();
    setRemaining(data.remaining);
    setResetAt(new Date(data.resetAt));
    setIsLimited(!data.allowed);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <RateLimitContext.Provider value={{ remaining, resetAt, isLimited, checkStatus }}>
      {children}
    </RateLimitContext.Provider>
  );
};
```

### 4.2 Create Refresh Button Component

**File**: `apps/frontend/src/components/RefreshButton/RefreshButton.tsx`

```typescript
export const RefreshButton: React.FC = () => {
  const { remaining, resetAt, isLimited } = useRateLimit();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useTranslation();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchFreshData(); // Trigger fresh fetch
    } catch (error) {
      if (error.status === 429) {
        // Show rate limit modal (handled globally)
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isLimited || isRefreshing}
      className="refresh-button"
    >
      {isRefreshing ? (
        <Spinner />
      ) : (
        <>
          <RefreshIcon />
          {!isLimited && <span className="count">{remaining}/20</span>}
        </>
      )}
    </button>
  );
};
```

### 4.3 Create Rate Limit Banner

**File**: `apps/frontend/src/components/RateLimitBanner/RateLimitBanner.tsx`

```typescript
export const RateLimitBanner: React.FC<{ retryAfter: number }> = ({ retryAfter }) => {
  const [timeLeft, setTimeLeft] = useState(retryAfter);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="rate-limit-banner">
      <ClockIcon />
      <div className="message">
        <strong>{t('rateLimitReached')}</strong>
        <p>
          {t('canRefreshIn', {
            minutes,
            seconds: seconds.toString().padStart(2, '0')
          })}
        </p>
      </div>
      <div className="stale-indicator">
        <InfoIcon />
        {t('showingCachedData')}
      </div>
    </div>
  );
};
```

### 4.4 Update API Service to Handle 429

**File**: `apps/frontend/src/services/api.ts`

```typescript
export const fetchCurrencies = async (fresh = false) => {
  try {
    const response = await fetch(`/api/currencies?fresh=${fresh}`, {
      headers: {
        'x-user-id': getUserId(), // From session/cookie
      },
    });

    if (response.status === 429) {
      const error = await response.json();
      // Show banner globally
      showRateLimitBanner(error.retryAfter);
      // Return stale data included in error response
      return error.data;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch currencies:', error);
    throw error;
  }
};
```

### 4.5 Update Translations

**Files**:
- `apps/frontend/messages/fa.json`
- `apps/frontend/messages/en.json`
- `apps/frontend/messages/ar.json`

```json
{
  "rateLimitReached": "شما به محدودیت درخواست رسیده‌اید",
  "canRefreshIn": "تا {{minutes}}:{{seconds}} دیگر می‌توانید داده جدید دریافت کنید",
  "showingCachedData": "در حال نمایش آخرین داده‌های ذخیره شده",
  "refreshRemaining": "{{count}} بار دیگر می‌توانید به‌روزرسانی کنید",
  "dataAge": "آخرین به‌روزرسانی: {{time}}"
}
```

### 4.6 Testing

```bash
# Test refresh button
npm run test src/components/RefreshButton

# Test rate limit banner display
npm run test src/components/RateLimitBanner

# E2E: Trigger rate limit and verify UI
npm run test:e2e rate-limit-ux
```

---

## Phase 5: Backend - Dynamic Scheduling

**Duration**: 3-4 days
**Goal**: Implement time-of-day and day-of-week aware scheduling

### 5.1 Create Schedule Configuration Service

**File**: `apps/backend/src/scheduler/schedule-config.service.ts`

```typescript
@Injectable()
export class ScheduleConfigService {
  private config = {
    peakHours: {
      days: [1, 2, 3], // Mon, Tue, Wed (0 = Sunday)
      startHour: 8,    // 8 AM Tehran
      endHour: 14,     // 2 PM Tehran
      interval: 10,    // minutes
    },
    normalHours: {
      days: [1, 2, 3],
      interval: 60,    // minutes
    },
    weekendHours: {
      days: [4, 5],    // Thu, Fri
      interval: 120,   // minutes
    },
    timezone: 'Asia/Tehran',
  };

  getCurrentScheduleInterval(): number {
    const now = moment().tz(this.config.timezone);
    const hour = now.hour();
    const dayOfWeek = now.day();

    // Weekend
    if (this.config.weekendHours.days.includes(dayOfWeek)) {
      return this.config.weekendHours.interval;
    }

    // Peak hours
    if (
      this.config.peakHours.days.includes(dayOfWeek) &&
      hour >= this.config.peakHours.startHour &&
      hour < this.config.peakHours.endHour
    ) {
      return this.config.peakHours.interval;
    }

    // Normal hours
    return this.config.normalHours.interval;
  }

  getNextScheduledTime(): Date {
    const intervalMinutes = this.getCurrentScheduleInterval();
    return moment()
      .tz(this.config.timezone)
      .add(intervalMinutes, 'minutes')
      .toDate();
  }

  async updateConfig(newConfig: Partial<typeof this.config>) {
    // Update config in database
    // Hot-reload scheduler
  }
}
```

### 5.2 Update Scheduler Service

**File**: `apps/backend/src/scheduler/data-fetcher-scheduler.service.ts`

```typescript
@Injectable()
export class DataFetcherSchedulerService {
  private scheduledJob: NodeJS.Timeout | null = null;

  constructor(
    private apiProvider: ApiProviderFactory,
    private currentPriceService: CurrentPriceService,
    private intradayOhlcService: IntradayOhlcService,
    private scheduleConfig: ScheduleConfigService,
  ) {}

  @OnModuleInit()
  async startDynamicScheduler() {
    this.scheduleNextFetch();
  }

  private async scheduleNextFetch() {
    const nextInterval = this.scheduleConfig.getCurrentScheduleInterval();
    const nextTime = this.scheduleConfig.getNextScheduledTime();

    console.log(
      `Next fetch scheduled at ${nextTime.toISOString()} (in ${nextInterval} minutes)`
    );

    this.scheduledJob = setTimeout(async () => {
      await this.fetchAllData();
      this.scheduleNextFetch(); // Reschedule for next interval
    }, nextInterval * 60 * 1000);
  }

  private async fetchAllData() {
    const provider = this.apiProvider.getActiveProvider();

    const [currencies, crypto, gold, coins] = await Promise.allSettled([
      provider.fetchCurrencies(),
      provider.fetchCrypto(),
      provider.fetchGold(),
      provider.fetchCoins(),
    ]);

    // Update current_prices collection
    await this.currentPriceService.updatePrices({
      currencies: currencies.status === 'fulfilled' ? currencies.value : [],
      crypto: crypto.status === 'fulfilled' ? crypto.value : [],
      gold: gold.status === 'fulfilled' ? gold.value : [],
      coins: coins.status === 'fulfilled' ? coins.value : [],
    });

    // Update intraday_ohlc collection
    await this.intradayOhlcService.recordDataPoints({...});
  }

  @OnModuleDestroy()
  async stopScheduler() {
    if (this.scheduledJob) {
      clearTimeout(this.scheduledJob);
    }
  }
}
```

### 5.3 Testing

```bash
# Test schedule calculation
npm run test scheduler/schedule-config.service

# Simulate different times and verify intervals
npm run test:e2e scheduler/dynamic-intervals

# Monitor scheduler logs for 1 hour
NODE_ENV=development npm run start:dev | grep "Next fetch scheduled"
```

---

## Phase 6: Backend - Current Day OHLC Tracking

**Duration**: 2-3 days
**Goal**: Track today's open, high, low, close, and intraday data points

### 6.1 Create Intraday OHLC Service

**File**: `apps/backend/src/intraday/intraday-ohlc.service.ts`

```typescript
@Injectable()
export class IntradayOhlcService {
  constructor(
    @InjectModel(IntradayOhlc.name)
    private intradayModel: Model<IntradayOhlc>,
  ) {}

  async recordDataPoints(data: { currencies: any[], crypto: any[], gold: any[] }) {
    const tehranNow = moment().tz('Asia/Tehran');
    const dateKey = tehranNow.format('YYYY-MM-DD');
    const jalaliDate = moment(tehranNow).format('jYYYY/jMM/jDD');
    const timeKey = tehranNow.format('HH:mm');

    const updates = [];

    // Process each item
    for (const item of [...data.currencies, ...data.crypto, ...data.gold]) {
      const price = parseFloat(item.Price || item.price);

      updates.push({
        updateOne: {
          filter: { itemCode: item.Key, date: dateKey },
          update: {
            $setOnInsert: {
              itemCode: item.Key,
              date: dateKey,
              dateJalali: jalaliDate,
              open: price,
              firstUpdate: new Date(),
            },
            $max: { high: price },
            $min: { low: price },
            $set: {
              close: price,
              lastUpdate: new Date(),
            },
            $push: {
              dataPoints: {
                $each: [{ time: timeKey, price }],
                $slice: -144, // Keep max 144 points (24h at 10min intervals)
              },
            },
            $inc: { updateCount: 1 },
          },
          upsert: true,
        },
      });
    }

    await this.intradayModel.bulkWrite(updates);
  }

  async getTodayOhlc(itemCode: string) {
    const dateKey = moment().tz('Asia/Tehran').format('YYYY-MM-DD');
    return this.intradayModel.findOne({ itemCode, date: dateKey });
  }

  async getDailyChangePercent(itemCode: string): Promise<number> {
    const today = await this.getTodayOhlc(itemCode);
    if (!today) return 0;

    const change = ((today.close - today.open) / today.open) * 100;
    return parseFloat(change.toFixed(2));
  }

  // Cleanup yesterday's data (runs daily at midnight)
  @Cron('0 0 * * *', { timeZone: 'Asia/Tehran' })
  async cleanupOldIntraday() {
    const yesterday = moment()
      .tz('Asia/Tehran')
      .subtract(2, 'days')
      .format('YYYY-MM-DD');

    const deleted = await this.intradayModel.deleteMany({
      date: { $lt: yesterday },
    });

    console.log(`Cleaned up ${deleted.deletedCount} old intraday records`);
  }
}
```

### 6.2 Add Endpoint for Current Day Data

**File**: `apps/backend/src/currencies/currencies.controller.ts`

```typescript
@Get('today/:itemCode')
async getTodayData(@Param('itemCode') itemCode: string) {
  const ohlc = await this.intradayOhlcService.getTodayOhlc(itemCode);
  const changePercent = await this.intradayOhlcService.getDailyChangePercent(itemCode);

  return {
    itemCode,
    date: ohlc.date,
    dateJalali: ohlc.dateJalali,
    open: ohlc.open,
    high: ohlc.high,
    low: ohlc.low,
    close: ohlc.close,
    change: changePercent,
    dataPoints: ohlc.dataPoints, // For mini-chart
    lastUpdate: ohlc.lastUpdate,
  };
}
```

### 6.3 Testing

```bash
# Test OHLC calculations
npm run test intraday/intraday-ohlc.service

# Simulate data points and verify high/low tracking
npm run test:e2e intraday/ohlc-tracking

# Test cleanup job
npm run test intraday/cleanup
```

---

## Phase 7: Frontend - Current Day Display

**Duration**: 2-3 days
**Goal**: Show daily change % and mini-charts on main page

### 7.1 Create Daily Change Badge

**File**: `apps/frontend/src/components/DailyChangeBadge/DailyChangeBadge.tsx`

```typescript
interface DailyChangeBadgeProps {
  change: number; // Percentage
}

export const DailyChangeBadge: React.FC<DailyChangeBadgeProps> = ({ change }) => {
  const isPositive = change >= 0;

  return (
    <div className={`daily-change ${isPositive ? 'positive' : 'negative'}`}>
      {isPositive ? <ArrowUpIcon /> : <ArrowDownIcon />}
      <span>{Math.abs(change).toFixed(2)}%</span>
    </div>
  );
};
```

**CSS**: Green for positive, red for negative, with smooth animations

### 7.2 Create Intraday Mini Chart

**File**: `apps/frontend/src/components/IntradayMiniChart/IntradayMiniChart.tsx`

```typescript
import { Line } from 'react-chartjs-2';

export const IntradayMiniChart: React.FC<{ dataPoints: DataPoint[] }> = ({ dataPoints }) => {
  const chartData = {
    labels: dataPoints.map((d) => d.time),
    datasets: [
      {
        data: dataPoints.map((d) => d.price),
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0, // Hide points for cleaner look
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  };

  return (
    <div className="mini-chart-container">
      <Line data={chartData} options={options} height={40} />
    </div>
  );
};
```

### 7.3 Update Item Card Component

**File**: `apps/frontend/src/components/ItemCard/ItemCard.tsx`

```typescript
export const ItemCard: React.FC<{ item: Item }> = ({ item }) => {
  const [todayData, setTodayData] = useState(null);

  useEffect(() => {
    fetch(`/api/currencies/today/${item.code}`)
      .then((res) => res.json())
      .then(setTodayData);
  }, [item.code]);

  return (
    <div className="item-card">
      <div className="item-header">
        <h3>{item.name}</h3>
        <DailyChangeBadge change={todayData?.change || 0} />
      </div>

      <div className="item-price">
        {item.price.toLocaleString()}
        <span className="unit">تومان</span>
      </div>

      {todayData && (
        <div className="item-range">
          <span>کمترین: {todayData.low.toLocaleString()}</span>
          <span>بیشترین: {todayData.high.toLocaleString()}</span>
        </div>
      )}

      {todayData?.dataPoints && (
        <IntradayMiniChart dataPoints={todayData.dataPoints} />
      )}
    </div>
  );
};
```

### 7.4 Testing

```bash
# Component tests
npm run test src/components/DailyChangeBadge
npm run test src/components/IntradayMiniChart

# E2E: Verify mini-chart renders
npm run test:e2e intraday-chart-display
```

---

## Phase 8: Backend - Historical Data with Tiered Storage

**Duration**: 4-5 days
**Goal**: Implement efficient historical queries with automatic aggregation

### 8.1 Create Historical OHLC Service

**File**: `apps/backend/src/historical/historical-ohlc.service.ts`

```typescript
@Injectable()
export class HistoricalOhlcService {
  constructor(
    @InjectModel(HistoricalOhlc.name)
    private historicalModel: Model<HistoricalOhlc>,
    private intradayService: IntradayOhlcService,
  ) {}

  async getChartData(
    itemCode: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OhlcDataPoint[]> {
    const daysRange = moment(endDate).diff(moment(startDate), 'days');

    // Determine optimal timeframe
    let timeframe: string;
    if (daysRange <= 1) {
      // Today or yesterday: Use intraday 10-min data
      return this.getIntradayData(itemCode, startDate, endDate);
    } else if (daysRange <= 7) {
      timeframe = '10m'; // Detailed for last week
    } else if (daysRange <= 90) {
      timeframe = '1h'; // Hourly for 3 months
    } else {
      timeframe = '1d'; // Daily for long-term
    }

    return this.historicalModel
      .find({
        itemCode,
        timeframe,
        timestamp: { $gte: startDate, $lte: endDate },
      })
      .sort({ timestamp: 1 })
      .select('timestamp open high low close')
      .lean();
  }

  private async getIntradayData(
    itemCode: string,
    startDate: Date,
    endDate: Date,
  ) {
    const dateKey = moment(startDate).tz('Asia/Tehran').format('YYYY-MM-DD');
    const intraday = await this.intradayService.getTodayOhlc(itemCode);

    if (!intraday) return [];

    // Convert dataPoints to OHLC format
    return intraday.dataPoints.map((point) => ({
      timestamp: moment(`${dateKey} ${point.time}`, 'YYYY-MM-DD HH:mm').toDate(),
      open: point.price,
      high: point.price,
      low: point.price,
      close: point.price,
    }));
  }

  // Aggregate 10-min data to 1-hour (runs every hour)
  @Cron('0 * * * *')
  async aggregateToHourly() {
    const sevenDaysAgo = moment().subtract(7, 'days').toDate();
    const ninetyDaysAgo = moment().subtract(90, 'days').toDate();

    // Find 10-min data older than 7 days
    const oldData = await this.historicalModel
      .find({
        timeframe: '10m',
        timestamp: { $gte: ninetyDaysAgo, $lt: sevenDaysAgo },
      })
      .sort({ itemCode: 1, timestamp: 1 });

    // Group by itemCode and hour
    const grouped = this.groupByHour(oldData);

    // Create hourly aggregates
    const hourlyData = grouped.map((group) => ({
      itemCode: group.itemCode,
      timestamp: group.hourStart,
      date: moment(group.hourStart).tz('Asia/Tehran').format('YYYY-MM-DD'),
      timeframe: '1h',
      open: group.data[0].open,
      high: Math.max(...group.data.map((d) => d.high)),
      low: Math.min(...group.data.map((d) => d.low)),
      close: group.data[group.data.length - 1].close,
      dataPoints: group.data.length,
      isComplete: true,
    }));

    // Insert hourly data
    await this.historicalModel.insertMany(hourlyData);

    // Delete old 10-min data
    await this.historicalModel.deleteMany({
      timeframe: '10m',
      timestamp: { $lt: sevenDaysAgo },
    });

    console.log(`Aggregated ${oldData.length} 10-min records to ${hourlyData.length} hourly`);
  }

  // Aggregate 1-hour data to daily (runs daily at midnight)
  @Cron('0 0 * * *', { timeZone: 'Asia/Tehran' })
  async aggregateToDaily() {
    const ninetyDaysAgo = moment().subtract(90, 'days').toDate();

    // Find hourly data older than 90 days
    const oldData = await this.historicalModel
      .find({
        timeframe: '1h',
        timestamp: { $lt: ninetyDaysAgo },
      })
      .sort({ itemCode: 1, timestamp: 1 });

    const grouped = this.groupByDay(oldData);

    const dailyData = grouped.map((group) => ({
      itemCode: group.itemCode,
      timestamp: group.dayStart,
      date: moment(group.dayStart).format('YYYY-MM-DD'),
      timeframe: '1d',
      open: group.data[0].open,
      high: Math.max(...group.data.map((d) => d.high)),
      low: Math.min(...group.data.map((d) => d.low)),
      close: group.data[group.data.length - 1].close,
      dataPoints: group.data.length,
      isComplete: true,
    }));

    await this.historicalModel.insertMany(dailyData);

    await this.historicalModel.deleteMany({
      timeframe: '1h',
      timestamp: { $lt: ninetyDaysAgo },
    });

    console.log(`Aggregated ${oldData.length} hourly records to ${dailyData.length} daily`);
  }

  private groupByHour(data: any[]) {
    // Implementation: Group data points by hour
  }

  private groupByDay(data: any[]) {
    // Implementation: Group data points by day
  }
}
```

### 8.2 Update Chart Controller

**File**: `apps/backend/src/chart/chart.controller.ts`

```typescript
@Controller('api/chart')
export class ChartController {
  constructor(private historicalService: HistoricalOhlcService) {}

  @Get(':itemCode')
  async getChart(
    @Param('itemCode') itemCode: string,
    @Query('range') range: '1d' | '1w' | '1m' | '3m' | '1y' | 'all',
  ) {
    const { startDate, endDate } = this.getDateRange(range);

    const data = await this.historicalService.getChartData(
      itemCode,
      startDate,
      endDate,
    );

    return {
      itemCode,
      range,
      startDate,
      endDate,
      dataPoints: data.length,
      data,
    };
  }

  private getDateRange(range: string) {
    const end = moment().tz('Asia/Tehran');
    let start: moment.Moment;

    switch (range) {
      case '1d':
        start = end.clone().startOf('day');
        break;
      case '1w':
        start = end.clone().subtract(7, 'days');
        break;
      case '1m':
        start = end.clone().subtract(1, 'month');
        break;
      case '3m':
        start = end.clone().subtract(3, 'months');
        break;
      case '1y':
        start = end.clone().subtract(1, 'year');
        break;
      case 'all':
        start = moment('2024-01-01'); // Arbitrary start
        break;
    }

    return {
      startDate: start.toDate(),
      endDate: end.toDate(),
    };
  }
}
```

### 8.3 Testing

```bash
# Test tiered queries
npm run test:e2e historical/tiered-queries

# Test aggregation jobs
npm run test historical/aggregation

# Verify performance (query time < 100ms)
npm run test:e2e historical/performance
```

---

## Phase 9: Frontend - Date Picker Integration

**Duration**: 3-4 days
**Goal**: Add Iranian and Gregorian date pickers with input support

### 9.1 Install Date Picker Libraries

```bash
npm install react-datepicker
npm install react-persian-datepicker
npm install moment-jalaali
```

### 9.2 Create Dual Date Picker Component

**File**: `apps/frontend/src/components/DatePicker/DualDatePicker.tsx`

```typescript
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import { Calendar } from 'react-persian-datepicker';
import moment from 'moment-jalaali';

export const DualDatePicker: React.FC<{ onDateChange: (date: Date) => void }> = ({
  onDateChange,
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pickerType, setPickerType] = useState<'jalali' | 'gregorian'>('jalali');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleJalaliChange = (unix: number) => {
    const date = moment.unix(unix).toDate();
    setSelectedDate(date);
    onDateChange(date);
    setIsPickerOpen(false);
  };

  const handleGregorianChange = (date: Date) => {
    setSelectedDate(date);
    onDateChange(date);
    setIsPickerOpen(false);
  };

  return (
    <div className="dual-date-picker">
      <div className="date-display">
        <button
          onClick={() => {
            setPickerType('jalali');
            setIsPickerOpen(true);
          }}
          className="date-button jalali"
        >
          {moment(selectedDate).format('jYYYY/jMM/jDD')}
        </button>

        <button
          onClick={() => {
            setPickerType('gregorian');
            setIsPickerOpen(true);
          }}
          className="date-button gregorian"
        >
          {moment(selectedDate).format('YYYY-MM-DD')}
        </button>
      </div>

      {isPickerOpen && (
        <div className="picker-modal">
          {pickerType === 'jalali' ? (
            <Calendar
              value={moment(selectedDate).unix()}
              onChange={handleJalaliChange}
              onClickOutside={() => setIsPickerOpen(false)}
            />
          ) : (
            <DatePicker
              selected={selectedDate}
              onChange={handleGregorianChange}
              maxDate={new Date()}
              inline
            />
          )}
        </div>
      )}
    </div>
  );
};
```

### 9.3 Create Date Input Component

**File**: `apps/frontend/src/components/DateInput/DateInput.tsx`

```typescript
export const DateInput: React.FC<{ type: 'jalali' | 'gregorian' }> = ({ type }) => {
  const [inputValue, setInputValue] = useState('');
  const [isValid, setIsValid] = useState(true);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Validate based on type
    if (type === 'jalali') {
      const isValidJalali = /^\d{4}\/\d{2}\/\d{2}$/.test(value);
      setIsValid(isValidJalali && moment(value, 'jYYYY/jMM/jDD').isValid());
    } else {
      const isValidGregorian = /^\d{4}-\d{2}-\d{2}$/.test(value);
      setIsValid(isValidGregorian && moment(value, 'YYYY-MM-DD').isValid());
    }
  };

  const handleSubmit = () => {
    if (!isValid) return;

    const date =
      type === 'jalali'
        ? moment(inputValue, 'jYYYY/jMM/jDD').toDate()
        : moment(inputValue, 'YYYY-MM-DD').toDate();

    onDateChange(date);
  };

  return (
    <div className="date-input">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={type === 'jalali' ? '1403/10/27' : '2025-01-16'}
        className={!isValid ? 'invalid' : ''}
      />
      <button onClick={handleSubmit} disabled={!isValid}>
        Go
      </button>
      {!isValid && <span className="error">فرمت تاریخ نامعتبر است</span>}
    </div>
  );
};
```

### 9.4 Update Calendar Page

**File**: `apps/frontend/src/pages/Calendar/CalendarPage.tsx`

```typescript
export const CalendarPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [historicalData, setHistoricalData] = useState(null);

  useEffect(() => {
    const dateStr = moment(selectedDate).format('YYYY-MM-DD');
    fetch(`/api/historical/${dateStr}`)
      .then((res) => res.json())
      .then(setHistoricalData);
  }, [selectedDate]);

  return (
    <div className="calendar-page">
      <header>
        <h1>تاریخچه قیمت‌ها</h1>
        <DualDatePicker onDateChange={setSelectedDate} />
      </header>

      <div className="navigation-controls">
        <button onClick={() => setSelectedDate(moment(selectedDate).subtract(1, 'day').toDate())}>
          روز قبل
        </button>
        <DateInput type="jalali" />
        <button onClick={() => setSelectedDate(moment(selectedDate).add(1, 'day').toDate())}>
          روز بعد
        </button>
      </div>

      {historicalData && (
        <ItemList items={historicalData.items} date={selectedDate} />
      )}
    </div>
  );
};
```

### 9.5 Testing

```bash
# Component tests
npm run test src/components/DatePicker
npm run test src/components/DateInput

# E2E: Select date and verify data loads
npm run test:e2e calendar-date-selection
```

---

## Phase 10: Backend - Admin Panel APIs

**Duration**: 3-4 days
**Goal**: APIs to manage tracked items, schedules, and configurations

### 10.1 Create Admin Controller

**File**: `apps/backend/src/admin/admin.controller.ts`

```typescript
@Controller('api/admin')
@UseGuards(AdminGuard) // Protect all admin routes
export class AdminController {
  constructor(
    private trackedItemService: TrackedItemService,
    private apiProvider: ApiProviderFactory,
    private scheduleConfig: ScheduleConfigService,
  ) {}

  // List all available items from PersianAPI
  @Get('items/available')
  async getAvailableItems() {
    const provider = this.apiProvider.getActiveProvider();
    return provider.getAvailableItems();
  }

  // List currently tracked items
  @Get('items/tracked')
  async getTrackedItems() {
    return this.trackedItemService.findAll();
  }

  // Enable tracking for an item
  @Post('items/enable')
  async enableItem(@Body() dto: EnableItemDto) {
    return this.trackedItemService.enable(dto.itemCode, dto.itemType);
  }

  // Disable tracking
  @Delete('items/:itemCode')
  async disableItem(@Param('itemCode') itemCode: string) {
    return this.trackedItemService.disable(itemCode);
  }

  // Get current schedule config
  @Get('schedule/config')
  async getScheduleConfig() {
    return this.scheduleConfig.getConfig();
  }

  // Update schedule config
  @Put('schedule/config')
  async updateScheduleConfig(@Body() config: ScheduleConfigDto) {
    return this.scheduleConfig.updateConfig(config);
  }

  // Get rate limit settings
  @Get('rate-limit/config')
  async getRateLimitConfig() {
    return {
      freshRequestLimit: 20,
      windowDuration: 2 * 60 * 60 * 1000, // 2 hours
    };
  }

  // Update rate limit settings
  @Put('rate-limit/config')
  async updateRateLimitConfig(@Body() config: RateLimitConfigDto) {
    // Update config in database
    return config;
  }
}
```

### 10.2 Create Tracked Item Service

**File**: `apps/backend/src/admin/tracked-item.service.ts`

```typescript
@Injectable()
export class TrackedItemService {
  constructor(
    @InjectModel(TrackedItem.name)
    private trackedItemModel: Model<TrackedItem>,
  ) {}

  async findAll() {
    return this.trackedItemModel.find().sort({ itemType: 1, itemCode: 1 });
  }

  async enable(itemCode: string, itemType: string) {
    return this.trackedItemModel.updateOne(
      { itemCode },
      {
        $set: { enabled: true },
        $setOnInsert: {
          itemCode,
          itemType,
          displayName: { fa: itemCode, en: itemCode, ar: itemCode }, // Default
          provider: 'persianapi',
          metadata: {},
        },
      },
      { upsert: true },
    );
  }

  async disable(itemCode: string) {
    return this.trackedItemModel.updateOne({ itemCode }, { $set: { enabled: false } });
  }
}
```

### 10.3 Testing

```bash
# Test admin APIs
npm run test:e2e admin/items
npm run test:e2e admin/schedule
npm run test:e2e admin/rate-limit

# Test authorization (should reject non-admin)
npm run test:e2e admin/auth
```

---

## Phase 11: Frontend - Admin Panel UI

**Duration**: 3-4 days
**Goal**: Admin interface to manage items and settings

### 11.1 Create Admin Layout

**File**: `apps/frontend/src/pages/Admin/AdminLayout.tsx`

```typescript
export const AdminLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState('items');

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Admin Panel</h2>
        <nav>
          <button onClick={() => setActiveTab('items')}>Tracked Items</button>
          <button onClick={() => setActiveTab('schedule')}>Schedule Config</button>
          <button onClick={() => setActiveTab('rate-limits')}>Rate Limits</button>
        </nav>
      </aside>

      <main className="admin-content">
        {activeTab === 'items' && <ItemManagement />}
        {activeTab === 'schedule' && <ScheduleConfig />}
        {activeTab === 'rate-limits' && <RateLimitConfig />}
      </main>
    </div>
  );
};
```

### 11.2 Create Item Management Component

**File**: `apps/frontend/src/pages/Admin/ItemManagement.tsx`

```typescript
export const ItemManagement: React.FC = () => {
  const [availableItems, setAvailableItems] = useState([]);
  const [trackedItems, setTrackedItems] = useState([]);

  useEffect(() => {
    fetch('/api/admin/items/available').then((res) => res.json()).then(setAvailableItems);
    fetch('/api/admin/items/tracked').then((res) => res.json()).then(setTrackedItems);
  }, []);

  const handleEnable = async (itemCode: string, itemType: string) => {
    await fetch('/api/admin/items/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemCode, itemType }),
    });
    // Refresh tracked items
  };

  const handleDisable = async (itemCode: string) => {
    await fetch(`/api/admin/items/${itemCode}`, { method: 'DELETE' });
    // Refresh tracked items
  };

  return (
    <div className="item-management">
      <section>
        <h3>Currently Tracked ({trackedItems.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Name</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {trackedItems.map((item) => (
              <tr key={item.itemCode}>
                <td>{item.itemCode}</td>
                <td>{item.itemType}</td>
                <td>{item.displayName.fa}</td>
                <td>
                  <button onClick={() => handleDisable(item.itemCode)}>Disable</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Available Items</h3>
        <div className="available-items-grid">
          {availableItems.map((item) => (
            <div key={item.code} className="item-card">
              <span>{item.name}</span>
              <button onClick={() => handleEnable(item.code, item.type)}>Add</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
```

### 11.3 Create Schedule Config Component

**File**: `apps/frontend/src/pages/Admin/ScheduleConfig.tsx`

```typescript
export const ScheduleConfig: React.FC = () => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch('/api/admin/schedule/config')
      .then((res) => res.json())
      .then(setConfig);
  }, []);

  const handleSave = async () => {
    await fetch('/api/admin/schedule/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    alert('Schedule updated successfully');
  };

  if (!config) return <Spinner />;

  return (
    <div className="schedule-config">
      <h3>Schedule Configuration</h3>

      <div className="config-group">
        <label>Peak Hours (Mon-Wed 8 AM - 2 PM)</label>
        <input
          type="number"
          value={config.peakHours.interval}
          onChange={(e) =>
            setConfig({
              ...config,
              peakHours: { ...config.peakHours, interval: +e.target.value },
            })
          }
        />
        <span>minutes</span>
      </div>

      <div className="config-group">
        <label>Normal Hours Interval</label>
        <input
          type="number"
          value={config.normalHours.interval}
          onChange={(e) =>
            setConfig({
              ...config,
              normalHours: { ...config.normalHours, interval: +e.target.value },
            })
          }
        />
        <span>minutes</span>
      </div>

      <div className="config-group">
        <label>Weekend Interval (Thu-Fri)</label>
        <input
          type="number"
          value={config.weekendHours.interval}
          onChange={(e) =>
            setConfig({
              ...config,
              weekendHours: { ...config.weekendHours, interval: +e.target.value },
            })
          }
        />
        <span>minutes</span>
      </div>

      <button onClick={handleSave}>Save Configuration</button>
    </div>
  );
};
```

### 11.4 Testing

```bash
# Component tests
npm run test src/pages/Admin

# E2E: Add/remove tracked items
npm run test:e2e admin-item-management

# E2E: Update schedule config
npm run test:e2e admin-schedule-config
```

---

## Phase 12: Frontend - Enhanced Chart with Zoom

**Duration**: 3-4 days
**Goal**: Update chart component to use new API and support zoom

### 12.1 Update Chart Component

**File**: `apps/frontend/src/components/Chart/AdvancedChart.tsx`

```typescript
import { Line } from 'react-chartjs-2';
import { useState, useEffect } from 'react';

export const AdvancedChart: React.FC<{ itemCode: string }> = ({ itemCode }) => {
  const [range, setRange] = useState<'1d' | '1w' | '1m' | '3m' | '1y' | 'all'>('1w');
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/chart/${itemCode}?range=${range}`)
      .then((res) => res.json())
      .then((data) => {
        setChartData({
          labels: data.data.map((d) => moment(d.timestamp).format('YYYY-MM-DD HH:mm')),
          datasets: [
            {
              label: 'Price',
              data: data.data.map((d) => d.close),
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.1,
            },
          ],
        });
        setIsLoading(false);
      });
  }, [itemCode, range]);

  return (
    <div className="advanced-chart">
      <div className="chart-controls">
        <button onClick={() => setRange('1d')} className={range === '1d' ? 'active' : ''}>
          1D
        </button>
        <button onClick={() => setRange('1w')} className={range === '1w' ? 'active' : ''}>
          1W
        </button>
        <button onClick={() => setRange('1m')} className={range === '1m' ? 'active' : ''}>
          1M
        </button>
        <button onClick={() => setRange('3m')} className={range === '3m' ? 'active' : ''}>
          3M
        </button>
        <button onClick={() => setRange('1y')} className={range === '1y' ? 'active' : ''}>
          1Y
        </button>
        <button onClick={() => setRange('all')} className={range === 'all' ? 'active' : ''}>
          All
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <Line
          data={chartData}
          options={{
            responsive: true,
            plugins: {
              zoom: {
                pan: { enabled: true, mode: 'x' },
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
              },
            },
          }}
        />
      )}
    </div>
  );
};
```

### 12.2 Add Zoom Plugin

```bash
npm install chartjs-plugin-zoom
```

### 12.3 Testing

```bash
# Component test
npm run test src/components/Chart/AdvancedChart

# E2E: Change range and verify data updates
npm run test:e2e chart-range-selection

# E2E: Test zoom functionality
npm run test:e2e chart-zoom
```

---

## Phase 13: Testing & Quality Assurance

**Duration**: 5-7 days
**Goal**: Comprehensive testing before production deployment

### 13.1 Backend Unit Tests

Target: >80% code coverage

```bash
npm run test:cov

# Focus areas:
# - API provider adapters
# - Rate limiting logic
# - OHLC calculations
# - Date/timezone handling
# - Aggregation algorithms
```

### 13.2 Backend Integration Tests

```bash
npm run test:e2e

# Test scenarios:
# - PersianAPI integration (mock API)
# - Database operations
# - Scheduler execution
# - Cache invalidation
# - Error handling
```

### 13.3 Frontend Unit Tests

```bash
npm run test src/

# Focus:
# - Component rendering
# - State management
# - User interactions
# - Error boundaries
```

### 13.4 Frontend E2E Tests

```bash
npm run test:e2e

# User flows:
# 1. View main page, see current prices
# 2. Click refresh button 21 times, verify rate limit message
# 3. Select date from calendar, verify historical data loads
# 4. Switch between Iranian and Gregorian dates
# 5. View chart, change time ranges
# 6. Admin: Add new tracked item
```

### 13.5 Performance Testing

```bash
# Load testing with artillery or k6
k6 run load-test.js

# Scenarios:
# - 100 concurrent users browsing main page
# - 50 users refreshing simultaneously
# - Historical queries under load
# - Database query performance
```

**Acceptance Criteria**:
- API response time < 200ms (95th percentile)
- Chart loading < 500ms
- Database queries < 100ms
- No memory leaks over 24-hour run

### 13.6 Security Testing

```bash
# SQL injection tests (should fail - using NoSQL)
# NoSQL injection tests
# Rate limit bypass attempts
# Admin panel authorization
# API key exposure checks
```

---

## Phase 14: Data Migration & Deployment

**Duration**: 3-5 days
**Goal**: Migrate production data and deploy new system

### 14.1 Backup Current Production Data

```bash
# MongoDB backup
mongodump --uri="mongodb://production" --out=/backup/pre-migration

# Verify backup
mongorestore --uri="mongodb://test" --dir=/backup/pre-migration
```

### 14.2 Run Migration Script

```bash
# On production database (during low-traffic window)
NODE_ENV=production npm run migrate:new-schema

# Verify data integrity
npm run verify:migration
```

### 14.3 Deploy Backend (Blue-Green Deployment)

**Step 1**: Deploy new backend to "green" environment
**Step 2**: Run smoke tests on green
**Step 3**: Switch traffic from blue to green (load balancer)
**Step 4**: Monitor for 1 hour
**Step 5**: If issues, rollback to blue; else, keep green

```bash
# Deploy to green environment
pm2 start ecosystem.green.js

# Run smoke tests
npm run test:smoke

# Switch traffic (via nginx/load balancer)
nginx -s reload

# Monitor
pm2 monit
```

### 14.4 Deploy Frontend

```bash
# Build production bundle
npm run build

# Upload to CDN/hosting
aws s3 sync dist/ s3://production-bucket/ --delete

# Invalidate CDN cache
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

### 14.5 Post-Deployment Monitoring

**First 24 Hours**:
- Monitor error rates
- Check API response times
- Verify scheduler is running
- Watch database CPU/memory
- Track user complaints

**First Week**:
- Review rate limit violations
- Check data accuracy vs old system
- Monitor storage growth
- Verify aggregation jobs running

---

## Phase 15: Documentation & Knowledge Transfer

**Duration**: 2-3 days
**Goal**: Document new system for maintenance

### 15.1 Technical Documentation

Create docs:
- **API Documentation**: OpenAPI/Swagger specs
- **Database Schema**: ERD diagrams, collection descriptions
- **Architecture Diagram**: System components and data flow
- **Deployment Guide**: Step-by-step deployment process
- **Troubleshooting Guide**: Common issues and solutions

### 15.2 Admin Guide

- How to add/remove tracked items
- How to adjust scheduling
- How to modify rate limits
- How to interpret monitoring dashboards

### 15.3 Developer Guide

- Local development setup
- Running tests
- Adding new API providers
- Extending the system

---

## Rollback Plan

If critical issues arise after deployment:

### Quick Rollback (< 5 minutes)
1. Switch load balancer back to old (blue) environment
2. Revert DNS if needed
3. Announce rollback to team

### Database Rollback (if needed)
1. Stop new backend
2. Restore from pre-migration backup
3. Restart old backend
4. Verify data integrity

### Partial Rollback
- Can roll back only frontend (keep new backend)
- Can roll back only backend (serve old API to old frontend)

---

## Timeline Summary

| Phase | Duration | Cumulative Days |
|-------|----------|----------------|
| 1. Backend API Integration | 3-5 days | 5 |
| 2. Backend DB Redesign | 4-6 days | 11 |
| 3. Backend Rate Limiting | 2-3 days | 14 |
| 4. Frontend Rate Limit UX | 2-3 days | 17 |
| 5. Backend Dynamic Scheduling | 3-4 days | 21 |
| 6. Backend Current Day OHLC | 2-3 days | 24 |
| 7. Frontend Daily Display | 2-3 days | 27 |
| 8. Backend Historical Data | 4-5 days | 32 |
| 9. Frontend Date Picker | 3-4 days | 36 |
| 10. Backend Admin APIs | 3-4 days | 40 |
| 11. Frontend Admin UI | 3-4 days | 44 |
| 12. Frontend Enhanced Charts | 3-4 days | 48 |
| 13. Testing & QA | 5-7 days | 55 |
| 14. Migration & Deployment | 3-5 days | 60 |
| 15. Documentation | 2-3 days | 63 |

**Total Estimated Duration**: 55-63 days (~2-3 months)

**With 2-person team**: ~6-8 weeks
**With 3-person team**: ~4-6 weeks

---

## Success Metrics

### Technical Metrics
- ✅ API response time < 200ms (95th percentile)
- ✅ Database query time < 100ms
- ✅ Code coverage > 80%
- ✅ Zero downtime deployment
- ✅ Successful data migration (100% integrity)

### User Experience Metrics
- ✅ Rate limit complaints reduced by 90%
- ✅ Users can test app without hitting limits
- ✅ Stale data shown instead of errors
- ✅ Date navigation improved (date picker usage > 30%)
- ✅ Current day charts increase engagement

### Business Metrics
- ✅ Admin can add new items in < 1 minute (vs 30-60 min)
- ✅ System handles 10x current user load
- ✅ Storage costs controlled (automatic aggregation)
- ✅ Reduced developer maintenance time

---

## Post-Launch Improvements (Future Phases)

### Phase 16: Real-Time Updates (Optional)
- WebSocket integration for live price updates
- Push notifications for price alerts
- Real-time mini-charts

### Phase 17: Advanced Analytics (Optional)
- Price prediction models
- Volatility indicators
- Correlation analysis between items

### Phase 18: Mobile App (Optional)
- React Native mobile app
- Push notifications
- Offline mode with cached data

---

## Conclusion

This implementation plan provides a systematic approach to migrating from Navasan API to PersianAPI while adding requested features. The phased approach ensures:

1. **Minimal Risk**: Each phase is independently testable
2. **Continuous Value**: Features delivered incrementally
3. **Rollback Safety**: Can revert at any phase
4. **Quality Focus**: Testing integrated throughout

By following this plan, you'll have a robust, user-friendly system that addresses all identified problems and provides a solid foundation for future growth.
