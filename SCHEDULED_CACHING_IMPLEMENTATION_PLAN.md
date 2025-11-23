# Scheduled Hourly API Caching Implementation Plan

**Date Created:** 2025-11-08
**Project:** Currency Tracker Application
**Feature:** Proactive Scheduled Data Fetching from Navasan API

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture](#current-architecture)
3. [Proposed Solution](#proposed-solution)
4. [Implementation Steps](#implementation-steps)
5. [Code Changes](#code-changes)
6. [Testing Plan](#testing-plan)
7. [Deployment Checklist](#deployment-checklist)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Trade-offs & Decisions](#trade-offs--decisions)

---

## Problem Statement

### Current Issue
- **Symptom:** When Navasan API key expires, application shows no data to users
- **Root Cause:** Cached data in MongoDB is too old (19 days old, exceeds 24-hour stale cache TTL)
- **Impact:** Poor user experience during API downtime or key expiration

### MongoDB Cache Status (as of 2025-11-08)
```
Total cache documents: 3 (currencies, crypto, gold)
Age: 453 hours (~19 days old)
Price snapshots: 0
cacheType: undefined (old schema)
```

### User Requirement
> "Make an API call for everything we have available once per hour and record it in db, and when API key is available we show that data, when it is not available we show data from our own db"

---

## Current Architecture

### How Reactive Caching Works (Current Implementation)

```
┌─────────────┐
│   Frontend  │
│   Request   │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Check Fresh Cache    │
│ (< 5 minutes old)    │
└──────┬───────────────┘
       │
       ├─── YES ──> Return cached data
       │
       └─── NO ──> Fetch from Navasan API
                   │
                   ├─── SUCCESS ──> Save to 3 caches
                   │                (fresh, stale, snapshot)
                   │
                   └─── FAILURE ──> Check stale cache (< 24hrs)
                                    │
                                    ├─── EXISTS ──> Return stale
                                    │
                                    └─── NONE ──> Error ❌
```

### Cache Tiers (Location: `apps/backend/src/navasan/navasan.service.ts`)

| Tier | TTL | Purpose |
|------|-----|---------|
| Fresh Cache | 5 minutes | Primary data source for recent requests |
| Stale Cache | 24 hours | Fallback when API fails |
| Price Snapshots | 90 days | Historical price tracking (permanent storage) |

### Problems with Reactive Approach
1. ❌ **Dependency on user requests** - No users = no cache updates
2. ❌ **Rapid degradation** - 5-minute fresh cache expires quickly
3. ❌ **Short fallback window** - 24-hour stale cache too short for API key renewal cycles
4. ❌ **No guaranteed data availability** - If both caches expire, app breaks

---

## Proposed Solution

### Proactive Scheduled Caching

**Core Concept:** Background job fetches data every hour, independent of user requests.

```
┌─────────────────────┐
│   Cron Scheduler    │
│  (Every 1 hour)     │
└──────┬──────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Fetch All Categories:        │
│ - currencies                 │
│ - crypto                     │
│ - gold                       │
└──────┬───────────────────────┘
       │
       ├─── SUCCESS ──> Save to MongoDB
       │                (all 3 cache tiers)
       │
       └─── FAILURE ──> Log error
                        Keep previous cache valid
                        Alert admin

┌─────────────┐
│   Frontend  │──> Always reads from MongoDB
│   Request   │    (data max 1 hour old)
└─────────────┘
```

### Key Benefits

✅ **Guaranteed data freshness** - Maximum 1 hour old
✅ **Survives API downtime** - Last successful fetch remains available
✅ **Predictable API usage** - Exactly 72 calls/day (3 categories × 24 hours)
✅ **Better user experience** - Always shows data with clear timestamp
✅ **Simplified frontend** - No complex fallback logic needed

---

## Implementation Steps

### Phase 1: Setup (Estimated: 15-30 minutes)

#### Step 1.1: Install Dependencies

```bash
cd apps/backend
npm install @nestjs/schedule
```

**Package Info:**
- Name: `@nestjs/schedule`
- Version: `^4.0.0`
- Purpose: Provides cron job decorators for NestJS

#### Step 1.2: Create Scheduler Module

**File:** `apps/backend/src/scheduler/scheduler.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NavasanSchedulerService } from './navasan-scheduler.service';
import { NavasanModule } from '../navasan/navasan.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron functionality
    NavasanModule, // Import to use NavasanService
  ],
  providers: [NavasanSchedulerService],
  exports: [NavasanSchedulerService], // Export for potential use in other modules
})
export class SchedulerModule {}
```

#### Step 1.3: Create Scheduler Service

**File:** `apps/backend/src/scheduler/navasan-scheduler.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { NavasanService } from '../navasan/navasan.service';

@Injectable()
export class NavasanSchedulerService {
  private readonly logger = new Logger(NavasanSchedulerService.name);
  private isRunning = false; // Prevent concurrent executions

  constructor(
    private readonly navasanService: NavasanService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.logger.log('📅 Navasan Scheduler initialized');
  }

  /**
   * Scheduled job: Fetch all Navasan data every hour
   * Runs at minute 0 of every hour (00:00, 01:00, 02:00, etc.)
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'navasan-hourly-fetch',
    timeZone: 'UTC', // Use UTC for consistency
  })
  async fetchAllData() {
    // Prevent concurrent executions
    if (this.isRunning) {
      this.logger.warn('⚠️  Previous scheduled fetch still running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    this.logger.log('⏰ === HOURLY SCHEDULED FETCH STARTED ===');

    try {
      // Fetch all three categories in parallel
      const results = await Promise.allSettled([
        this.navasanService.getCurrencies(),
        this.navasanService.getCrypto(),
        this.navasanService.getGold(),
      ]);

      // Process results
      const [currencies, crypto, gold] = results;

      // Log individual results
      this.logFetchResult('Currencies', currencies);
      this.logFetchResult('Crypto', crypto);
      this.logFetchResult('Gold', gold);

      // Calculate statistics
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      const duration = Date.now() - startTime;

      // Final summary
      this.logger.log(
        `⏰ === HOURLY FETCH COMPLETED === ` +
        `Success: ${successCount}/3 | Failed: ${failureCount}/3 | Duration: ${duration}ms`
      );

      // Alert if all fetches failed
      if (successCount === 0) {
        this.logger.error('🚨 CRITICAL: All scheduled fetches failed! Check API key and connectivity.');
        // TODO: Send alert notification (email/Slack/etc.)
      }

    } catch (error) {
      this.logger.error(`❌ Unexpected error in scheduled fetch: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Helper: Log individual fetch result
   */
  private logFetchResult(category: string, result: PromiseSettledResult<any>) {
    if (result.status === 'fulfilled') {
      const metadata = result.value?.metadata;
      const source = metadata?.source || 'unknown';
      const isStale = metadata?.isStale || false;

      this.logger.log(
        `✅ ${category} fetched successfully ` +
        `[source: ${source}, stale: ${isStale}]`
      );
    } else {
      this.logger.error(
        `❌ ${category} fetch failed: ${result.reason?.message || result.reason}`
      );
    }
  }

  /**
   * Manual trigger for testing or admin panel
   */
  async triggerManualFetch(): Promise<{ success: boolean; message: string }> {
    this.logger.log('🔧 Manual fetch triggered by admin');

    try {
      await this.fetchAllData();
      return {
        success: true,
        message: 'Manual fetch completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Manual fetch failed: ${error.message}`,
      };
    }
  }

  /**
   * Get next scheduled run time (for admin dashboard)
   */
  getNextRunTime(): Date {
    const job = this.schedulerRegistry.getCronJob('navasan-hourly-fetch');
    return job.nextDate().toJSDate();
  }
}
```

#### Step 1.4: Register Scheduler Module

**File:** `apps/backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { NavasanModule } from './navasan/navasan.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletsModule } from './wallets/wallets.module';
import { SchedulerModule } from './scheduler/scheduler.module'; // ← ADD THIS

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/currency-tracker',
    ),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute
      },
    ]),
    NavasanModule,
    UsersModule,
    AuthModule,
    WalletsModule,
    SchedulerModule, // ← ADD THIS LINE
  ],
})
export class AppModule {}
```

---

### Phase 2: Optional Enhancements (Estimated: 30-60 minutes)

#### Enhancement 2.1: Add Force Fetch Method to NavasanService

**File:** `apps/backend/src/navasan/navasan.service.ts`

**Add this new method after the existing `getGold()` method:**

```typescript
/**
 * Force fetch from API and update all caches
 * Used by scheduler to proactively cache data
 * Bypasses fresh cache check and always hits the API
 */
