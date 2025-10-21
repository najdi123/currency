# Phase 8: Stale Data Handling - Implementation Complete ✅

**Date**: 2025-10-21
**Priority**: LOW
**Status**: COMPLETED

## Overview

Implemented comprehensive stale data handling to ensure users can continue viewing cached data even when the network fails, with clear visual indicators about data freshness.

## Key Features Implemented

### 1. Enhanced RTK Query Cache Configuration

**File**: `apps/frontend/src/lib/store/services/api.ts`

```typescript
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Rates'],
  // Configure RTK Query behavior for stale data handling
  refetchOnFocus: true,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: 60, // Increased from 30 to 60 seconds
  keepUnusedDataFor: 1200, // Increased from 300 to 1200 seconds (20 minutes)
  endpoints: (builder) => ({
    getCurrencies: builder.query<CurrenciesResponse, void>({
      query: () => '/navasan/currencies',
      providesTags: ['Rates'],
      keepUnusedDataFor: 1200, // 20 minutes - allows showing stale data
    }),
    // ... similar for getCrypto, getGold
  }),
})
```

**Cache Settings**:
- `keepUnusedDataFor`: Increased to **20 minutes** (was 5 minutes)
  - Allows showing stale data for much longer when network fails
  - Users can still see data even if they've been offline for a while
- `refetchOnMountOrArgChange`: Increased to **60 seconds** (was 30 seconds)
  - Less aggressive refetching
  - Reduces unnecessary network requests
  - Still keeps data reasonably fresh

### 2. Stale Data Indicators in UI

**File**: `apps/frontend/src/app/page.tsx`

#### Added State Tracking

```typescript
const {
  data: currencies,
  isLoading: currenciesLoading,
  isFetching: currenciesFetching, // ✅ New: Track background fetches
  error: currenciesError,
  refetch: refetchCurrencies,
  fulfilledTimeStamp: currenciesTimestamp, // ✅ New: Track last success
} = useGetCurrenciesQuery(undefined, {
  pollingInterval: 300000,
})

// Check if showing stale data (has error but also has cached data)
const hasStaleData = (currenciesError && currencies) ||
                      (cryptoError && crypto) ||
                      (goldError && gold)
```

#### Visual Indicators

**1. Stale Data Warning Banner**

```typescript
{hasStaleData && !hasAllErrors && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
    <h3>داده‌ها ممکن است قدیمی باشند</h3>
    <p>
      امکان دریافت آخرین اطلاعات وجود ندارد. داده‌های ذخیره‌شده قبلی نمایش داده می‌شوند.
      آخرین بروزرسانی موفق: {lastUpdated.toLocaleTimeString('fa-IR')}
    </p>
    <button onClick={handleRefresh}>تلاش مجدد برای بروزرسانی</button>
  </div>
)}
```

**2. Enhanced Refresh Button**

```typescript
<button
  onClick={handleRefresh}
  disabled={isRefreshing || isFetching}
  className="bg-blue-600 text-white rounded px-4 py-2..."
>
  {isFetching && <SpinnerIcon />}
  {isRefreshing ? 'در حال بروزرسانی...' :
   isFetching ? 'در حال دریافت...' :
   'بروزرسانی'}
</button>
```

**3. Color-Coded Status Indicator**

```typescript
<span className="relative flex h-2 w-2">
  {isFetching ? (
    // Blue pulsing dot when fetching
    <span className="bg-blue-500"></span>
  ) : (
    // Green pulsing dot when idle
    <span className="bg-green-500"></span>
  )}
</span>
<span>
  آخرین بروزرسانی: {lastUpdated.toLocaleTimeString('fa-IR')}
</span>
```

#### Smart Data Display Logic

**Show Cached Data Even When Refetch Fails**:

```typescript
// OLD: Only show data if no error
{currencies && !currenciesLoading && !currenciesError && (
  <DataDisplay />
)}

// NEW: Show cached data even if there's an error
{currencies && (
  <DataDisplay />
)}

// Only show error if NO cached data exists
{currenciesError && !currencies && (
  <ErrorDisplay />
)}
```

## User Experience Improvements

### Before Phase 8

1. ❌ When network fails, users see error message with no data
2. ❌ No indication of data freshness
3. ❌ Cached data discarded after 5 minutes
4. ❌ No visibility into background refetch attempts

### After Phase 8

1. ✅ Users see cached data even when network fails
2. ✅ Clear yellow banner warns "data may be outdated"
3. ✅ Cached data kept for 20 minutes
4. ✅ Timestamp shows last successful fetch
5. ✅ Visual feedback during background refetch (blue spinner)
6. ✅ Status indicator changes color (blue = fetching, green = idle)
7. ✅ Quick retry button in stale data banner

## Behavior in Different Scenarios

### Scenario 1: Normal Operation
- **State**: Data fetched successfully
- **Display**: Current data with green status indicator
- **Timestamp**: Shows current time

### Scenario 2: Network Temporarily Fails
- **State**: Has cached data, but refetch fails
- **Display**:
  - Yellow "data may be outdated" banner
  - Shows cached data from last successful fetch
  - Timestamp shows when data was last updated
- **Actions**: User can click "Retry" in banner

### Scenario 3: Network Fails on Initial Load
- **State**: No cached data, fetch fails
- **Display**:
  - Error message with suggested actions
  - "Retry" button to try fetching again
  - No stale data banner (no data to show)

### Scenario 4: Background Refetch in Progress
- **State**: Has cached data, currently fetching new data
- **Display**:
  - Shows current cached data
  - Blue pulsing status indicator
  - Spinner icon in refresh button
  - Button shows "در حال دریافت..." (Fetching...)
  - No stale data banner (not an error, just updating)

