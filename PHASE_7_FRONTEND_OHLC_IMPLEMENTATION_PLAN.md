# Phase 7: Frontend - Current Day OHLC Display

## 📋 Overview

This phase implements the frontend UI components and data fetching logic to display the intraday OHLC (Open, High, Low, Close) data that Phase 6's backend provides.

**Goal**: Show users today's price movements with daily change percentages and mini sparkline charts.

---

## 🎯 Features to Implement

### 1. **Daily Change Display** (Enhanced)
- Show percentage change from open to current close
- Color-coded: Green (+) / Red (-)
- Format: "+2.34%" or "-1.58%"
- More prominent display than current change badge

### 2. **OHLC Data Display**
- High/Low range for the day
- Open price (market start)
- Current price (close)
- Optionally show in expanded view or tooltip

### 3. **Intraday Mini Charts (Sparklines)**
- Small line chart showing today's price movement
- Uses data points from IntradayOhlc.dataPoints[]
- Color matches change direction (green/red)
- Smooth animation on load
- No axes, labels - just the line shape

### 4. **Data Fetching Integration**
- RTK Query endpoints for OHLC data
- Auto-refresh with main data
- Fallback to regular price if OHLC unavailable
- Loading and error states

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENTS                       │
│                                                               │
│  ItemCard                                                    │
│    ├─ ItemCardHeader (name, icon, variants)                │
│    ├─ DailyChangeBadge (NEW - enhanced)                    │
│    │   └─ Shows % change from open to close                │
│    ├─ ItemCardPrice (current price)                        │
│    └─ IntradayMiniChart (NEW - sparkline)                  │
│        └─ Uses OHLC dataPoints for chart                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ useOhlcData()
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER (RTK Query)                    │
│                                                               │
│  api.ts (RTK Query API)                                      │
│    ├─ useGetTodayOhlcQuery(itemCode)                       │
│    │   └─ GET /navasan/ohlc/today/:itemCode                │
│    └─ useGetAllTodayOhlcQuery()                            │
│        └─ GET /navasan/ohlc/all                            │
│                                                               │
│  useOhlcData.ts (Custom Hook)                               │
│    ├─ Fetches OHLC for specific item                       │
│    ├─ Handles loading/error states                         │
│    ├─ Formats data for components                          │
│    └─ Returns: { ohlc, dailyChange, isLoading, error }    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Request
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API (Phase 6)                     │
│                                                               │
│  NavasanController                                           │
│    ├─ GET /api/navasan/ohlc/today/:itemCode                │
│    └─ GET /api/navasan/ohlc/all                            │
│                                                               │
│  IntradayOhlcService (already implemented)                  │
│    └─ Returns OHLC data with dataPoints[]                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Components to Create/Modify

### 1. **DailyChangeBadge** (NEW)

**File**: `apps/frontend/src/components/ItemCard/DailyChangeBadge.tsx`

**Purpose**: Display daily percentage change (open → current close)

**Props**:
```typescript
interface DailyChangeBadgeProps {
  dailyChangePercent: number // e.g., 2.34 or -1.58
  compact?: boolean
  className?: string
}
```

**Features**:
- Color-coded background: green (+) / red (-)
- Arrow icon: ↑ (up) / ↓ (down)
- Format: "+2.34%" with one arrow
- Larger and more prominent than regular change badge
- Smooth fade-in animation
- Accessible with ARIA labels

**Design**:
- Normal mode: Larger badge with rounded-lg
- Compact mode: Smaller badge
- Uses Tailwind colors: green-100/green-600, red-100/red-600

---

### 2. **IntradayMiniChart** (NEW)

**File**: `apps/frontend/src/components/ItemCard/IntradayMiniChart.tsx`

**Purpose**: Small sparkline chart showing today's price movement

**Props**:
```typescript
interface IntradayMiniChartProps {
  dataPoints: Array<{ time: string; price: number }> // e.g., [{time: "08:00", price: 70500}, ...]
  isPositive: boolean // Determines line color
  width?: number
  height?: number
  className?: string
  compact?: boolean
}
```

**Features**:
- Simple line chart (no axes, no labels)
- Smooth SVG path
- Color: green (positive) / red (negative)
- Gradient fill below line (subtle)
- Responsive sizing
- No external chart library (pure SVG)
- Smooth animation on mount

**Implementation**:
- Calculate min/max from dataPoints
- Normalize prices to 0-height range
- Generate SVG path from points
- Add gradient definition
- Animate with CSS or framer-motion

**Size**:
- Normal mode: ~80px width × 40px height
- Compact mode: ~60px × 30px

---

### 3. **useOhlcData Hook** (NEW)

**File**: `apps/frontend/src/hooks/useOhlcData.ts`

**Purpose**: Fetch and manage OHLC data for a specific item

