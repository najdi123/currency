# Comprehensive Fix Plan: Stale Data System

This document provides step-by-step fixes for the "no cached data available" error.

---

## **Phase 2: Quick Fixes (Apply Immediately)**

### **Fix 1: Increase Stale Cache Window**

**Problem:** 7-day window is too short. If API key expires and you don't notice for a week, all data becomes unusable.

**Location:** `apps/backend/src/navasan/navasan.service.ts:29`

**Current:**
```typescript
private readonly staleCacheHours = 168; // 7 days
```

**Fix:**
```typescript
private readonly staleCacheHours = 720; // 30 days - gives full month buffer
```

**Same fix for chart service** at `apps/backend/src/chart/chart.service.ts:22`:
```typescript
private readonly staleCacheHours = 720; // 30 days (was 72 hours)
```

---

### **Fix 2: Use Price Snapshots as Ultimate Fallback**

**Problem:** Price snapshots exist permanently but are NOT used as fallback for main price data (only for charts).

**Location:** `apps/backend/src/navasan/navasan.service.ts`

**Add new method after line 297:**

```typescript
/**
 * Build price data from price snapshots as last resort fallback
 * Similar to chart fallback but for main price data
 */
private async buildPriceDataFromSnapshots(
  category: string
): Promise<NavasanResponse | null> {
  try {
    this.logger.warn(`📸 Attempting to build price data from snapshots for ${category}`);

    // Get the most recent snapshot for this category
    const snapshot = await this.priceSnapshotModel
      .findOne({ category })
      .sort({ timestamp: -1 })
      .exec();

    if (!snapshot) {
      this.logger.error(`No price snapshots found for ${category}`);
      return null;
    }

    // Check if snapshot is reasonable (not too old - 90 days max)
    const maxAgeMs = 90 * 24 * 60 * 60 * 1000; // 90 days
    const age = Date.now() - snapshot.timestamp.getTime();

    if (age > maxAgeMs) {
      this.logger.error(
        `Latest snapshot for ${category} is too old: ${Math.floor(age / (24 * 60 * 60 * 1000))} days`
      );
      return null;
    }

    this.logger.log(
      `✅ Using price snapshot from ${snapshot.timestamp.toISOString()} ` +
      `(${Math.floor(age / (60 * 60 * 1000))} hours old)`
    );

    return snapshot.data as NavasanResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to build price data from snapshots: ${errorMessage}`);
    return null;
  }
}
```

**Then modify the fetchWithCache method** - Add this before throwing the error (after line 272):

```typescript
        // Step 4: Try to build from price snapshots as ultimate fallback
        this.logger.warn(`📸 No stale cache - attempting price snapshot fallback for ${category}`);
        const snapshotData = await this.buildPriceDataFromSnapshots(category);

        if (snapshotData) {
          const dataAgeHours = Math.floor(
            (Date.now() - new Date().getTime()) / (1000 * 60 * 60)
          );

          this.logger.warn(
            `⚠️ Serving data from PRICE SNAPSHOT for ${category}`
          );

          return {
            data: snapshotData as Record<string, unknown>,
            metadata: {
              isFresh: false,
              isStale: true,
              dataAge: dataAgeHours * 60,
              lastUpdated: new Date(),
              source: 'snapshot-fallback',
              warning: `Data from historical snapshot. API service unavailable.`,
            },
          };
        }

        // Step 5: No data available at all - fail
        this.logger.error(
          `❌ No cache, no stale cache, no snapshots for ${category}. Complete failure.`,
        );
```

---

### **Fix 3: Enable Scheduler & Seed Initial Data**

**Step 1: Check .env file**

```bash
cd apps/backend
cat .env | grep SCHEDULER_ENABLED
```

If it says `SCHEDULER_ENABLED=false`, change it to:
```env
SCHEDULER_ENABLED=true
SCHEDULER_INTERVAL_MINUTES=60
```

**Step 2: Create manual seed script**

Create `apps/backend/src/scripts/seed-initial-data.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NavasanSchedulerService } from '../scheduler/navasan-scheduler.service';

