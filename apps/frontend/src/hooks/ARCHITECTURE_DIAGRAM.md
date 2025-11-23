# Date Navigation Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│                                                                  │
│  URL: https://example.com/?date=2025-11-22                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    React Application                     │    │
│  │                                                          │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │          Page Component (page.tsx)             │    │    │
│  │  │                                                 │    │    │
│  │  │  const historicalNav =                          │    │    │
│  │  │    useHistoricalNavigation()                    │    │    │
│  │  │                                                 │    │    │
│  │  │  const marketData =                             │    │    │
│  │  │    useMarketData(historicalNav.selectedDate)    │    │    │
│  │  └─────────────────┬───────────────────────────────┘    │    │
│  │                    │                                     │    │
│  │                    │ uses                                │    │
│  │                    ↓                                     │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │    useHistoricalNavigation Hook                │    │    │
│  │  │                                                 │    │    │
│  │  │  • Navigation logic (prev/next/today)          │    │    │
│  │  │  • Date calculations (days ago)                │    │    │
│  │  │  • 90-day limit enforcement                    │    │    │
│  │  │  • API date formatting                         │    │    │
│  │  │                                                 │    │    │
│  │  │  Depends on ↓                                   │    │    │
│  │  └─────────────────┬───────────────────────────────┘    │    │
│  │                    │                                     │    │
│  │                    ↓                                     │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │       useDateNavigation Hook                    │    │    │
│  │  │                                                 │    │    │
│  │  │  • Reads from URL query params                 │    │    │
│  │  │  • Writes to URL (router.push)                 │    │    │
│  │  │  • Validates date formats                      │    │    │
│  │  │  • Prevents future dates                       │    │    │
│  │  │                                                 │    │    │
│  │  │  Uses ↓                                         │    │    │
│  │  └─────────────────┬───────────────────────────────┘    │    │
│  │                    │                                     │    │
│  │                    ↓                                     │    │
│  │  ┌────────────────────────────────────────────────┐    │    │
│  │  │         Next.js App Router                      │    │    │
│  │  │                                                 │    │    │
│  │  │  • useSearchParams() - read URL                │    │    │
│  │  │  • useRouter() - update URL                    │    │    │
│  │  │  • usePathname() - current path                │    │    │
│  │  └─────────────────┬───────────────────────────────┘    │    │
│  │                    │                                     │    │
│  └────────────────────┼─────────────────────────────────────┘    │
│                       │                                          │
│                       ↓                                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │             Browser History API                        │    │
│  │                                                         │    │
│  │  Stack:                                                 │    │
│  │  [3] /?date=2025-11-21  ← Current                      │    │
│  │  [2] /?date=2025-11-22                                 │    │
│  │  [1] /                                                  │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow - User Clicks "Previous Day"

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: User Action                                     │
│ User clicks "Previous Day" button                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Component Event Handler                         │
│ onClick={() => historicalNav.goToPreviousDay()}         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: useHistoricalNavigation                         │
│ • Get current: selectedDate (from URL)                  │
│ • Calculate: newDate = current - 1 day                  │
│ • Validate: not exceeding 90 days                       │
│ • Call: setDate(newDate)                                │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: useDateNavigation                               │
│ • Format: date to YYYY-MM-DD                            │
│ • Build: URL with query param                           │
│ • Call: router.push('/?date=2025-11-22')                │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: Next.js Router                                  │
│ • Update browser URL                                    │
│ • Create history entry                                  │
│ • Trigger re-render                                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 6: Component Re-render                             │
│ • useDateNavigation reads new URL                       │
│ • Returns: selectedDate = 2025-11-22                    │
│ • useHistoricalNavigation receives new date             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 7: Data Fetching                                   │
│ • useMarketData(selectedDate)                           │
│ • Calls: useGetHistoricalQuery('2025-11-22')            │
│ • Fetches: Historical data from backend                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 8: UI Update                                       │
│ • Display historical data                               │
│ • Show date: November 22, 2025                          │
│ • Update navigation buttons                             │
│ • Show historical banner                                │
└─────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App
└── [locale]
    └── page.tsx (Main Page)
        │
        ├── PageHeader
        │   ├── SettingsModal
        │   ├── ViewModeToggle
        │   ├── RefreshButton
        │   └── LastUpdatedDisplay
        │       ├── PreviousDayButton ─────┐
        │       ├── DateDisplay            │
        │       └── NextDayButton ─────────┤
        │                                  │
        ├── SearchBar                      │
        │                                  │
        ├── DataSection (Currencies) ──────┤── All use:
        ├── DataSection (Crypto) ──────────┤   useHistoricalNavigation()
        ├── DataSection (Gold) ────────────┤
        │                                  │
        └── ChartBottomSheet ──────────────┘
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────┐
│                    URL (Single Source of Truth)          │
│                  /?date=2025-11-22                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ read by
                         ↓