**Interface**:
```typescript
interface UseOhlcDataOptions {
  itemCode: string
  category: 'currencies' | 'crypto' | 'gold'
  enabled?: boolean // Skip query if false
}

interface UseOhlcDataReturn {
  ohlc: {
    open: number
    high: number
    low: number
    close: number
    dailyChangePercent: number
    dataPoints: Array<{ time: string; price: number }>
  } | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

export const useOhlcData = (options: UseOhlcDataOptions): UseOhlcDataReturn
```

**Features**:
- Uses RTK Query under the hood
- Caching and auto-refetch
- Error handling with fallback
- Returns formatted data ready for components
- Skip query if enabled=false

---

### 4. **ItemCard Modifications** (MODIFY)

**File**: `apps/frontend/src/components/ItemCard/index.tsx`

**Changes**:

1. Add `ohlc` prop (optional):
```typescript
interface ItemCardProps {
  // ... existing props
  ohlc?: {
    dailyChangePercent?: number
    dataPoints?: Array<{ time: string; price: number }>
  }
}
```

2. Conditionally show DailyChangeBadge if OHLC data available:
```typescript
{ohlc?.dailyChangePercent !== undefined ? (
  <DailyChangeBadge dailyChangePercent={ohlc.dailyChangePercent} compact={compact} />
) : (
  <ItemCardBadge change={change} isPositive={isPositive} compact={compact} />
)}
```

3. Conditionally show IntradayMiniChart if dataPoints available:
```typescript
{ohlc?.dataPoints && ohlc.dataPoints.length > 0 && (
  <IntradayMiniChart
    dataPoints={ohlc.dataPoints}
    isPositive={ohlc.dailyChangePercent >= 0}
    compact={compact}
  />
)}
```

**Layout**:
```
┌────────────────────────────────────────┐
│ [Icon]           [Name]      [⋮]       │
│                                         │
│ [DailyChange]         [MiniChart]      │
│ [Price]                                │
└────────────────────────────────────────┘
```

---

### 5. **RTK Query API Endpoints** (MODIFY)

**File**: `apps/frontend/src/lib/store/services/api.ts`

**Add Interfaces**:
```typescript
export interface OhlcDataPoint {
  time: string // "08:00", "08:10", etc.
  price: number
}

export interface OhlcResponse {
  itemCode: string
  date: string // "2025-01-17"
  dateJalali: string // "1403/10/28"
  open: number
  high: number
  low: number
  close: number
  change: number // Daily change percentage
  dataPoints: OhlcDataPoint[]
  updateCount: number
  firstUpdate: string // ISO timestamp
  lastUpdate: string // ISO timestamp
}

export interface AllOhlcResponse {
  count: number
  data: OhlcResponse[]
}
```

**Add Endpoints**:
```typescript
export const api = createApi({
  // ... existing config
  endpoints: (builder) => ({
    // ... existing endpoints

    // Get today's OHLC for specific item
    getTodayOhlc: builder.query<OhlcResponse, string>({
      query: (itemCode) => `/navasan/ohlc/today/${itemCode}`,
      providesTags: (result, error, itemCode) => [{ type: 'Ohlc', id: itemCode }],
    }),

    // Get today's OHLC for all items
    getAllTodayOhlc: builder.query<AllOhlcResponse, void>({
      query: () => '/navasan/ohlc/all',
      providesTags: ['Ohlc'],
    }),
  }),
})

export const {
  // ... existing hooks
  useGetTodayOhlcQuery,
  useGetAllTodayOhlcQuery,
} = api
```

---

## 📝 Implementation Steps

### Step 1: Add RTK Query Endpoints (15 min)
- [ ] Add OHLC interfaces to `api.ts`
- [ ] Add `getTodayOhlc` endpoint
- [ ] Add `getAllTodayOhlc` endpoint
- [ ] Export hooks
- [ ] Test endpoints with curl

### Step 2: Create useOhlcData Hook (20 min)
- [ ] Create `hooks/useOhlcData.ts`
- [ ] Implement hook logic
- [ ] Add error handling
- [ ] Add TypeScript interfaces
- [ ] Test hook in isolation

### Step 3: Create DailyChangeBadge Component (30 min)
- [ ] Create component file
- [ ] Implement props interface
- [ ] Add styling (Tailwind)
- [ ] Add arrow icons
- [ ] Add color logic (green/red)
- [ ] Add animations
- [ ] Add accessibility
- [ ] Test component in Storybook/isolation

### Step 4: Create IntradayMiniChart Component (60 min)
- [ ] Create component file
- [ ] Implement SVG path generation
- [ ] Add min/max calculation
- [ ] Add gradient fill
- [ ] Add line rendering
- [ ] Add responsive sizing
- [ ] Add animation
- [ ] Test with sample data
- [ ] Test edge cases (empty data, single point)