async function seedData() {
  console.log('🌱 Seeding initial data...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const scheduler = app.get(NavasanSchedulerService);

  try {
    const result = await scheduler.triggerManualFetch();
    console.log('✅ Seed completed:', result);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

seedData();
```

**Step 3: Add script to package.json**

In `apps/backend/package.json`, add:
```json
{
  "scripts": {
    "seed": "ts-node src/scripts/seed-initial-data.ts"
  }
}
```

**Step 4: Run the seed**
```bash
cd apps/backend
npm run seed
```

---

### **Fix 4: Add MongoDB Connection Diagnostics**

**Location:** `apps/backend/src/app.module.ts`

Find the MongooseModule.forRootAsync section and modify it:

```typescript
MongooseModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => {
    const uri = configService.get<string>('MONGODB_URI');

    if (!uri) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }

    return {
      uri,
      // Add connection event handlers for debugging
      connectionFactory: (connection) => {
        connection.on('connected', () => {
          console.log('✅ MongoDB connected successfully');
        });

        connection.on('error', (error) => {
          console.error('❌ MongoDB connection error:', error.message);
        });

        connection.on('disconnected', () => {
          console.warn('⚠️ MongoDB disconnected');
        });

        // Test query on startup
        connection.once('open', async () => {
          try {
            const cacheCount = await connection.db.collection('caches').countDocuments();
            const snapshotCount = await connection.db.collection('price_snapshots').countDocuments();
            console.log(`📊 Database status: ${cacheCount} caches, ${snapshotCount} snapshots`);

            if (cacheCount === 0 && snapshotCount === 0) {
              console.warn('⚠️ WARNING: Database is empty! Run seed script to populate initial data.');
            }
          } catch (err) {
            console.error('❌ Failed to query database:', err);
          }
        });

        return connection;
      },
    };
  },
  inject: [ConfigService],
}),
```

---

## **Phase 3: Long-term Fixes**

### **Fix 5: Add Admin Endpoint to Check System Status**

Create `apps/backend/src/navasan/navasan.controller.ts` - add new endpoint:

```typescript
@Get('status')
async getSystemStatus() {
  try {
    const status = {
      database: {
        freshCaches: await this.cacheModel.countDocuments({ cacheType: 'fresh' }),
        staleCaches: await this.cacheModel.countDocuments({ cacheType: 'stale' }),
        priceSnapshots: await this.priceSnapshotModel.countDocuments(),
        oldestCache: await this.cacheModel.findOne().sort({ timestamp: 1 }).exec(),
        newestCache: await this.cacheModel.findOne().sort({ timestamp: -1 }).exec(),
      },
      scheduler: {
        enabled: this.configService.get('SCHEDULER_ENABLED') === 'true',
        interval: this.configService.get('SCHEDULER_INTERVAL_MINUTES'),
      },
    };

    return status;
  } catch (error) {
    throw new InternalServerErrorException('Failed to get system status');
  }
}
```

Access via: `http://localhost:4000/api/navasan/status`

---

### **Fix 6: Add Automatic Recovery**

**Problem:** If database is empty and API key is expired, system stays broken forever.

**Solution:** Add recovery logic that populates database from any available source.

Create `apps/backend/src/navasan/recovery.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache, CacheDocument } from './schemas/cache.schema';
import { PriceSnapshot, PriceSnapshotDocument } from './schemas/price-snapshot.schema';

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    @InjectModel(Cache.name) private cacheModel: Model<CacheDocument>,
    @InjectModel(PriceSnapshot.name) private priceSnapshotModel: Model<PriceSnapshotDocument>,
  ) {}

  /**
   * Check system health every hour and attempt recovery if needed
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAndRecover() {
    this.logger.log('🔍 Running system health check...');

    const categories = ['currencies', 'crypto', 'gold'];

    for (const category of categories) {
      // Check if we have ANY usable cache
      const hasCache = await this.cacheModel.exists({ category });

      if (!hasCache) {
        this.logger.warn(`⚠️ No cache found for ${category}, attempting recovery...`);
        await this.recoverFromSnapshots(category);
      }
    }
  }

  /**
   * Attempt to recover cache from price snapshots
   */
  private async recoverFromSnapshots(category: string): Promise<boolean> {
    try {
      // Get most recent snapshot
      const snapshot = await this.priceSnapshotModel
        .findOne({ category })
        .sort({ timestamp: -1 })
        .exec();

      if (!snapshot) {
        this.logger.error(`❌ No snapshots available for recovery of ${category}`);
        return false;
      }

      // Create stale cache from snapshot
      await this.cacheModel.create({
        category,
        data: snapshot.data,
        timestamp: snapshot.timestamp,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        cacheType: 'stale',
        isFallback: true,
        lastApiError: 'Recovered from snapshot due to missing cache',
        apiErrorCount: 0,
      });

      this.logger.log(`✅ Recovered ${category} cache from snapshot dated ${snapshot.timestamp}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Recovery failed for ${category}: ${error.message}`);
      return false;
    }
  }
}
```

