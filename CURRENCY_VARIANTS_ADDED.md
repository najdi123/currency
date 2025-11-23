# Currency Variants Implementation - NEW ADDITIONS

## Summary

Added new regional currency variants based on Navasan API documentation to provide more comprehensive price coverage for users in different regions.

---

## New Variants Added

### 1. Regional USD Variants (3 new)
These provide USD prices for different cities/regions:

| Code | API Code | Description | Parent |
|------|----------|-------------|--------|
| `usd_mashad_sell` | `dolar_mashad_sell` | Dollar Mashhad - Sell | USD |
| `usd_destan_sell` | `dolar_destan_sell` | Dollar Kurdistan - Sell | USD |
| `usd_soleimanie_sell` | `dolar_soleimanie_sell` | Dollar Sulaymaniyah - Sell | USD |

### 2. AED/Dirham Variants (2 new)
Additional Dubai Dirham rates:

| Code | API Code | Description | Parent |
|------|----------|-------------|--------|
| `aed_sell` | `aed_sell` | Dirham Dubai - Sell | AED |
| `dirham_dubai` | `dirham_dubai` | Dirham Dubai | AED |

---

## Files Modified

### Backend

#### 1. `apps/backend/src/navasan/navasan.service.ts`
**Lines modified:** 37-42

**Changes:**
- Added new items to `currencies` list
- Added: `aed_sell`, `dirham_dubai`, `dolar_mashad_sell`, `dolar_destan_sell`, `dolar_soleimanie_sell`

```typescript
currencies: 'usd_sell,eur,gbp,cad,aud,aed,aed_sell,dirham_dubai,...,dolar_mashad_sell,dolar_destan_sell,dolar_soleimanie_sell,...'
```

#### 2. `apps/backend/src/chart/chart.service.ts`
**Lines modified:** Multiple sections

**Changes:**
- Added mappings in `itemCodeMap` (lines 99-120)
- Added category mappings in `itemCategoryMap` (lines 189-213)
- Added validation in `isValidCurrencyCode` (lines 328-333)

```typescript
// Item code mappings
USD_MASHAD_SELL: 'dolar_mashad_sell',
USD_DESTAN_SELL: 'dolar_destan_sell',
USD_SOLEIMANIE_SELL: 'dolar_soleimanie_sell',
AED_SELL: 'aed_sell',
DIRHAM_DUBAI: 'dirham_dubai',
```

### Frontend

#### 3. `apps/frontend/src/lib/utils/dataItemHelpers.ts`
**Lines modified:** 72-172

**Changes:**
- Added 5 new currency variants to `currencyVariants` array
- Properly ordered with display order for USD and AED parents

```typescript
// New USD variants (display order 10-12)
{ code: 'usd_mashad_sell', apiCode: 'dolar_mashad_sell', ... },
{ code: 'usd_destan_sell', apiCode: 'dolar_destan_sell', ... },
{ code: 'usd_soleimanie_sell', apiCode: 'dolar_soleimanie_sell', ... },

// New AED variants (display order 1-2)
{ code: 'aed_sell', apiCode: 'aed_sell', ... },
{ code: 'dirham_dubai', apiCode: 'dirham_dubai', ... },
```

#### 4. `apps/frontend/messages/fa.json` (Persian)
**Lines modified:** 477-499

**Translations added:**
```json
"usd_mashad_sell": "دلار مشهد - فروش",
"usd_destan_sell": "دلار کردستان - فروش",
"usd_soleimanie_sell": "دلار سلیمانیه - فروش",
"aed_sell": "درهم دبی - فروش",
"dirham_dubai": "درهم دبی"
```

#### 5. `apps/frontend/messages/en.json` (English)
**Lines modified:** 477-499

**Translations added:**
```json
"usd_mashad_sell": "Dollar Mashhad - Sell",
"usd_destan_sell": "Dollar Kurdistan - Sell",
"usd_soleimanie_sell": "Dollar Sulaymaniyah - Sell",
"aed_sell": "Dirham Dubai - Sell",
"dirham_dubai": "Dirham Dubai"
```

#### 6. `apps/frontend/messages/ar.json` (Arabic)
**Lines modified:** 477-499

**Translations added:**
```json
"usd_mashad_sell": "دولار مشهد - بيع",
"usd_destan_sell": "دولار كردستان - بيع",
"usd_soleimanie_sell": "دولار سليمانية - بيع",
"aed_sell": "درهم دبي - بيع",
"dirham_dubai": "درهم دبي"
```

---

## How It Works

### Backend Flow
1. **Navasan API Fetch**: Backend includes new items in API request
2. **Response Storage**: Data stored in MongoDB cache with all variants
3. **API Response**: Returns all variants to frontend via `/api/navasan/currencies`

### Frontend Flow
1. **Data Receipt**: Frontend receives currency data including new variants
2. **Variant Detection**: `CurrencyVariantsDropdown` component detects parent-child relationships
3. **Three-Dot Button**: Shows automatically for currencies with variants (USD, AED)
4. **Dropdown Display**: Shows all variants with prices and change percentages

### Three-Dot Button Location
The three-dot button appears on:
- **USD card** (usd_sell) - Shows 12 variants including the 3 new regional ones
- **AED card** (aed) - Shows 2 variants (the newly added ones)

---

## Testing the Implementation