### Step 5: Integrate OHLC into ItemCard (30 min)
- [ ] Add `ohlc` prop to ItemCard interface
- [ ] Import new components
- [ ] Add conditional rendering logic
- [ ] Test with OHLC data present
- [ ] Test with OHLC data absent (fallback)
- [ ] Check responsive behavior
- [ ] Check accessibility

### Step 6: Update Page/Container Components (20 min)
- [ ] Fetch OHLC data in page component
- [ ] Pass OHLC to ItemCard components
- [ ] Handle loading states
- [ ] Handle error states
- [ ] Test full integration

### Step 7: Testing & Polish (30 min)
- [ ] Test with real API data
- [ ] Test loading states
- [ ] Test error states
- [ ] Test responsive design
- [ ] Test accessibility
- [ ] Check performance
- [ ] Fix any issues

**Total Estimated Time**: ~3.5 hours

---

## 🎨 Design Specifications

### Colors
- **Positive (Green)**:
  - Background: `bg-green-100 dark:bg-green-900/20`
  - Text: `text-green-600 dark:text-green-400`
  - Chart line: `stroke-green-600 dark:stroke-green-400`

- **Negative (Red)**:
  - Background: `bg-red-100 dark:bg-red-900/20`
  - Text: `text-red-600 dark:text-red-400`
  - Chart line: `stroke-red-600 dark:stroke-red-400`

### Typography
- **Daily Change Badge**:
  - Font size: `text-xs` (12px) compact, `text-sm` (14px) normal
  - Font weight: `font-semibold` (600)
  - Line height: `leading-tight`

- **Price**:
  - No changes (existing)

### Spacing
- Gap between badge and price: `gap-1.5` (6px)
- Gap between price section and chart: `gap-2.5` (10px)
- Chart right margin: `mr-2` (8px)

### Animations
- **Badge fade-in**: 0.3s ease-in
- **Chart draw**: 0.5s ease-out (path animation)
- **Hover effects**: 0.2s ease-in-out

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] DailyChangeBadge: Positive/negative rendering
- [ ] DailyChangeBadge: Formatting edge cases (0, very large, very small)
- [ ] IntradayMiniChart: Path generation with various data
- [ ] IntradayMiniChart: Edge cases (empty, single point, all same value)
- [ ] useOhlcData: Success case
- [ ] useOhlcData: Error case
- [ ] useOhlcData: Loading state

### Integration Tests
- [ ] ItemCard with OHLC data
- [ ] ItemCard without OHLC data (fallback)
- [ ] Page component with OHLC fetching
- [ ] Refetch behavior

### Visual/Manual Tests
- [ ] Check all currencies show OHLC
- [ ] Check all crypto show OHLC
- [ ] Check all gold show OHLC
- [ ] Check responsive: mobile, tablet, desktop
- [ ] Check dark mode
- [ ] Check RTL layout
- [ ] Check accessibility (keyboard, screen reader)
- [ ] Check animations smooth

---

## 🚨 Edge Cases & Error Handling

### 1. **No OHLC Data Available**
**Scenario**: Item doesn't have OHLC data yet (new item, first day)

**Handling**:
- Fallback to regular ItemCardBadge (existing change badge)
- Don't show IntradayMiniChart
- No error shown to user
- Log info message in console (dev mode only)

### 2. **OHLC Fetch Fails**
**Scenario**: API error when fetching OHLC

**Handling**:
- Use fallback badge
- Don't block main data rendering
- Log error in console
- Show subtle indicator (optional)

### 3. **Empty dataPoints Array**
**Scenario**: OHLC exists but no intraday points yet

**Handling**:
- Show DailyChangeBadge (still useful)
- Hide IntradayMiniChart
- No error shown

### 4. **Single Data Point**
**Scenario**: Only one intraday update

**Handling**:
- Show as a dot or very short line
- Still show change badge

### 5. **All Same Price (Flat Line)**
**Scenario**: No price movement during day

**Handling**:
- Show flat line in chart
- Show "0.00%" change
- Neutral color (gray)

---

## 🔧 Configuration

### Environment Variables (Optional)
```env
# Enable/disable OHLC features
NEXT_PUBLIC_ENABLE_OHLC=true

# Minimum data points to show chart
NEXT_PUBLIC_OHLC_MIN_POINTS=3

# Auto-refresh interval (ms)
NEXT_PUBLIC_OHLC_REFRESH_INTERVAL=300000 # 5 minutes
```

### Feature Flags (Optional)
```typescript
// lib/features.ts
export const features = {
  ohlc: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_OHLC !== 'false',
    minPointsForChart: Number(process.env.NEXT_PUBLIC_OHLC_MIN_POINTS) || 3,
    refreshInterval: Number(process.env.NEXT_PUBLIC_OHLC_REFRESH_INTERVAL) || 300000,
  },
}
```