┌─────────────────────────────────────────────────────────┐
│              useDateNavigation Hook                      │
│                                                          │
│  const searchParams = useSearchParams()                 │
│  const dateParam = searchParams.get('date')             │
│  const selectedDate = parseDateFromUrl(dateParam)       │
│                                                          │
│  Return: selectedDate = Date(2025-11-22)                │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ consumed by
                         ↓
┌─────────────────────────────────────────────────────────┐
│         useHistoricalNavigation Hook                     │
│                                                          │
│  const { selectedDate } = useDateNavigation()           │
│                                                          │
│  Compute:                                               │
│  • isToday = (selectedDate === null)                    │
│  • daysAgo = today - selectedDate                       │
│  • canGoBack = (daysAgo < 90)                           │
│  • formattedDate = "2025-11-22"                         │
│                                                          │
│  Return: { selectedDate, isToday, daysAgo, ... }        │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ used by
                         ↓
┌─────────────────────────────────────────────────────────┐
│               Page Components                            │
│                                                          │
│  const historicalNav = useHistoricalNavigation()        │
│                                                          │
│  Use in:                                                │
│  • Navigation UI (buttons)                              │
│  • Data fetching (API calls)                            │
│  • Display (date labels)                                │
│  • Conditional rendering (banners)                      │
└─────────────────────────────────────────────────────────┘
```

## URL Validation Pipeline

```
User Input: /?date=2030-12-31
         │
         ↓
┌─────────────────────────┐
│  Parse URL Parameter    │
│  dateString = "2030-12-31" │
└──────────┬──────────────┘
           │
           ↓
┌─────────────────────────┐      NO
│  Format Valid?          │─────────┐
│  (YYYY-MM-DD regex)     │         │
└──────────┬──────────────┘         │
           │ YES                    │
           ↓                        │
┌─────────────────────────┐         │
│  Parse to Date          │         │
│  Date(2030, 11, 31)     │         │
└──────────┬──────────────┘         │
           │                        │
           ↓                        │
┌─────────────────────────┐      NO │
│  Date Valid?            │─────────┤
│  (!isNaN)               │         │
└──────────┬──────────────┘         │
           │ YES                    │
           ↓                        │
┌─────────────────────────┐      NO │
│  Not Future?            │─────────┤
│  (date <= today)        │         │
└──────────┬──────────────┘         │
           │ YES                    │
           ↓                        │
┌─────────────────────────┐         │
│  ✅ Return Valid Date   │         │
│  Date(2025-11-22)       │         │
└─────────────────────────┘         │
                                    │
           ┌────────────────────────┘
           │
           ↓
┌─────────────────────────┐
│  ❌ Return null         │
│  (defaults to today)    │
│  + Log warning          │
└─────────────────────────┘
```

## Browser History Stack

```
Initial State:
┌─────────────────┐
│ [0] /           │ ← Current (Today)
└─────────────────┘

