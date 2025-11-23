# Date Navigation Implementation Guide

This document describes the URL-based date navigation system implemented for the currency tracking application.

## Overview

The date navigation system allows users to:
- Navigate through historical data using previous/next day buttons
- Share URLs with specific dates
- Use browser back/forward buttons to navigate through date history
- Bookmark specific dates for later reference

## Architecture

### Components

1. **`useDateNavigation`** - Low-level hook managing URL query parameters
2. **`useHistoricalNavigation`** - High-level hook providing navigation logic and date calculations
3. **`LastUpdatedDisplay`** - UI component rendering navigation buttons
4. **`PageHeader`** - Container component coordinating state

### Data Flow

```
User clicks button
  ↓
LastUpdatedDisplay calls historicalNav.goToPreviousDay()
  ↓
useHistoricalNavigation calculates new date
  ↓
useDateNavigation updates URL (?date=2025-11-22)
  ↓
Next.js router triggers re-render
  ↓
useDateNavigation reads date from URL
  ↓
useHistoricalNavigation receives selectedDate
  ↓
useMarketData fetches historical data for that date
  ↓
UI updates with historical data
```

## Hook APIs

### `useDateNavigation()`

Low-level hook for URL parameter management.

**Returns:**
```typescript
{
  selectedDate: Date | null,        // Date from URL or null for today
  setDate: (date: Date | null) => void,  // Update URL with new date
  getFormattedDate: () => string | null, // Get YYYY-MM-DD format
  isToday: boolean                  // True if no date param in URL
}
```

**URL Format:**
- Today: `/` (no query param)
- Historical: `/?date=2025-11-22`

**Edge Cases Handled:**
- Invalid date format → defaults to today
- Future dates → defaults to today
- Malformed dates → defaults to today
- Missing date param → returns today

### `useHistoricalNavigation()`

High-level hook for historical date navigation logic.

**Returns:**
```typescript
{
  selectedDate: Date | null,         // Current selected date
  goToPreviousDay: () => void,       // Navigate to previous day
  goToNextDay: () => void,           // Navigate to next day (or today)
  goToToday: () => void,             // Reset to today
  isToday: boolean,                  // True if viewing today
  daysAgo: number,                   // Days back from today (0 = today)
  formattedDate: string | null,      // YYYY-MM-DD for API
  canGoBack: boolean,                // Can navigate back (max 90 days)
  canGoForward: boolean              // Can navigate forward (not at today)
}
```

**Constraints:**
- Maximum 90 days back
- Cannot navigate to future dates
- Automatically syncs with URL

## Usage Examples

### Basic Usage in a Page

```typescript
'use client'

import { useHistoricalNavigation } from '@/hooks/useHistoricalNavigation'
import { useMarketData } from '@/lib/hooks/useMarketData'

export default function MarketPage() {
  const historicalNav = useHistoricalNavigation()
  const marketData = useMarketData(historicalNav.selectedDate)

  return (
    <div>
      <h1>
        {historicalNav.isToday ? 'Today' : `${historicalNav.daysAgo} days ago`}
      </h1>

      <button
        onClick={historicalNav.goToPreviousDay}
        disabled={!historicalNav.canGoBack}
      >
        Previous Day
      </button>

      <button
        onClick={historicalNav.goToNextDay}
        disabled={!historicalNav.canGoForward}
      >
        Next Day
      </button>

      <button onClick={historicalNav.goToToday}>
        Today
      </button>

      <div>
        {/* Display market data */}
        {marketData.currencies && <CurrencyList data={marketData.currencies} />}
      </div>
    </div>
  )
}
```

### Programmatic Date Selection

```typescript
import { useDateNavigation } from '@/hooks/useDateNavigation'

function CustomDatePicker() {
  const { selectedDate, setDate } = useDateNavigation()

  const handleDateSelect = (date: Date) => {
    setDate(date) // Updates URL automatically
  }

  const resetToToday = () => {
    setDate(null) // Removes date param from URL
  }

  return (
    <input
      type="date"
      value={selectedDate ? formatDateForApi(selectedDate) : ''}
      onChange={(e) => handleDateSelect(new Date(e.target.value))}
    />
  )
}
```