---

## 📊 Performance Considerations

### Optimization Strategies

1. **Memoization**:
   - Memoize IntradayMiniChart component
   - Memoize path calculation
   - Use React.memo with custom comparison

2. **Lazy Loading**:
   - Don't fetch OHLC for items not in viewport
   - Use intersection observer (optional)

3. **Caching**:
   - RTK Query handles caching automatically
   - 5-minute cache duration
   - Stale-while-revalidate pattern

4. **Bundle Size**:
   - No external chart libraries (pure SVG)
   - Minimal dependencies
   - Estimated addition: ~5KB gzipped

5. **Rendering**:
   - Virtual scrolling if many items (future)
   - Avoid unnecessary re-renders
   - Use key prop properly

---

## 🔄 Data Flow Example

### User Opens Page
```
1. Page mounts
2. useMarketData() fetches current prices (existing)
3. useGetAllTodayOhlcQuery() fetches all OHLC data (NEW)
4. Data arrives:
   {
     count: 45,
     data: [
       {
         itemCode: 'usd_sell',
         open: 70500,
         high: 71200,
         low: 70300,
         close: 70900,
         change: 0.57,
         dataPoints: [
           { time: '08:00', price: 70500 },
           { time: '08:10', price: 70550 },
           ...
         ]
       },
       ...
     ]
   }
5. ItemCard receives OHLC via props
6. DailyChangeBadge shows "+0.57%"
7. IntradayMiniChart renders sparkline
```

### User Refreshes Data
```
1. Click refresh button
2. refetchAll() called (existing)
3. OHLC also refetches
4. UI updates with new data
5. Smooth transition animation
```

---

## 📚 API Response Examples

### GET /api/navasan/ohlc/today/usd_sell

**Success Response**:
```json
{
  "itemCode": "usd_sell",
  "date": "2025-01-17",
  "dateJalali": "1403/10/28",
  "open": 70500,
  "high": 71200,
  "low": 70300,
  "close": 70900,
  "change": 0.57,
  "dataPoints": [
    { "time": "08:00", "price": 70500 },
    { "time": "08:10", "price": 70550 },
    { "time": "08:20", "price": 70600 },
    { "time": "08:30", "price": 70650 },
    ...
  ],
  "updateCount": 42,
  "firstUpdate": "2025-01-17T04:30:00.000Z",
  "lastUpdate": "2025-01-17T11:20:00.000Z"
}
```

**Error Response (404)**:
```json
{
  "statusCode": 404,
  "message": "OHLC data not found for usd_sell on 2025-01-17",
  "error": "Not Found"
}
```

### GET /api/navasan/ohlc/all

**Success Response**:
```json
{
  "count": 45,
  "data": [
    {
      "itemCode": "usd_sell",
      "date": "2025-01-17",
      "open": 70500,
      "high": 71200,
      "low": 70300,
      "close": 70900,
      "change": 0.57,
      "dataPoints": [...],
      "updateCount": 42,
      "lastUpdate": "2025-01-17T11:20:00.000Z"
    },
    ...
  ]
}
```

---

## ✅ Success Criteria

Phase 7 is complete when:

- [ ] All currencies show daily change percentage
- [ ] All crypto show daily change percentage
- [ ] All gold show daily change percentage
- [ ] Mini charts render for items with sufficient data points
- [ ] Fallback works when OHLC unavailable
- [ ] Loading states display correctly
- [ ] Error handling is graceful
- [ ] Responsive design works on all breakpoints
- [ ] Dark mode works correctly
- [ ] RTL layout works correctly
- [ ] Accessibility requirements met (keyboard, screen reader)
- [ ] Performance is acceptable (no lag/jank)
- [ ] No TypeScript errors
- [ ] No console errors/warnings
- [ ] Tests passing
- [ ] Documentation complete

---

## 🚀 Future Enhancements (Phase 8+)

1. **Expanded OHLC View**:
   - Modal/drawer with full OHLC details
   - Larger chart with time axis
   - Volume information
   - High/low indicators

2. **Historical OHLC**:
   - View past days' OHLC data
   - Compare multiple days
   - Calendar view with OHLC

3. **Advanced Charts**:
   - Candlestick charts
   - Multiple timeframes
   - Technical indicators

4. **Real-time Updates**:
   - WebSocket integration
   - Live price updates
   - Animated chart updates

5. **Alerts & Notifications**:
   - Price alerts (high/low)
   - Change threshold alerts
   - Push notifications

---

## 📖 Documentation

All components will include:
- JSDoc comments
- Props documentation
- Usage examples
- Accessibility notes
- Performance considerations

---

**Status**: 🟡 Ready to implement
**Priority**: High
**Estimated Effort**: ~3.5 hours
**Dependencies**: Phase 6 (Backend OHLC) ✅ Complete