After clicking "Previous Day":
┌─────────────────┐
│ [1] /?date=...  │ ← Current (Yesterday)
├─────────────────┤
│ [0] /           │
└─────────────────┘

After clicking "Previous Day" again:
┌─────────────────┐
│ [2] /?date=...  │ ← Current (2 days ago)
├─────────────────┤
│ [1] /?date=...  │
├─────────────────┤
│ [0] /           │
└─────────────────┘

After clicking browser Back:
┌─────────────────┐
│ [2] /?date=...  │
├─────────────────┤
│ [1] /?date=...  │ ← Current (restored)
├─────────────────┤
│ [0] /           │
└─────────────────┘

After clicking browser Forward:
┌─────────────────┐
│ [2] /?date=...  │ ← Current (restored)
├─────────────────┤
│ [1] /?date=...  │
├─────────────────┤
│ [0] /           │
└─────────────────┘
```

## Hook Dependency Graph

```
useHistoricalNavigation
        │
        ├─── useDateNavigation
        │         │
        │         ├─── useSearchParams (Next.js)
        │         ├─── useRouter (Next.js)
        │         └─── usePathname (Next.js)
        │
        ├─── formatDateForApi (util)
        ├─── getTehranToday (util)
        └─── getTehranDateFromApi (async util)
```

## Date Format Flow

```
User Date: Date object (2025-11-22)
     │
     ↓
formatDateForApi()
     │
     ↓
API Format: "2025-11-22" (YYYY-MM-DD)
     │
     ├───→ URL parameter: ?date=2025-11-22
     │
     └───→ Backend API call: /api/currencies/historical/2025-11-22
```

## Error Handling Flow

```
                Invalid Input
                     │
                     ↓
         ┌───────────────────────┐
         │  Try Parse Date       │
         └───────┬───────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ✅ Success         ❌ Error
        │                 │
        ↓                 ↓
  Return Date    ┌──────────────┐
                 │ Log Warning  │
                 └───────┬──────┘
                         │
                         ↓
                  ┌──────────────┐
                  │ Return null  │
                  └───────┬──────┘
                          │
                          ↓
                  ┌──────────────┐
                  │ Show Today   │
                  └──────────────┘
```

## Integration Points

```
┌────────────────────────────────────────────────┐
│         Frontend Application                    │
│                                                 │
│  ┌──────────────────────────────────────┐     │
│  │  useHistoricalNavigation             │     │
│  │  • selectedDate from URL             │     │
│  └────────────┬─────────────────────────┘     │
│               │                                │
│               ↓                                │
│  ┌──────────────────────────────────────┐     │
│  │  useMarketData(selectedDate)         │     │
│  │  • Switches query based on date      │     │
│  └────────────┬─────────────────────────┘     │
│               │                                │
│               ↓                                │
│  ┌──────────────────────────────────────┐     │
│  │  RTK Query                           │     │
│  │  • useGetCurrenciesQuery()           │ ────┼──→ Backend
│  │    (if selectedDate is null)         │     │   /api/currencies
│  │  • useGetHistoricalQuery(date)       │ ────┼──→ Backend
│  │    (if selectedDate is set)          │     │   /api/currencies/historical/2025-11-22
│  └──────────────────────────────────────┘     │
│                                                 │
└────────────────────────────────────────────────┘
```

## Legend

```
┌─────┐
│ Box │  = Component, Hook, or System
└─────┘

───→    = Data flow or dependency

↓       = Sequential step

├──     = Branch point

[N]     = Array index or history position

✅      = Success path
❌      = Error path
```

## Summary

This architecture ensures:
1. **Single Source of Truth**: URL contains the date
2. **Unidirectional Data Flow**: URL → Hook → Component
3. **Separation of Concerns**: Low-level URL management vs high-level navigation logic
4. **Type Safety**: TypeScript throughout the stack
5. **Error Handling**: Graceful degradation to today on invalid input
6. **Browser Integration**: Native history API support