### Checking URL Parameters

```typescript
// URL: /?date=2025-11-20
const { selectedDate, isToday } = useDateNavigation()

console.log(selectedDate) // Date object: 2025-11-20
console.log(isToday)      // false

// URL: /
console.log(selectedDate) // null
console.log(isToday)      // true
```

## URL Structure

### Query Parameters

| Parameter | Format | Example | Description |
|-----------|--------|---------|-------------|
| `date` | YYYY-MM-DD | `2025-11-22` | Selected historical date |

### URL Examples

```
# Today (no query param)
https://example.com/

# Yesterday
https://example.com/?date=2025-11-22

# Specific date
https://example.com/?date=2025-10-15

# With locale
https://example.com/fa?date=2025-11-22
```

## Browser History Support

### How It Works

1. **Initial Load**: URL is parsed, date is extracted
2. **Navigation**: Each date change creates a new history entry
3. **Back Button**: Browser navigates to previous URL, component re-renders with previous date
4. **Forward Button**: Browser navigates to next URL, component re-renders with next date

### Example Flow

```
User at: /
Clicks "Previous Day" → /?date=2025-11-22 (new history entry)
Clicks "Previous Day" → /?date=2025-11-21 (new history entry)
Clicks browser back → /?date=2025-11-22 (navigates history)
Clicks browser back → / (navigates history)
```

## Shareable URLs

### Creating Shareable Links

Users can copy the URL from the browser address bar to share specific dates:

```typescript
// Current URL: /?date=2025-11-20
const shareableUrl = window.location.href
// User shares: https://example.com/?date=2025-11-20

// Recipient opens link → automatically sees data for 2025-11-20
```

### Bookmarking

Users can bookmark URLs with specific dates:
```
Bookmark: "Currency Prices - Nov 20" → /?date=2025-11-20
```

## Error Handling

### Invalid Date Formats

```typescript
// URL: /?date=invalid-date
// Result: selectedDate = null (defaults to today)
// Console: [useDateNavigation] Invalid date format in URL: invalid-date
```

### Future Dates

```typescript
// URL: /?date=2026-01-01 (assuming today is 2025-11-23)
// Result: selectedDate = null (defaults to today)
// Console: [useDateNavigation] Future date in URL, defaulting to today: 2026-01-01
```

### Maximum Days Back

```typescript
const historicalNav = useHistoricalNavigation()

// Try to go back 91 days (exceeds MAX_DAYS_BACK = 90)
historicalNav.goToPreviousDay() // at day 90
// Console: [useHistoricalNavigation] Cannot go back further than 90 days
// URL does not change
```

## Integration with Data Fetching

The `useMarketData` hook automatically switches between current and historical endpoints based on the selected date:

```typescript
export const useMarketData = (selectedDate: Date | null = null) => {
  const isHistorical = selectedDate !== null
  const dateParam = isHistorical ? formatDateForApi(selectedDate) : ''

  // Current data (when selectedDate is null)
  const currenciesCurrentQuery = useGetCurrenciesQuery(undefined, {
    skip: isHistorical,
  })

  // Historical data (when selectedDate is set)
  const currenciesHistoricalQuery = useGetCurrenciesHistoricalQuery(dateParam, {
    skip: !isHistorical,
  })

  // Return appropriate query result
  const currenciesQuery = isHistorical ? currenciesHistoricalQuery : currenciesCurrentQuery

  // ... rest of implementation
}
```

## Testing Recommendations

### Manual Testing Checklist

1. **Basic Navigation**
   - [ ] Click "Previous Day" updates URL
   - [ ] Click "Next Day" updates URL
   - [ ] Click "Today" removes date param
   - [ ] Navigation buttons show correct state (enabled/disabled)

2. **Browser History**
   - [ ] Browser back button navigates to previous date
   - [ ] Browser forward button navigates to next date
   - [ ] Back/forward maintains scroll position
   - [ ] URL updates correctly during navigation

