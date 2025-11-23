# Diagnosis Steps for Stale Data System

## Step 1: Check MongoDB Connection

```bash
# Check if MongoDB is running
mongosh --version

# Connect to your MongoDB
mongosh "your_mongodb_connection_string"

# Once connected, run:
use your_database_name
db.caches.countDocuments()
db.price_snapshots.countDocuments()
```

**Expected Results:**
- `db.caches.countDocuments()` should return > 0 (at least 6 documents: fresh+stale for currencies, crypto, gold)
- `db.price_snapshots.countDocuments()` should return > 0 if scheduler has run

---

## Step 2: Check Environment Configuration

```bash
cd apps/backend
cat .env | grep -E "SCHEDULER_ENABLED|MONGODB_URI|NAVASAN_API_KEY"
```

**What to verify:**
- `SCHEDULER_ENABLED=true` ← Must be true
- `MONGODB_URI=mongodb://...` ← Must be valid connection string
- `NAVASAN_API_KEY=...` ← Must be set (even if expired, needed for diagnosis)

---

## Step 3: Check Backend Logs

```bash
# Check if backend is running
cd apps/backend
npm run start:dev

# Look for these log messages:
# ✅ "Scheduler initialized. Next run: ..."
# ✅ "Saved fresh cache for category: currencies"
# ✅ "Saved stale cache for category: currencies"
# ❌ "No stale cache available for category: currencies"
```

---

## Step 4: Query Actual Cache Data

Connect to MongoDB and run:

```javascript
// Check for ANY cache data
db.caches.find().pretty()

// Check cache timestamps
db.caches.find({}, {category: 1, cacheType: 1, timestamp: 1, expiresAt: 1}).sort({timestamp: -1})

// Check price snapshots
db.price_snapshots.find().sort({timestamp: -1}).limit(5).pretty()
```

---

## Step 5: Check Age of Cached Data

```javascript
// Calculate age of stale caches
db.caches.aggregate([
  { $match: { cacheType: "stale" } },
  {
    $project: {
      category: 1,
      timestamp: 1,
      ageInHours: {
        $divide: [
          { $subtract: [new Date(), "$timestamp"] },
          1000 * 60 * 60
        ]
      }
    }
  }
])
```

**Problem if:** Any `ageInHours` > 168 (7 days)

---

## Step 6: Manual Trigger Test

```bash
# Trigger manual data fetch via backend API
# (You need to create a test endpoint or use the scheduler service directly)

# In MongoDB, after scheduler runs, verify:
db.caches.find({cacheType: "fresh"}).count()  # Should be 3
db.caches.find({cacheType: "stale"}).count()  # Should be 3
db.price_snapshots.find().count()  # Should increase
```

---

## Expected Issues & Solutions

### Issue 1: MongoDB Not Running
**Symptom:** Connection refused errors in logs
**Solution:** Start MongoDB service
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

### Issue 2: Scheduler Disabled
**Symptom:** No "Scheduler initialized" log message
**Solution:** Enable in `.env`
```bash
SCHEDULER_ENABLED=true
```

### Issue 3: Empty Database
**Symptom:** `db.caches.countDocuments()` returns 0
**Solution:** Run manual fetch (see Phase 2)

### Issue 4: API Key Expired
**Symptom:** "API authentication failed" in logs
**Solution:** Get new API key from navasan.tech (see Phase 3)

### Issue 5: Stale Data Too Old
**Symptom:** Data exists but older than 7 days
**Solution:** Increase stale cache window (see Phase 2, Step 3)