async forceFetchAndCache(
  category: 'all' | 'currencies' | 'crypto' | 'gold'
): Promise<{ success: boolean; error?: string }> {
  this.validateCategory(category);
  const items = this.items[category];

  try {
    this.logger.log(`🔄 Force fetching ${category} from API...`);

    const apiResponse = await this.fetchFromApiWithTimeout(items);

    // Save to all three cache tiers
    await this.saveToFreshCacheWithRetry(category, apiResponse.data, apiResponse.metadata);
    await this.saveToStaleCacheWithRetry(category, apiResponse.data, apiResponse.metadata);
    await this.savePriceSnapshot(category, apiResponse.data, apiResponse.metadata);

    this.logger.log(`✅ Force fetch successful for ${category}`);
    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`❌ Force fetch failed for ${category}: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  }
}
```

**Then update the scheduler to use this method:**

```typescript
// In navasan-scheduler.service.ts, replace fetchAllData() with:

@Cron(CronExpression.EVERY_HOUR, {
  name: 'navasan-hourly-fetch',
  timeZone: 'UTC',
})
async fetchAllData() {
  if (this.isRunning) {
    this.logger.warn('⚠️  Previous scheduled fetch still running, skipping...');
    return;
  }

  this.isRunning = true;
  const startTime = Date.now();

  this.logger.log('⏰ === HOURLY SCHEDULED FETCH STARTED ===');

  try {
    // Use forceFetchAndCache for guaranteed API hits
    const results = await Promise.allSettled([
      this.navasanService.forceFetchAndCache('currencies'),
      this.navasanService.forceFetchAndCache('crypto'),
      this.navasanService.forceFetchAndCache('gold'),
    ]);

    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length;

    const duration = Date.now() - startTime;

    this.logger.log(
      `⏰ === HOURLY FETCH COMPLETED === ` +
      `Success: ${successCount}/3 | Duration: ${duration}ms`
    );

    if (successCount === 0) {
      this.logger.error('🚨 CRITICAL: All scheduled fetches failed!');
    }

  } catch (error) {
    this.logger.error(`❌ Unexpected error: ${error.message}`, error.stack);
  } finally {
    this.isRunning = false;
  }
}
```

#### Enhancement 2.2: Add Environment Variables for Dynamic Interval Configuration

**File:** `apps/backend/.env.example`

```bash
# Existing variables...
NAVASAN_API_KEY=your_api_key_here
MONGODB_URI=mongodb://localhost:27017/currency-tracker

# ===== Scheduler Configuration (NEW) =====
# Enable/disable the scheduler
SCHEDULER_ENABLED=true

# Fetch interval in minutes
# Examples:
#   1 = Every minute (for testing/development)
#   5 = Every 5 minutes (frequent updates)
#   60 = Every hour (recommended for production)
#   180 = Every 3 hours (cost optimization)
SCHEDULER_INTERVAL_MINUTES=60

# Alternative: Use cron expression for advanced scheduling
# If set, this overrides SCHEDULER_INTERVAL_MINUTES
# Examples:
#   0 * * * * = Every hour at minute 0
#   */30 * * * * = Every 30 minutes
#   0 */3 * * * = Every 3 hours
#   0 9-17 * * 1-5 = Every hour from 9 AM to 5 PM on weekdays
SCHEDULER_CRON_EXPRESSION=

# Scheduler timezone
SCHEDULER_TIMEZONE=UTC
```

**File:** `apps/backend/.env` (Development)**

```bash
# Development configuration - Faster updates for testing
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=1  # Every minute for rapid testing
SCHEDULER_TIMEZONE=UTC
```

**File:** `apps/backend/.env.production` (Production)**

```bash
# Production configuration - Balanced updates
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=60  # Every hour
SCHEDULER_TIMEZONE=UTC
```

**File:** `apps/backend/src/scheduler/navasan-scheduler.service.ts`

**Update the service to use dynamic intervals:**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { NavasanService } from '../navasan/navasan.service';

@Injectable()
export class NavasanSchedulerService {
  private readonly logger = new Logger(NavasanSchedulerService.name);
  private isRunning = false;
  private cronJob: CronJob | null = null;

  constructor(
    private readonly navasanService: NavasanService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService, // ← Add ConfigService
  ) {
    this.initializeScheduler();
  }

  /**
   * Initialize scheduler with dynamic configuration
   */
  private initializeScheduler() {
    const isEnabled = this.configService.get<string>('SCHEDULER_ENABLED', 'true') === 'true';

    if (!isEnabled) {
      this.logger.warn('⚠️  Scheduler is DISABLED via environment variable');
      return;
    }

    // Get configuration
    const customCron = this.configService.get<string>('SCHEDULER_CRON_EXPRESSION');
    const intervalMinutes = parseInt(
      this.configService.get<string>('SCHEDULER_INTERVAL_MINUTES', '60'),
      10
    );
    const timezone = this.configService.get<string>('SCHEDULER_TIMEZONE', 'UTC');

    // Determine cron expression
    let cronExpression: string;
    if (customCron) {
      cronExpression = customCron;
      this.logger.log(`📅 Using custom cron expression: ${cronExpression}`);
    } else {
      cronExpression = this.intervalToCronExpression(intervalMinutes);
      this.logger.log(`📅 Using interval-based cron: Every ${intervalMinutes} minute(s)`);
    }

    // Create dynamic cron job
    this.cronJob = new CronJob(
      cronExpression,
      () => this.fetchAllData(),
      null, // onComplete
      true, // start
      timezone,
    );

    // Register with scheduler registry
    this.schedulerRegistry.addCronJob('navasan-dynamic-fetch', this.cronJob);

    const nextRun = this.cronJob.nextDate().toJSDate();
    this.logger.log(`✅ Scheduler initialized. Next run: ${nextRun.toISOString()}`);
  }

  /**
   * Convert interval in minutes to cron expression
   */
  private intervalToCronExpression(minutes: number): string {
    if (minutes < 1) {
      this.logger.warn('⚠️  Invalid interval (<1 min), defaulting to 1 hour');
      return CronExpression.EVERY_HOUR;
    }

    // Every N minutes (if < 60)
    if (minutes < 60) {
      return `*/${minutes} * * * *`;
    }

    // Every N hours (if divisible by 60)
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      if (hours === 1) return CronExpression.EVERY_HOUR;
      return `0 */${hours} * * *`;
    }

    // Complex intervals (e.g., 90 minutes = every 1.5 hours)
    // Fall back to checking every N minutes
    return `*/${minutes} * * * *`;
  }

  /**
   * Main scheduled fetch method (no decorator, called by dynamic cron)
   */
  async fetchAllData() {
    if (this.isRunning) {
      this.logger.warn('⚠️  Previous scheduled fetch still running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const intervalMinutes = this.configService.get<string>('SCHEDULER_INTERVAL_MINUTES', '60');

    this.logger.log(
      `⏰ === SCHEDULED FETCH STARTED (interval: ${intervalMinutes}m) ===`
    );

    try {
      const results = await Promise.allSettled([
        this.navasanService.getCurrencies(),
        this.navasanService.getCrypto(),
        this.navasanService.getGold(),
      ]);

      const [currencies, crypto, gold] = results;
      this.logFetchResult('Currencies', currencies);
      this.logFetchResult('Crypto', crypto);
      this.logFetchResult('Gold', gold);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      const duration = Date.now() - startTime;

      this.logger.log(
        `⏰ === FETCH COMPLETED === ` +
        `Success: ${successCount}/3 | Failed: ${failureCount}/3 | Duration: ${duration}ms`
      );

      if (successCount === 0) {
        this.logger.error('🚨 CRITICAL: All scheduled fetches failed! Check API key and connectivity.');
      }

    } catch (error) {
      this.logger.error(`❌ Unexpected error in scheduled fetch: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Helper: Log individual fetch result
   */
  private logFetchResult(category: string, result: PromiseSettledResult<any>) {
    if (result.status === 'fulfilled') {
      const metadata = result.value?.metadata;
      const source = metadata?.source || 'unknown';
      const isStale = metadata?.isStale || false;
      this.logger.log(
        `✅ ${category} fetched [source: ${source}, stale: ${isStale}]`
      );
    } else {
      this.logger.error(
        `❌ ${category} failed: ${result.reason?.message || result.reason}`
      );
    }
  }

  /**
   * Manual trigger for testing or admin panel
   */
  async triggerManualFetch(): Promise<{ success: boolean; message: string }> {
    this.logger.log('🔧 Manual fetch triggered');
    try {
      await this.fetchAllData();
      return { success: true, message: 'Manual fetch completed' };
    } catch (error) {
      return { success: false, message: `Manual fetch failed: ${error.message}` };
    }
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime(): Date | null {
    if (!this.cronJob) {
      return null;
    }
    return this.cronJob.nextDate().toJSDate();
  }

  /**
   * Get current scheduler configuration
   */
  getSchedulerConfig() {
    return {
      enabled: this.configService.get<string>('SCHEDULER_ENABLED') === 'true',
      intervalMinutes: this.configService.get<string>('SCHEDULER_INTERVAL_MINUTES'),
      cronExpression: this.configService.get<string>('SCHEDULER_CRON_EXPRESSION'),
      timezone: this.configService.get<string>('SCHEDULER_TIMEZONE'),
      nextRun: this.getNextRunTime(),
    };
  }

  /**
   * Update scheduler interval at runtime (admin feature)
   */
  async updateInterval(newIntervalMinutes: number): Promise<void> {
    this.logger.log(`🔧 Updating scheduler interval to ${newIntervalMinutes} minutes`);

    // Remove old job
    if (this.cronJob) {
      this.cronJob.stop();
      this.schedulerRegistry.deleteCronJob('navasan-dynamic-fetch');
    }

    // Create new job with new interval
    const timezone = this.configService.get<string>('SCHEDULER_TIMEZONE', 'UTC');
    const cronExpression = this.intervalToCronExpression(newIntervalMinutes);

    this.cronJob = new CronJob(
      cronExpression,
      () => this.fetchAllData(),
      null,
      true,
      timezone,
    );

    this.schedulerRegistry.addCronJob('navasan-dynamic-fetch', this.cronJob);

    this.logger.log(`✅ Scheduler updated. Next run: ${this.getNextRunTime()?.toISOString()}`);
  }
}
```

#### Enhancement 2.3: Add Admin API Endpoints for Dynamic Control

**File:** `apps/backend/src/scheduler/scheduler.controller.ts` (NEW FILE)

```typescript
import { Controller, Post, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NavasanSchedulerService } from './navasan-scheduler.service';
import { IsInt, Min, Max } from 'class-validator';

// DTO for updating interval
class UpdateIntervalDto {
  @IsInt()
  @Min(1)
  @Max(1440) // Max 24 hours
  intervalMinutes: number;
}

@Controller('scheduler')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulerController {
  constructor(
    private readonly schedulerService: NavasanSchedulerService,
  ) {}

  /**
   * Trigger manual fetch (admin only)
   * POST /scheduler/trigger
   *
   * Example:
   * curl -X POST http://localhost:4000/scheduler/trigger \
   *   -H "Authorization: Bearer YOUR_ADMIN_JWT"
   */
  @Post('trigger')
  @Roles('admin')
  async triggerManualFetch() {
    return this.schedulerService.triggerManualFetch();
  }

  /**
   * Get scheduler configuration and status
   * GET /scheduler/config
   *
   * Returns:
   * - enabled: Whether scheduler is enabled
   * - intervalMinutes: Current interval setting
   * - cronExpression: Custom cron if set
   * - timezone: Scheduler timezone
   * - nextRun: Next scheduled execution time
   */
  @Get('config')
  @Roles('admin')
  getConfig() {
    return this.schedulerService.getSchedulerConfig();
  }

  /**
   * Update scheduler interval at runtime (admin only)
   * PUT /scheduler/interval
   *
   * Body: { "intervalMinutes": 30 }
   *
   * Example:
   * curl -X PUT http://localhost:4000/scheduler/interval \
   *   -H "Authorization: Bearer YOUR_ADMIN_JWT" \
   *   -H "Content-Type: application/json" \
   *   -d '{"intervalMinutes": 30}'
   */
  @Put('interval')
  @Roles('admin')
  async updateInterval(@Body() dto: UpdateIntervalDto) {
    await this.schedulerService.updateInterval(dto.intervalMinutes);
    return {
      success: true,
      message: `Scheduler interval updated to ${dto.intervalMinutes} minutes`,
      nextRun: this.schedulerService.getNextRunTime(),
    };
  }

  /**
   * Get next scheduled run time
   * GET /scheduler/next-run
   *
   * Legacy endpoint - use /scheduler/config instead
   */
  @Get('next-run')
  @Roles('admin')
  getNextRun() {
    return {
      nextRun: this.schedulerService.getNextRunTime(),
    };
  }
}
```

**Update scheduler.module.ts:**

```typescript
import { SchedulerController } from './scheduler.controller';

@Module({
  imports: [ScheduleModule.forRoot(), NavasanModule],
  controllers: [SchedulerController], // ← Add this
  providers: [NavasanSchedulerService],
  exports: [NavasanSchedulerService],
})
export class SchedulerModule {}
```

#### Enhancement 2.4: Increase Stale Cache TTL for Better Resilience

**File:** `apps/backend/src/navasan/navasan.service.ts`

**Current value (line 28):**
```typescript
private readonly staleCacheHours = 24; // Keep stale data for fallback
```

**Recommended change:**
```typescript
private readonly staleCacheHours = 168; // 7 days - gives full week buffer when API key expires
```

**Rationale:**
- API keys typically renewed weekly/monthly
- 7-day buffer ensures data availability during renewal
- Hourly scheduled fetches keep data fresh anyway
- Stale cache becomes true "emergency fallback"

---

### Phase 3: Testing (Estimated: 30-60 minutes)

#### Test 3.1: Verify Cron Schedule

**Create test file:** `apps/backend/src/scheduler/navasan-scheduler.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NavasanSchedulerService } from './navasan-scheduler.service';
import { NavasanService } from '../navasan/navasan.service';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('NavasanSchedulerService', () => {
  let service: NavasanSchedulerService;
  let navasanService: jest.Mocked<NavasanService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NavasanSchedulerService,
        {
          provide: NavasanService,
          useValue: {
            getCurrencies: jest.fn(),
            getCrypto: jest.fn(),
            getGold: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            getCronJob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NavasanSchedulerService>(NavasanSchedulerService);
    navasanService = module.get(NavasanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch all categories on scheduled run', async () => {
    navasanService.getCurrencies.mockResolvedValue({ data: {}, metadata: {} });
    navasanService.getCrypto.mockResolvedValue({ data: {}, metadata: {} });
    navasanService.getGold.mockResolvedValue({ data: {}, metadata: {} });

    await service.fetchAllData();

    expect(navasanService.getCurrencies).toHaveBeenCalled();
    expect(navasanService.getCrypto).toHaveBeenCalled();
    expect(navasanService.getGold).toHaveBeenCalled();
  });
});
```

**Run tests:**
```bash
cd apps/backend
npm run test
```

#### Test 3.2: Manual Testing with Short Interval

**Temporarily change cron to every minute for testing:**

```typescript
// In navasan-scheduler.service.ts
@Cron(CronExpression.EVERY_MINUTE) // ← Change to every minute
async fetchAllData() {
  // ... existing code
}
```

**Start backend and monitor logs:**

```bash
cd apps/backend
npm run start:dev
```

**Expected logs every minute:**
```
[Nest] LOG [NavasanSchedulerService] ⏰ === HOURLY SCHEDULED FETCH STARTED ===
[Nest] LOG [NavasanService] 📡 Fetching fresh data from Navasan API for category: currencies
[Nest] LOG [NavasanService] ✅ API fetch successful for category: currencies
[Nest] LOG [NavasanSchedulerService] ✅ Currencies fetched successfully [source: api, stale: false]
...
[Nest] LOG [NavasanSchedulerService] ⏰ === HOURLY FETCH COMPLETED === Success: 3/3 | Duration: 2341ms
```

**After confirming it works, change back to hourly:**
```typescript
@Cron(CronExpression.EVERY_HOUR)
```

#### Test 3.3: Test API Failure Handling

**Temporarily use invalid API key in `.env`:**

```bash
NAVASAN_API_KEY=invalid_key_for_testing
```

**Restart backend and check logs:**

```
[Nest] ERROR [NavasanService] 🔑 TOKEN EXPIRATION detected for category: currencies
[Nest] WARN [NavasanService] ⚠️  Serving STALE data for category: currencies (2h 15m old)
[Nest] LOG [NavasanSchedulerService] ✅ Currencies fetched successfully [source: fallback, stale: true]
```

**Verify:**
- ✅ Scheduler continues running despite errors
- ✅ Stale cache is served when API fails
- ✅ Previous data remains in database
- ✅ No crashes or exceptions

**Restore valid API key after test.**

#### Test 3.4: Verify MongoDB Data Persistence

**Run this MongoDB query during/after scheduled fetches:**

```bash
cd apps/backend
node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/currency-tracker').then(async () => {
  const db = mongoose.connection.db;

  const caches = await db.collection('caches').find({}).toArray();

  console.log('=== CACHE STATUS AFTER SCHEDULED FETCH ===');
  caches.forEach(cache => {
    const ageMinutes = ((Date.now() - new Date(cache.timestamp)) / 60000).toFixed(1);
    console.log(\`\nCategory: \${cache.category}\`);
    console.log(\`  Type: \${cache.cacheType}\`);
    console.log(\`  Age: \${ageMinutes} minutes\`);
    console.log(\`  Timestamp: \${new Date(cache.timestamp).toISOString()}\`);
    console.log(\`  Last API Success: \${cache.lastApiSuccess ? new Date(cache.lastApiSuccess).toISOString() : 'N/A'}\`);
  });

  mongoose.disconnect();
});
"
```

**Expected output:**
```
=== CACHE STATUS AFTER SCHEDULED FETCH ===

Category: currencies
  Type: fresh
  Age: 2.3 minutes
  Timestamp: 2025-11-08T12:00:00.000Z
  Last API Success: 2025-11-08T12:00:00.000Z

Category: crypto
  Type: fresh
  Age: 2.4 minutes
  ...
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm run test`)
- [ ] Backend compiles without errors (`npm run build`)
- [ ] Environment variables configured in production `.env`
- [ ] Database backup created
- [ ] Rollback plan documented

### Deployment Steps

1. **Install dependencies:**
   ```bash
   cd apps/backend
   npm install
   ```

2. **Run database migrations (if any):**
   ```bash
   # Not needed for this feature, but good practice to check
   ```

3. **Build backend:**
   ```bash
   npm run build
   ```

4. **Start in production mode:**
   ```bash
   npm run start:prod
   ```

5. **Monitor logs for first scheduled run:**
   ```bash
   # Check logs at the top of the next hour
   # Look for "HOURLY SCHEDULED FETCH STARTED" message
   ```

### Post-Deployment Verification

- [ ] Backend server running without errors
- [ ] First scheduled fetch completed successfully
- [ ] MongoDB shows fresh cache data
- [ ] Frontend displays data correctly
- [ ] Admin can trigger manual fetch via API
- [ ] Logs show appropriate messages

### Rollback Plan

If issues occur:

1. **Stop backend server**
2. **Revert to previous version:**
   ```bash
   git checkout <previous-commit-hash>
   npm install
   npm run build
   npm run start:prod
   ```
3. **Verify old version works**
4. **Investigate issues in development environment**

---

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Scheduled Fetch Success Rate**
   - Target: > 95% success rate
   - Alert if < 90% over 24 hours

2. **Cache Age**
   - Monitor freshness of cached data
   - Alert if cache > 2 hours old

3. **API Response Times**
   - Track Navasan API latency
   - Alert if avg > 5 seconds

4. **Database Storage Growth**
   - Monitor `price_snapshots` collection size
   - Expected: ~10-20 MB/month

### Log Analysis

**Search for critical errors:**
```bash
# In production logs
grep "CRITICAL: All scheduled fetches failed" /var/log/app/backend.log
```

**Monitor success rate:**
```bash
# Count successful vs failed fetches
grep "HOURLY FETCH COMPLETED" /var/log/app/backend.log | grep "Success: 3/3"
```

### Maintenance Tasks

#### Weekly
- [ ] Review scheduler logs for errors
- [ ] Check database cache freshness
- [ ] Verify API key is valid

#### Monthly
- [ ] Analyze `price_snapshots` storage growth
- [ ] Review and optimize database indexes
- [ ] Check for any stuck/hanging scheduled jobs

#### Quarterly
- [ ] Performance testing of scheduled jobs
- [ ] Evaluate cron schedule (hourly vs 3-hourly)
- [ ] Review and update documentation

### Troubleshooting Guide

#### Problem: Scheduled fetch not running

**Diagnosis:**
```typescript
// Add this to scheduler service to verify cron is registered
constructor(...) {
  this.logger.log('📅 Navasan Scheduler initialized');
  this.logger.log(`Next run: ${this.getNextRunTime()}`);
}
```

**Solutions:**
- Verify `@nestjs/schedule` is installed
- Check `ScheduleModule.forRoot()` is in imports
- Ensure server timezone is correct
- Restart backend server

#### Problem: All fetches failing

**Check:**
1. API key validity: `echo $NAVASAN_API_KEY`
2. API endpoint reachability: `curl http://api.navasan.tech/latest/?api_key=YOUR_KEY`
3. Network connectivity
4. MongoDB connection

#### Problem: Database not updating

**Check:**
- MongoDB is running: `systemctl status mongod`
- Connection string is correct
- Sufficient disk space
- Database permissions

---

## Trade-offs & Decisions

### Decision 1: Hourly vs 3-Hourly Scheduling

| Aspect | Hourly (Recommended) | 3-Hourly |
|--------|---------------------|----------|
| **API Calls/Day** | 72 (3 categories × 24) | 24 (3 categories × 8) |
| **Max Data Age** | 1 hour | 3 hours |
| **API Cost** | Higher | Lower |
| **User Experience** | Better (fresher data) | Acceptable |
| **Recommendation** | ✅ Best for production | Consider if API costs high |

**Chosen:** Hourly - Better UX, API costs still reasonable

### Decision 2: Hybrid vs Scheduler-Only

| Approach | Pros | Cons |
|----------|------|------|
| **Hybrid** (Scheduled + Reactive) | Best UX, can refresh on demand | More complex |
| **Scheduler-Only** | Simpler code, predictable costs | Can't refresh on user demand |

**Chosen:** Hybrid - Keep reactive caching as backup

### Decision 3: Stale Cache TTL

| TTL | Pros | Cons |
|-----|------|------|
| **24 hours** | Less storage | Too short for API key renewal |
| **7 days** ✅ | Full week buffer, safer | Slightly more storage |
| **30 days** | Maximum resilience | Potentially outdated data |

**Chosen:** 7 days - Good balance of safety and data relevance

---

## Future Enhancements

### Phase 4: Advanced Features (Future)

1. **Adaptive Scheduling**
   - Fetch more frequently during market hours
   - Reduce frequency at night/weekends
   - Dynamic based on price volatility

2. **Health Monitoring Dashboard**
   - Real-time scheduler status
   - Cache freshness visualization
   - API call analytics
   - Alert management UI

3. **Notification System**
   - Email alerts on repeated failures
   - Slack/Discord integration
   - SMS for critical failures

4. **Rate Limit Optimization**
   - Implement exponential backoff
   - Queue system for retries
   - Smart request batching

5. **Multi-Source Fallback**
   - Add secondary API providers
   - Automatic fallback to alternative sources
   - Price comparison and validation

---

## Appendix

### A. Cron Expression Examples

```bash
# Every minute (testing only)
* * * * *

# Every hour at minute 0
0 * * * *

# Every 3 hours
0 */3 * * *

# Every day at midnight
0 0 * * *

# Every weekday at 9 AM
0 9 * * 1-5

# Custom: Every 30 minutes
*/30 * * * *
```

### B. Dynamic Interval Configuration Examples

#### Different Phases of Development

**Local Development (Testing):**
```bash
# .env
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=1  # Every minute for rapid testing
```

**Staging Environment:**
```bash
# .env.staging
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=15  # Every 15 minutes
```

**Production Environment:**
```bash
# .env.production
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=60  # Every hour
```

**High-Traffic Production:**
```bash
# .env.production
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=30  # Every 30 minutes for fresher data
```

**Cost-Optimized Production:**
```bash
# .env.production
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=180  # Every 3 hours to reduce API calls
```

**Custom Business Hours (Using Cron Expression):**
```bash
# .env.production
SCHEDULER_ENABLED=true
SCHEDULER_CRON_EXPRESSION=0 9-17 * * 1-5  # Every hour from 9 AM to 5 PM on weekdays
SCHEDULER_TIMEZONE=Asia/Tehran  # Use local timezone
```

#### Runtime Interval Changes (Without Restart)

**Via Admin API:**

```bash
# Get current configuration
curl http://localhost:4000/scheduler/config \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"

# Response:
{
  "enabled": true,
  "intervalMinutes": "60",
  "cronExpression": null,
  "timezone": "UTC",
  "nextRun": "2025-11-08T13:00:00.000Z"
}

# Change to 30-minute interval
curl -X PUT http://localhost:4000/scheduler/interval \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 30}'

# Response:
{
  "success": true,
  "message": "Scheduler interval updated to 30 minutes",
  "nextRun": "2025-11-08T12:30:00.000Z"
}

# Trigger immediate fetch (doesn't change interval)
curl -X POST http://localhost:4000/scheduler/trigger \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

**Interval Conversion Reference:**

| Interval | Minutes | Cron Expression | Use Case |
|----------|---------|----------------|----------|
| Every minute | 1 | `*/1 * * * *` | Local testing only |
| Every 5 minutes | 5 | `*/5 * * * *` | Development |
| Every 15 minutes | 15 | `*/15 * * * *` | Staging |
| Every 30 minutes | 30 | `*/30 * * * *` | High-traffic production |
| Every hour | 60 | `0 * * * *` | **Recommended production** |
| Every 2 hours | 120 | `0 */2 * * *` | Normal production |
| Every 3 hours | 180 | `0 */3 * * *` | Cost-optimized |
| Every 6 hours | 360 | `0 */6 * * *` | Low-traffic scenarios |
| Every 12 hours | 720 | `0 */12 * * *` | Minimal updates |
| Once daily | 1440 | `0 0 * * *` | Very low frequency |

### C. Useful Commands

```bash
# ===== Server Management =====

# Start backend in dev mode (hot reload)
cd apps/backend && npm run start:dev

# Start backend in production
cd apps/backend && npm run start:prod

# Check backend logs (development)
# Logs print to console

# ===== Database Queries =====

# Check MongoDB cache
node -e "require('mongoose').connect('mongodb://localhost:27017/currency-tracker').then(async () => { const caches = await require('mongoose').connection.db.collection('caches').find({}).toArray(); console.log(caches); process.exit(); });"

# Count price snapshots
node -e "require('mongoose').connect('mongodb://localhost:27017/currency-tracker').then(async () => { const count = await require('mongoose').connection.db.collection('price_snapshots').countDocuments(); console.log('Snapshots:', count); process.exit(); });"

# ===== Scheduler Control API =====

# Get scheduler configuration
curl http://localhost:4000/scheduler/config \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# Manually trigger fetch
curl -X POST http://localhost:4000/scheduler/trigger \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# Check next scheduled run (legacy endpoint)
curl http://localhost:4000/scheduler/next-run \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# Update interval to 30 minutes
curl -X PUT http://localhost:4000/scheduler/interval \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 30}'

# Update interval to 3 hours
curl -X PUT http://localhost:4000/scheduler/interval \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 180}'

# ===== Testing =====

# Test with 1-minute interval (local dev)
# Edit .env: SCHEDULER_INTERVAL_MINUTES=1
# Restart server and watch logs

# Verify scheduler is working (check logs for this pattern)
grep "SCHEDULED FETCH STARTED" backend.log

# Check if all fetches are successful
grep "Success: 3/3" backend.log
```

### D. Environment Variables Quick Reference

```bash
# ===== Required =====
NAVASAN_API_KEY=your_api_key_here
MONGODB_URI=mongodb://localhost:27017/currency-tracker

# ===== Scheduler Configuration =====
SCHEDULER_ENABLED=true                         # true/false
SCHEDULER_INTERVAL_MINUTES=60                  # 1-1440 (minutes)
SCHEDULER_CRON_EXPRESSION=                     # Optional: overrides interval
SCHEDULER_TIMEZONE=UTC                         # IANA timezone

# ===== Server Configuration =====
PORT=4000
NODE_ENV=production                            # development/staging/production

# ===== JWT Configuration (existing) =====
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
```

**Priority Order:**
1. If `SCHEDULER_ENABLED=false` → Scheduler disabled completely
2. If `SCHEDULER_CRON_EXPRESSION` is set → Use custom cron
3. Otherwise → Use `SCHEDULER_INTERVAL_MINUTES` to generate cron

### E. File Structure After Implementation

```
apps/backend/src/
├── scheduler/                          ← NEW
│   ├── scheduler.module.ts            ← NEW
│   ├── navasan-scheduler.service.ts   ← NEW
│   ├── scheduler.controller.ts        ← NEW (optional)
│   └── navasan-scheduler.service.spec.ts ← NEW (optional)
├── navasan/
│   ├── navasan.service.ts             ← MODIFIED (add forceFetchAndCache)
│   └── ... (existing files)
├── app.module.ts                       ← MODIFIED (import SchedulerModule)
└── ... (existing files)
```

---

## Conclusion

This implementation provides a robust, production-ready scheduled caching system that ensures data availability even during API downtime or key expiration. The hybrid approach maintains flexibility while guaranteeing baseline data freshness.

**Estimated Total Implementation Time:** 2-3 hours
**Complexity:** Medium
**Risk Level:** Low
**Recommended for Production:** ✅ Yes

---

**Document Version:** 1.0
**Last Updated:** 2025-11-08
**Author:** Claude Code
**Status:** Ready for Implementation