3. **Shareable URLs**
   - [ ] Copying URL and opening in new tab shows same date
   - [ ] Sharing URL with others works correctly
   - [ ] Bookmarking works as expected

4. **Edge Cases**
   - [ ] Invalid date in URL defaults to today
   - [ ] Future date in URL defaults to today
   - [ ] Cannot navigate beyond 90 days back
   - [ ] Cannot navigate to future dates

5. **Data Fetching**
   - [ ] Changing date triggers new data fetch
   - [ ] Historical data displays correctly
   - [ ] Error states show when data unavailable
   - [ ] Loading states show during fetch

### Automated Testing

Example test cases:

```typescript
import { renderHook, act } from '@testing-library/react'
import { useDateNavigation } from '@/hooks/useDateNavigation'

describe('useDateNavigation', () => {
  it('should parse date from URL', () => {
    // Mock URL: /?date=2025-11-22
    const { result } = renderHook(() => useDateNavigation())
    expect(result.current.selectedDate?.toISOString()).toContain('2025-11-22')
  })

  it('should handle invalid date format', () => {
    // Mock URL: /?date=invalid
    const { result } = renderHook(() => useDateNavigation())
    expect(result.current.selectedDate).toBeNull()
  })

  it('should update URL when date changes', () => {
    const { result } = renderHook(() => useDateNavigation())
    const newDate = new Date('2025-11-20')

    act(() => {
      result.current.setDate(newDate)
    })

    // Verify router.push was called with correct URL
    expect(mockRouter.push).toHaveBeenCalledWith('/?date=2025-11-20', { scroll: false })
  })
})
```

## Performance Considerations

### Optimizations Applied

1. **Memoization**: All computed values use `useMemo` to prevent recalculation
2. **Callback Stability**: Navigation functions use `useCallback` for stable references
3. **No Scroll Reset**: `router.push` uses `{ scroll: false }` to maintain position
4. **Query Skipping**: RTK Query skips unused endpoints (current vs historical)

### Bundle Size

- `useDateNavigation`: ~1.5KB
- `useHistoricalNavigation`: ~2KB
- Total overhead: ~3.5KB (minimal impact)

## Future Enhancements

Potential improvements:

1. **Date Range Selection**: Allow selecting start/end dates for ranges
2. **Calendar Widget**: Visual date picker component
3. **Keyboard Shortcuts**: Arrow keys for previous/next day
4. **Deep Linking**: Support for specific data sections (e.g., `/?date=2025-11-22&section=crypto`)
5. **URL Compression**: Shorter date format (e.g., `?d=20251122`)

## Troubleshooting

### Issue: Date doesn't update when clicking navigation buttons

**Solution**: Ensure the page component is wrapped with `'use client'` directive since hooks use client-side routing.

### Issue: Browser back button doesn't work

**Solution**: Verify you're using `router.push()` not `router.replace()`. Push creates history entries, replace doesn't.

### Issue: Date resets to today on page refresh

**Solution**: Check that the URL still contains the date parameter. If it's missing, the hook correctly defaults to today.

### Issue: Cannot navigate beyond certain date

**Solution**: This is expected behavior. The system limits historical navigation to 90 days back. Check `MAX_DAYS_BACK` constant if you need to adjust this.

## Best Practices

1. **Always use the hook at the top level**: Don't call inside conditions or loops
2. **Don't manipulate URL directly**: Always use the provided hook functions
3. **Handle loading states**: Data fetching is async, show appropriate UI
4. **Validate dates server-side**: Don't trust URL parameters alone for critical operations
5. **Test edge cases**: Invalid dates, future dates, max limits

## Related Files

- `apps/frontend/src/hooks/useDateNavigation.ts` - URL parameter hook
- `apps/frontend/src/hooks/useHistoricalNavigation.ts` - Navigation logic hook
- `apps/frontend/src/lib/utils/dateUtils.ts` - Date formatting utilities
- `apps/frontend/src/lib/hooks/useMarketData.ts` - Data fetching integration
- `apps/frontend/src/components/LastUpdatedDisplay/LastUpdatedDisplay.tsx` - UI component
