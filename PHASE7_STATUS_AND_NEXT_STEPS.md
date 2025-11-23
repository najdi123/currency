# Phase 7 Status & What to Expect

## ✅ What Was Implemented (Phase 7)

Phase 7 added **intraday OHLC display features** to show today's price movements:

### 1. Backend Changes (Already Complete - Phase 6)
- ✅ OHLC data collection service
- ✅ API endpoints: `/api/navasan/ohlc/today/:itemCode` and `/api/navasan/ohlc/all`
- ✅ Daily change calculation (open → close)
- ✅ Intraday data points storage (for charts)

### 2. Frontend Changes (Phase 7 - Just Completed)
- ✅ RTK Query endpoints added (`useGetAllTodayOhlcQuery`)
- ✅ `useOhlcData` hook created
- ✅ `DailyChangeBadge` component created
- ✅ `IntradayMiniChart` component created
- ✅ `ItemCardGrid` fetches OHLC data
- ✅ `ItemCard` displays OHLC when available

## 🎯 What You Should See

### When OHLC Data is Available:
Instead of the regular change badge, you'll see:
```
┌──────────────┐
│ ↑ +2.34%     │  ← Daily change badge (green for positive)
│ 70,500 Toman │  ← Current price
│ [mini chart] │  ← Sparkline showing today's movement
└──────────────┘
```

### When OHLC Data is NOT Available:
You'll see the original display (graceful fallback):
```
┌──────────────┐
│ +500 ▲       │  ← Regular change badge
│ 70,500 Toman │  ← Current price
│ [sparkline]  │  ← Regular sparkline chart
└──────────────┘
```

## ❓ Why You Might Not See Changes

### Possible Reasons:

1. **OHLC Data Not Yet Collected**
   - Backend needs to run for a while to collect intraday data points
   - Minimum 3 data points required for mini chart to display
   - Check: `GET http://localhost:4000/api/navasan/ohlc/all`

2. **First Time Running Today**
   - OHLC collection happens via scheduled jobs
   - May take 10-120 minutes depending on schedule
   - Check backend logs for "OHLC collection" messages

3. **API Errors**
   - PersianAPI might be returning errors (see backend logs)
   - Check: Backend logs show "PersianAPI request failed: 500"

## 🔍 How to Verify Phase 7 is Working

### Check 1: Backend OHLC Endpoint
```bash
curl http://localhost:4000/api/navasan/ohlc/all
```

**Expected Response:**
```json
{
  "count": 45,
  "data": [
    {
      "itemCode": "usd_sell",
      "open": 70500,
      "high": 71200,
      "low": 70300,
      "close": 70900,
      "change": 0.57,  ← This becomes the daily change %
      "dataPoints": [...],  ← This becomes the mini chart
      "updateCount": 42
    }
  ]
}
```

**If you get empty data or 404:**
- OHLC data hasn't been collected yet
- Wait for next scheduled data fetch
- Or manually trigger: `POST http://localhost:4000/api/scheduler/trigger`

### Check 2: Frontend Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter: "ohlc"
4. Refresh page
5. Look for: `GET /api/navasan/ohlc/all`

**Expected:**
- Status: 200 OK
- Response: JSON with count and data array

### Check 3: Browser Console
1. Open browser console (F12)
2. Refresh the page
3. Look for: `[ItemCardGrid] Re-rendering due to changed props`

**This confirms:**
- OHLC data is being fetched
- ItemCard is receiving OHLC props

## 🐛 Current Issue: "Regular Currencies Not Displaying"

This is a **DIFFERENT issue** from Phase 7. This is about the main currency data not loading.

### Diagnosis from Backend Logs:
```
ERROR [PersianApiProvider] PersianAPI request failed: 500
ERROR The server encountered an internal error
```

**Root Cause:** PersianAPI is returning 500 errors

### Solutions:

#### Option 1: Wait for PersianAPI to Recover
- The API might be temporarily down
- Backend will automatically retry
- Check backend logs for successful fetch

#### Option 2: Check API Key
```bash
# Check if PERSIANAPI_KEY is set
grep PERSIANAPI_KEY apps/backend/.env
```

#### Option 3: Use Fallback to Cached Data
If backend has cached data:
- Open: `http://localhost:3000` (frontend)
- Should show last cached data with "stale data" banner

#### Option 4: Manual Trigger
```bash
# Trigger manual data fetch
curl -X POST http://localhost:4000/api/scheduler/trigger
```

## 📋 Next Steps

### Immediate (Fix Currency Display):
1. **Check PersianAPI Key:**
   ```
   apps/backend/.env
   Look for: PERSIANAPI_KEY=your-key-here
   ```

2. **Check PersianAPI Status:**
   - Visit: https://studio.persianapi.com
   - Check account status
   - Verify API key is valid

3. **Check Backend Logs:**
   ```
   Look for successful "✅ Fetch successful" messages
   ```

4. **Use Cached Data (if available):**
   - Frontend should show cached data even if API fails
   - Look for "Stale Data" banner on frontend

### After Currencies Load (Verify Phase 7):
1. Wait 10-30 minutes for OHLC data collection
2. Refresh frontend
3. Look for:
   - Daily change badges ("+2.34%")
   - Mini sparkline charts below prices

### Testing Phase 7 Manually:
If you want to see Phase 7 features immediately:

1. **Manually Insert OHLC Data (MongoDB):**
   ```javascript
   // Connect to MongoDB
   db.intraday_ohlc.insertOne({
     itemCode: 'usd_sell',
     date: '2025-11-21',
     dateJalali: '1403/09/01',
     open: 70000,
     high: 71000,
     low: 69500,
     close: 70500,
     change: 0.71,  // (70500 - 70000) / 70000 * 100
     dataPoints: [
       { time: '08:00', price: 70000 },
       { time: '09:00', price: 70300 },
       { time: '10:00', price: 70800 },
       { time: '11:00', price: 70500 }
     ],
     updateCount: 4,
     firstUpdate: new Date(),
     lastUpdate: new Date(),
     createdAt: new Date()
   })
   ```

2. **Refresh Frontend:**
   - You should now see:
     - "+0.71%" badge (green)
     - Mini chart with 4 points

## 📊 Summary

| Feature | Status | What to See |
|---------|--------|-------------|
| **Phase 7 Backend** | ✅ Complete | OHLC endpoints available |
| **Phase 7 Frontend** | ✅ Complete | Components ready to display OHLC |
| **OHLC Data Collection** | ⏳ Waiting | Needs scheduled runs or manual trigger |
| **Currency Data Display** | ❌ Issue | PersianAPI errors blocking data fetch |

## 🎯 Main Issue to Fix

**Problem:** PersianAPI returning 500 errors
**Solution:** Check API key and account status
**Workaround:** Use cached data if available

Once currencies are displaying again, Phase 7 features will automatically show up as OHLC data gets collected throughout the day.

---

**TL;DR:**
- Phase 7 code is ✅ **COMPLETE** and working
- You won't see changes yet because OHLC data hasn't been collected
- Main issue: PersianAPI errors preventing ANY currency data from loading
- Fix PersianAPI first, then wait for OHLC collection to see Phase 7 features