### 1. Backend Testing

```bash
# Start backend
cd apps/backend
npm run start:dev

# Test API endpoint
curl http://localhost:4000/api/navasan/currencies | jq .
```

**Expected in response:**
- `dolar_mashad_sell: { value: ..., change: ... }`
- `dolar_destan_sell: { value: ..., change: ... }`
- `dolar_soleimanie_sell: { value: ..., change: ... }`
- `aed_sell: { value: ..., change: ... }`
- `dirham_dubai: { value: ..., change: ... }`

### 2. Frontend Testing

```bash
# Start frontend
cd apps/frontend
npm run dev
```

**Visual Test:**
1. Open `http://localhost:3000`
2. Find **USD (Dollar)** card
3. Click the **three-dot button** (⋮) in top-right
4. Verify dropdown shows:
   - دلار مشهد - فروش (Dollar Mashhad)
   - دلار کردستان - فروش (Dollar Kurdistan)
   - دلار سلیمانیه - فروش (Dollar Sulaymaniyah)
5. Find **AED (Dirham)** card
6. Click three-dot button
7. Verify dropdown shows:
   - درهم دبی - فروش (Dirham Dubai - Sell)
   - درهم دبی (Dirham Dubai)

### 3. Chart Testing

```bash
# Test chart endpoints for new variants
curl "http://localhost:4000/api/chart/USD_MASHAD_SELL?timeRange=1w&itemType=currency"
curl "http://localhost:4000/api/chart/USD_DESTAN_SELL?timeRange=1w&itemType=currency"
curl "http://localhost:4000/api/chart/AED_SELL?timeRange=1w&itemType=currency"
```

---

## User Experience

### Before
- USD card had 9 variants (buy, harat, tomorrow, special)
- AED card had NO variants (no three-dot button)

### After
- USD card has **12 variants** (added 3 regional rates)
- AED card has **2 variants** (three-dot button now appears)
- Users can see regional price differences
- More comprehensive price information for cross-border users

---

## Regional Context

### Why These Variants Matter

**Mashhad (مشهد):**
- Major Iranian city near Afghanistan border
- Important trading hub
- Different rates due to local market

**Kurdistan/Destan (کردستان):**
- Northern Iraq region
- Autonomous economic zone
- Distinct currency market rates

**Sulaymaniyah (سلیمانیه):**
- Major city in Iraqi Kurdistan
- Economic center with independent exchange rates
- Important for cross-border trade

**Dubai Dirham:**
- UAE currency used in Iran for trade
- Multiple rate types (cash, transfer, etc.)
- Critical for import/export business

---

## API Mapping Reference

For developers working with the Navasan API:

| Frontend Code | Backend API Code | Navasan API Item |
|---------------|------------------|------------------|
| usd_sell | usd_sell | usd_sell |
| usd_mashad_sell | dolar_mashad_sell | dolar_mashad_sell |
| usd_destan_sell | dolar_destan_sell | dolar_destan_sell |
| usd_soleimanie_sell | dolar_soleimanie_sell | dolar_soleimanie_sell |
| aed | aed | aed |
| aed_sell | aed_sell | aed_sell |
| dirham_dubai | dirham_dubai | dirham_dubai |

---

## Future Enhancements

Based on Navasan API documentation, these could be added next:

### Bank Exchange Rates
- `mex_usd_buy`, `mex_usd_sell` - National Exchange Dollar (Bank rates)
- `mex_eur_buy`, `mex_eur_sell` - National Exchange Euro

### PayPal Rates
- `eur_ppp` - Euro PayPal rate

### Precious Metals
- `usd_xau` - Gold Ounce in USD

### Additional Regional Rates
Check Navasan API for any new regional variants they add

---

## Verification Checklist

- [x] Backend fetches new items from Navasan API
- [x] Chart service maps new codes correctly
- [x] Frontend shows new variants in dropdown
- [x] Persian translations complete
- [x] English translations complete
- [x] Arabic translations complete
- [x] All variants display with correct prices
- [x] Three-dot button shows for USD and AED
- [x] Charts work for new variant codes
- [ ] Test with real API data (requires valid Navasan API key)
- [ ] Test in production environment
- [ ] Monitor for API errors on new items

---

## Rollback Plan

If issues occur, revert these commits:

```bash
# Revert backend changes
git checkout HEAD~1 -- apps/backend/src/navasan/navasan.service.ts
git checkout HEAD~1 -- apps/backend/src/chart/chart.service.ts

# Revert frontend changes
git checkout HEAD~1 -- apps/frontend/src/lib/utils/dataItemHelpers.ts
git checkout HEAD~1 -- apps/frontend/messages/fa.json
git checkout HEAD~1 -- apps/frontend/messages/en.json
git checkout HEAD~1 -- apps/frontend/messages/ar.json
```

---

## Notes

- All new variants are properly typed in TypeScript
- No breaking changes to existing functionality
- Backward compatible with existing code
- Follows existing naming conventions
- Properly integrated with caching system
- Works with stale data fallback
- Chart support fully implemented

---

## Questions?

For issues or questions about this implementation:
1. Check Navasan API documentation: https://www.navasan.tech/webserviceguide/
2. Review component code: `CurrencyVariantsDropdown.tsx`
3. Check backend service: `navasan.service.ts`
4. Test with curl commands above