### Scenario 5: User Returns After 15 Minutes Offline
- **State**: Has 15-minute-old cached data (within 20-min window)
- **Display**:
  - Shows old cached data immediately
  - Automatically attempts refetch (refetchOnFocus)
  - If refetch fails, shows stale data banner
  - Timestamp shows data is 15 minutes old

## Technical Details

### RTK Query Automatic Behaviors

With our configuration, RTK Query automatically:

1. **Refetch on Focus**: When user returns to tab, attempts to refresh
2. **Refetch on Reconnect**: When network comes back, immediately refetches
3. **Refetch on Mount**: If data is older than 60 seconds, refetches on component mount
4. **Keep Stale Data**: Keeps data for 20 minutes even if component unmounts
5. **Polling**: Automatically refetches every 5 minutes (pollingInterval: 300000)

### Cache Strategy

```
Time    | Action           | Behavior
--------|------------------|------------------------------------------
0s      | Initial fetch    | Fetches data, caches for 20 min
30s     | Component mount  | Uses cache (data < 60s old)
70s     | Component mount  | Refetches (data > 60s old)
5m      | Auto poll        | Refetches due to pollingInterval
10m     | Network fails    | Shows stale data + warning banner
15m     | User refocuses   | Attempts refetch, keeps showing stale on fail
20m     | Cache expires    | If no successful fetch, cache cleared
```

### Error Handling + Stale Data

```typescript
// Smart error handling logic:
if (error && data) {
  // Has cached data but refetch failed
  return <StaleDataBanner /> + <DataDisplay />
} else if (error && !data) {
  // No cached data and fetch failed
  return <ErrorDisplay />
} else if (data) {
  // Has current data
  return <DataDisplay />
} else {
  // Loading initial data
  return <LoadingSkeleton />
}
```

## Files Modified

1. ✅ `apps/frontend/src/lib/store/services/api.ts`
   - Increased `keepUnusedDataFor` to 1200 seconds (20 minutes)
   - Increased `refetchOnMountOrArgChange` to 60 seconds
   - Added comments explaining stale data handling

2. ✅ `apps/frontend/src/app/page.tsx`
   - Added `isFetching` state tracking
   - Added `fulfilledTimeStamp` tracking
   - Added stale data warning banner
   - Enhanced refresh button with spinner and states
   - Added color-coded status indicator
   - Updated rendering logic to show cached data even on error
   - Updated timestamp to show last successful fetch only

## Testing Scenarios

### Manual Testing Steps

1. **Test Stale Data Display**:
   ```bash
   1. Load the page (data fetches successfully)
   2. Stop the backend server
   3. Wait for auto-refetch (5 minutes) or click refresh
   4. Verify: Yellow banner appears
   5. Verify: Old data still visible
   6. Verify: Timestamp shows last successful fetch time
   ```

2. **Test Background Refetch Indicator**:
   ```bash
   1. Load the page
   2. Wait 5 minutes for auto-poll
   3. Verify: Status indicator turns blue
   4. Verify: Spinner appears in refresh button
   5. Verify: Button shows "در حال دریافت..."
   6. Verify: After fetch completes, indicator turns green
   ```

3. **Test Retry from Stale Banner**:
   ```bash
   1. Get into stale data state (stop backend, refresh)
   2. Restart backend
   3. Click "تلاش مجدد برای بروزرسانی" in yellow banner
   4. Verify: Data refreshes successfully
   5. Verify: Yellow banner disappears
   6. Verify: Timestamp updates
   ```

4. **Test Cache Persistence**:
   ```bash
   1. Load the page
   2. Navigate to another tab
   3. Wait 10 minutes
   4. Come back to the tab
   5. Verify: Old data shows immediately (from cache)
   6. Verify: Automatic refetch triggers (refetchOnFocus)
   ```

## Performance Impact

- **Memory**: Negligible (keeping ~20KB of JSON for 20 minutes instead of 5)
- **Network**: Slightly reduced (less aggressive refetching)
- **UX**: Significantly improved (users never see blank screens)

## Accessibility

- ✅ Stale data banner has semantic warning color (yellow)
- ✅ Warning icon for screen readers
- ✅ Clear Persian text explaining the situation
- ✅ Action button to retry
- ✅ RTL layout for all Persian text
- ✅ Visual status indicators with color coding

## Next Steps / Future Enhancements

1. **Optional**: Add visual "staleness" indicator to each card
   - e.g., Gray overlay on cards with stale data
   - "⚠️ قدیمی" badge on individual sections

2. **Optional**: Show age of data
   - "بروزرسانی 15 دقیقه پیش" (Updated 15 minutes ago)
   - Real-time countdown

3. **Optional**: Differentiate between polling and manual refresh
   - Different spinners for background vs user-initiated

4. **Optional**: Add "Offline Mode" toggle
   - Let users explicitly work with cached data
   - Disable auto-refetch to save battery/data

## Conclusion

✅ **Phase 8 Complete**

The application now gracefully handles stale data by:
- Keeping cached data for 20 minutes
- Showing clear visual indicators when data is outdated
- Allowing users to continue working even when network fails
- Providing retry mechanisms
- Tracking and displaying data freshness

This completes the **8-phase error handling and reliability system**! 🎉

### All Phases Summary

1. ✅ Phase 1: Critical Error Boundaries
2. ✅ Phase 2: Enhanced RTK Query Error Handling
3. ✅ Phase 3: Environment Variable Validation
4. ✅ Phase 4: Error Type Safety
5. ✅ Phase 5: Error Monitoring Integration
6. ✅ Phase 6: Network Status Handling
7. ✅ Phase 7: Improved User-Facing Errors
8. ✅ Phase 8: Stale Data Handling

The application is now production-ready with comprehensive error handling! 🚀