Don't forget to add to `app.module.ts` providers!

---

### **Fix 7: Better Error Messages**

**Location:** `apps/backend/src/navasan/navasan.service.ts:279-283`

**Replace with:**

```typescript
// Provide actionable error message with diagnosis info
const cacheCount = await this.cacheModel.countDocuments({ category }).catch(() => 0);
const snapshotCount = await this.priceSnapshotModel.countDocuments({ category }).catch(() => 0);

const diagnostics = [
  `Category: ${category}`,
  `Caches in DB: ${cacheCount}`,
  `Snapshots in DB: ${snapshotCount}`,
  `Error: ${errorMessage}`,
].join(' | ');

this.logger.error(`❌ Complete data failure - ${diagnostics}`);

throw new InternalServerErrorException({
  message: isTokenError
    ? 'API authentication failed and no cached data available.'
    : 'Service temporarily unavailable and no cached data available.',
  details: {
    category,
    hasCache: cacheCount > 0,
    hasSnapshots: snapshotCount > 0,
    suggestion: cacheCount === 0 && snapshotCount === 0
      ? 'Database appears empty. Please run seed script or wait for scheduler.'
      : 'Cache data may be too old. Check API key and scheduler status.',
  },
});
```

---

## **Phase 4: Testing & Verification**

### **Test 1: Verify Fixes Work**

```bash
# 1. Clear all caches (simulate empty state)
mongosh
use your_database_name
db.caches.deleteMany({})

# 2. Restart backend
cd apps/backend
npm run start:dev

# 3. Make request
curl http://localhost:4000/api/navasan/currencies

# Expected: Should either:
# - Fetch from API (if key valid)
# - Use snapshot fallback (if key invalid but snapshots exist)
# - Show helpful error with diagnostics (if truly empty)
```

### **Test 2: Verify Scheduler**

```bash
# Check logs for:
# ✅ "Scheduler initialized. Next run: ..."
# ✅ "SCHEDULED FETCH STARTED"
# ✅ "Saved fresh cache for category: currencies"
```

### **Test 3: Verify Recovery**

```bash
# Delete stale caches
db.caches.deleteMany({cacheType: "stale"})

# Wait 1 hour (or trigger recovery manually)
# Check logs for:
# ✅ "No cache found for currencies, attempting recovery..."
# ✅ "Recovered currencies cache from snapshot"
```

---

## **Summary of Changes**

| Fix | File | Lines | Priority |
|-----|------|-------|----------|
| Increase stale window | navasan.service.ts | 29 | HIGH |
| Increase stale window | chart.service.ts | 22 | HIGH |
| Add snapshot fallback | navasan.service.ts | After 272 | HIGH |
| Enable scheduler | .env | - | HIGH |
| Add connection diagnostics | app.module.ts | MongooseModule | MEDIUM |
| Add status endpoint | navasan.controller.ts | New method | MEDIUM |
| Create recovery service | recovery.service.ts | New file | MEDIUM |
| Better error messages | navasan.service.ts | 279-283 | LOW |

---

## **Expected Outcome**

After applying all fixes:

✅ System will NEVER show "no data" error if ANY historical data exists
✅ Stale cache window increased from 7 days to 30 days
✅ Price snapshots used as ultimate fallback
✅ Automatic recovery from snapshots if cache disappears
✅ Clear diagnostics when things go wrong
✅ Scheduler ensures continuous data flow

---

## **Next Steps**

1. **Apply Phase 2 fixes** (Quick wins)
2. **Run diagnosis steps** to understand current state
3. **Run seed script** to populate initial data
4. **Apply Phase 3 fixes** for long-term reliability
5. **Test thoroughly** using Phase 4 tests
6. **Monitor logs** for 24 hours to ensure stability

---

## **Need Help?**

If you're still seeing errors after applying fixes, collect this info:

```bash
# 1. Database state
mongosh
use your_database_name
db.caches.find({}, {category:1, cacheType:1, timestamp:1}).pretty()
db.price_snapshots.count()

# 2. Environment
cd apps/backend
cat .env | grep -E "SCHEDULER|MONGODB|NAVASAN"

# 3. Recent logs
# Paste last 50 lines of backend logs
```

This will help diagnose any remaining issues.
