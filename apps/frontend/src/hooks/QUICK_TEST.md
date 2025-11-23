# Quick Testing Guide for URL Date Navigation

## How to Test the Implementation

### 1. Start the Development Server

```bash
cd apps/frontend
npm run dev
```

### 2. Open the Application

Navigate to: `http://localhost:3000` (or your configured port)

### 3. Test Basic Navigation

**Test Previous Day:**
1. Click the "Previous Day" button (left button in header)
2. Verify URL changes to: `http://localhost:3000/?date=YYYY-MM-DD`
3. Verify data updates to show historical data
4. Verify date display shows the selected date

**Test Next Day:**
1. Click the "Next Day" button (right button)
2. Verify URL updates to the next date
3. Verify data updates

**Test Today:**
1. Click "Today" button (when viewing historical data)
2. Verify URL parameter is removed: `http://localhost:3000/`
3. Verify data shows current/today's data

### 4. Test Browser History

**Test Back Button:**
1. Navigate to yesterday: `/?date=2025-11-22`
2. Navigate to day before: `/?date=2025-11-21`
3. Click browser back button
4. Verify: URL is `/?date=2025-11-22` again
5. Verify: Data shows correct date

**Test Forward Button:**
1. After going back (step above)
2. Click browser forward button
3. Verify: URL is `/?date=2025-11-21` again
4. Verify: Data updates correctly

### 5. Test Shareable URLs

**Copy and Share:**
1. Navigate to a specific date: `/?date=2025-11-20`
2. Copy the URL from the address bar
3. Open a new incognito/private window
4. Paste the URL
5. Verify: Page loads with the selected date
6. Verify: Data shows for November 20, 2025

**Bookmark:**
1. Navigate to a date
2. Bookmark the page (Ctrl+D / Cmd+D)
3. Close the tab
4. Open the bookmark
5. Verify: Correct date is loaded

### 6. Test Edge Cases

**Invalid Date Format:**
1. Manually type in URL: `http://localhost:3000/?date=invalid-date`
2. Press Enter
3. Verify: Page shows today's data (defaults to today)
4. Check console: Should see warning about invalid format

**Future Date:**
1. Manually type: `http://localhost:3000/?date=2030-12-31`
2. Press Enter
3. Verify: Page shows today's data (prevents future dates)
4. Check console: Should see warning about future date

**Max Days Back:**
1. Click "Previous Day" repeatedly (90 times)
2. After 90 days, verify:
   - "Previous Day" button becomes disabled
   - Clicking does nothing
   - Console shows warning about max limit

**Malformed Date:**
1. Try: `http://localhost:3000/?date=2025-13-45`
2. Verify: Defaults to today
3. Check console: Warning about invalid date

### 7. Test with Multiple Locales

**English:**
```
http://localhost:3000/en?date=2025-11-20
```

**Farsi:**
```
http://localhost:3000/fa?date=2025-11-20
```

**Arabic:**
```
http://localhost:3000/ar?date=2025-11-20
```

Verify: Date navigation works in all locales

### 8. Test Data Fetching

**Loading States:**
1. Navigate to a new date
2. Verify: Loading indicator appears
3. Verify: Data updates after load completes

**Error States:**
1. Navigate to a date with no data (if backend restricts)
2. Verify: Error message displays
3. Verify: "Back to Today" button works

**Historical Banner:**
1. Navigate to any past date
2. Verify: Blue banner appears showing "Viewing historical data for [date]"
3. Verify: Shows days ago count

### 9. Test Accessibility

**Keyboard Navigation:**
1. Tab to navigation buttons
2. Verify: Buttons receive focus (visible focus ring)
3. Press Enter to activate
4. Verify: Navigation works

**Screen Reader:**
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate to date controls
3. Verify: Buttons announce correctly
4. Verify: Date changes are announced

**ARIA Live Region:**
1. Change dates
2. Verify: Screen reader announces "Viewing data for [date]"

### 10. Performance Testing

**Quick Navigation:**
1. Click Previous Day 10 times rapidly
2. Verify: All clicks register
3. Verify: URL updates correctly
4. Verify: No lag or freezing

**Browser History:**
1. Create 20+ history entries by navigating dates
2. Use browser back repeatedly
3. Verify: No memory leaks
4. Verify: Smooth navigation

## Expected Results Checklist

### URL Behavior
- [ ] URL updates on every date change
- [ ] URL shows `?date=YYYY-MM-DD` format
- [ ] No date parameter when viewing today
- [ ] URL works with locale prefix (`/en?date=...`)

### Browser History
- [ ] Back button navigates to previous date
- [ ] Forward button navigates to next date
- [ ] History stack builds correctly
- [ ] Scroll position maintained

### Shareable URLs
- [ ] Copying URL works
- [ ] Pasting URL in new tab works
- [ ] Sharing URL with others works
- [ ] Bookmarks work correctly

### Edge Cases
- [ ] Invalid dates default to today
- [ ] Future dates prevented
- [ ] Max 90 days back enforced
- [ ] Malformed dates handled gracefully

### Data Integration
- [ ] Historical data fetched correctly
- [ ] Loading states show
- [ ] Error states handled
- [ ] Current data shown for today

### UI/UX
- [ ] Buttons enable/disable correctly
- [ ] Date display accurate
- [ ] Historical banner shows
- [ ] Smooth transitions

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus management correct
- [ ] ARIA labels present
- [ ] Screen reader friendly

## Quick Verification Commands

### Check URL in Browser Console
```javascript
// Should show current date parameter or empty string
console.log(new URLSearchParams(window.location.search).get('date'))
```

### Check Selected Date
```javascript
// In React DevTools, find the component using useHistoricalNavigation
// Look at the hook state to see selectedDate value
```

### Monitor Navigation
```javascript
// Add to browser console to log all navigation
const original = window.history.pushState;
window.history.pushState = function(...args) {
  console.log('Navigation:', args[2]);
  return original.apply(this, args);
};
```

## Common Issues and Solutions

### Issue: URL doesn't update
- Check if page has `'use client'` directive
- Verify Next.js router is available
- Check browser console for errors

### Issue: Date resets on refresh
- Verify URL actually contains `?date=` parameter
- Check network tab for redirects
- Ensure no middleware is stripping params

### Issue: Cannot go back past certain date
- This is correct behavior (90-day limit)
- Check if data exists for that date on backend
- Verify MAX_DAYS_BACK constant if adjustment needed

### Issue: Browser back doesn't work
- Ensure using `router.push()` not `router.replace()`
- Check if page is cached incorrectly
- Verify history entries are created

## Success Indicators

✅ All checklist items pass
✅ No console errors or warnings (except expected validation warnings)
✅ Smooth user experience
✅ Browser history works naturally
✅ URLs are shareable and bookmarkable
✅ Edge cases handled gracefully

## Reporting Issues

If you find any issues:

1. Note the exact steps to reproduce
2. Check browser console for errors
3. Note the URL before and after the issue
4. Check if it happens in multiple browsers
5. Verify it's not a backend data availability issue

Refer to `README_DATE_NAVIGATION.md` for detailed troubleshooting.
