# Rate Limiting Fix - Localhost Development Issue

## Problem Identified ✅

Your backend had **TWO rate limiters** that were blocking localhost requests during development:

### 1. Express Rate Limit (PRIMARY ISSUE)
**Location:** `apps/backend/src/main.ts:28-40`

**Before:**
```typescript
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Only 100 requests per 15 minutes!
    // ... applied to ALL IPs including localhost
  })
);
```

**Problem:**
- Limit: 100 requests per 15 minutes
- Every page refresh = 3+ API calls (currencies, crypto, gold)
- Opening charts = more calls
- 2-3 refreshes + exploration = BLOCKED for 15 minutes! 🚫

### 2. NestJS Throttler (SECONDARY ISSUE)
**Location:** `apps/backend/src/app.module.ts:86-91`

**Before:**
```typescript
ThrottlerModule.forRoot([{
  ttl: 60000,
  limit: 500, // 500 requests per minute
}])
```

**Problem:**
- Less aggressive but still limits development
- Applied globally to all endpoints

---

## Fixes Applied ✅

### Fix 1: Disable Express Rate Limit in Development
**File:** `apps/backend/src/main.ts`

**Changes:**
- Rate limiting now **ONLY active in production**
- Development mode = unlimited requests
- Console message shows status

```typescript
if (isProduction) {
  console.log('🛡️  Rate limiting ENABLED (Production)');
  app.use(rateLimit({ ... }));
} else {
  console.log('🔓 Rate limiting DISABLED (Development)');
}
```

### Fix 2: Increase Throttler Limit in Development
**File:** `apps/backend/src/app.module.ts`

**Changes:**
- Development: 10,000 requests/minute (essentially unlimited)
- Production: 500 requests/minute (reasonable protection)

```typescript
ThrottlerModule.forRoot([{
  ttl: 60000,
  limit: process.env.NODE_ENV === 'production' ? 500 : 10000,
}])
```

---

## What About Production?

**Don't worry!** Rate limiting is still active in production:

### Production Protection:
- ✅ Express Rate Limit: 100 requests per 15 min per IP
- ✅ NestJS Throttler: 500 requests per minute
- ✅ Sensitive endpoints have extra limits:
  - Login: 5 attempts/min
  - Password change: 3 attempts/min
  - Email verification: 3 attempts/min
  - Wallet adjustments: 10 requests/min

### How Production is Detected:
- Set `NODE_ENV=production` in your `.env` file for production deployments
- In development, `NODE_ENV` is typically `development` or unset

---

## Testing the Fix

### Step 1: Restart Backend
```bash
cd apps/backend
# Stop current process (Ctrl+C)
npm run start:dev
```

### Step 2: Check Console Output
You should see:
```
🔓 Rate limiting DISABLED (Development)
```

### Step 3: Test Unlimited Requests
```bash
# Make 200+ requests (should all succeed now)
for i in {1..200}; do
  curl http://localhost:4000/api/navasan/currencies -s -o /dev/null -w "%{http_code}\n"
done

# Expected: All should return 200 (not 429)
```

### Step 4: Test Frontend
1. Open `http://localhost:3000`
2. Refresh page multiple times (10+)
3. Open charts
4. Navigate between sections
5. **Should work without any rate limit errors!**

---

## Environment Variables

### Development (.env)
```env
NODE_ENV=development  # or leave unset
PORT=4000
```

### Production (.env.production)
```env
NODE_ENV=production   # CRITICAL: Must be set!
PORT=4000
```

---

## Other Issues Found

While fixing this, I also noticed potential issues from your earlier question about "no cached data":

### Cache/Database Issues
If you're STILL seeing "no data" errors, it's likely because:

1. **Database is empty** - No initial data seeded
   - Fix: Run `DIAGNOSIS_STEPS.md` checks

2. **Scheduler disabled** - Not fetching new data
   - Fix: Set `SCHEDULER_ENABLED=true` in `.env`

3. **Stale cache expired** - Data older than 7 days
   - Fix: Apply fixes from `STALE_DATA_FIX_PLAN.md`

### Quick Database Check
```bash
mongosh "your_mongodb_uri"
use your_database_name
db.caches.countDocuments()        # Should be > 0
db.price_snapshots.countDocuments()  # Should be > 0
```

If both return 0, your database is empty and needs seeding!

---

## Reverting Changes (If Needed)

If you need to restore rate limiting in development:

### Option 1: Restore Original Limits
```typescript
// main.ts - Remove the if (isProduction) check
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // ...
}));
```

### Option 2: Increase Development Limits
```typescript
// main.ts
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 10000,
  // ...
}));
```

---

## Summary

### Before:
- 🚫 100 requests per 15 minutes (all environments)
- 🚫 Localhost blocked after 2-3 page refreshes
- ⏰ Had to wait 15 minutes between testing sessions

### After:
- ✅ Unlimited requests in development
- ✅ Can refresh and test freely on localhost
- ✅ Still protected in production
- ✅ Clear console messages showing status

---

## Questions?

**Q: Is it safe to disable rate limiting in development?**
A: Yes! Development is on localhost. Rate limiting is for protecting public-facing production servers.

**Q: Will this affect production?**
A: No! Rate limiting is still active in production when `NODE_ENV=production`.

**Q: What if I'm STILL getting rate limited?**
A: Check:
1. Backend restarted after changes?
2. Console shows "Rate limiting DISABLED"?
3. `NODE_ENV` is NOT set to "production"?

**Q: Can I adjust production limits?**
A: Yes! Edit the values in `main.ts` and `app.module.ts`:
- `max: 100` → `max: 500` (more requests allowed)
- `windowMs: 15 * 60 * 1000` → `windowMs: 60 * 60 * 1000` (longer window)

---

## Related Documentation

- `DIAGNOSIS_STEPS.md` - Check database and cache status
- `STALE_DATA_FIX_PLAN.md` - Fix "no cached data" errors
- NestJS Throttler: https://docs.nestjs.com/security/rate-limiting
- Express Rate Limit: https://github.com/express-rate-limit/express-rate-limit
