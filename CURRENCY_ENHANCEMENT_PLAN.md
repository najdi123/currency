# Currency Enhancement Implementation Plan

## 📋 Overview
This document provides a step-by-step guide to implement the following features:
1. Add UAE Dirham (AED), Chinese Yuan (CNY), and Turkish Lira (TRY) to main currency display
2. Implement expandable "Show More" sections for additional currencies from API
3. Add dropdown menus for currencies with multiple price variants (buy/sell, different exchanges)

---

## 🎯 User Requirements Summary

Based on research and user preferences:
- **New Currencies**: AED, CNY, TRY should appear in main "Currently" display
- **Show More**: Expandable section at bottom of each category (currencies/crypto/gold)
- **Multi-price Display**: Dropdown menu (3-dot button) for currencies with variants
- **Scope**: Any currency with multiple prices should show the 3-dot menu

---

## 📊 Current State Analysis

### What's Currently Displayed:
**Currencies**: USD (sell only), EUR, GBP, CAD, AUD
**Crypto**: USDT, BTC, ETH
**Gold**: Sekkeh, Bahar, Nim, Rob, Gerami, 18 Ayar

### What's Available but NOT Displayed:

**Dollar Variants**:
- `usd_buy` - Buy price
- `dolar_harat_sell` - Harat exchange sell
- `harat_naghdi_sell` - Harat cash sell
- `harat_naghdi_buy` - Harat cash buy
- `usd_farda_sell` - Tomorrow sell
- `usd_farda_buy` - Tomorrow buy
- `usd_shakhs` - Personal rate
- `usd_sherkat` - Company rate
- `usd_pp` - PayPal rate

**Other Currency Variants**:
- EUR: `eur_hav` (Hawala)
- GBP: `gbp_hav`, `gbp_wht`
- CAD: `cad_hav`, `cad_cash`, `hav_cad_my`, `hav_cad_cheque`, `hav_cad_cash`
- AUD: `aud_hav`, `aud_wht`

**Additional Currencies** (for Show More):
- AED (UAE Dirham) - **requested for main display**
- CNY (Chinese Yuan) - **requested for main display**
- TRY (Turkish Lira) - **requested for main display**
- CHF (Swiss Franc)
- JPY (Japanese Yen)
- RUB (Russian Ruble)
- INR (Indian Rupee)
- PKR (Pakistani Rupee)
- IQD (Iraqi Dinar)
- And many more available from API...

**Additional Crypto**:
- SOL, ADA, DOGE, XRP, BNB, MATIC, etc.

**Additional Gold**:
- `abshodeh` (melted gold)

---

## 🔧 Phase 1: Backend Changes

### Step 1.1: Add New Main Currencies (AED, CNY, TRY)

**File**: `apps/backend/src/navasan/navasan.service.ts` (line ~37)

**Current code**:
```typescript
private readonly items = {
  currencies: ['usd_sell', 'eur', 'gbp', 'cad', 'aud'],
  crypto: ['usdt', 'btc', 'eth'],
  gold: ['sekkeh', 'bahar', 'nim', 'rob', 'gerami', '18ayar'],
};
```

**Change to**:
```typescript
private readonly items = {
  currencies: ['usd_sell', 'eur', 'gbp', 'cad', 'aud', 'aed', 'cny', 'try'],
  crypto: ['usdt', 'btc', 'eth'],
  gold: ['sekkeh', 'bahar', 'nim', 'rob', 'gerami', '18ayar'],
};
```

**Verification**: After implementing, check that backend fetches these currencies from Navasan API.

---

### Step 1.2: Add Currency Variants (for dropdown menu)

**File**: `apps/backend/src/navasan/navasan.service.ts` (line ~37)

**Add all variant codes**:
```typescript
private readonly items = {
  currencies: [
    // Main currencies
    'usd_sell', 'eur', 'gbp', 'cad', 'aud', 'aed', 'cny', 'try',

    // USD variants
    'usd_buy', 'dolar_harat_sell', 'harat_naghdi_sell', 'harat_naghdi_buy',
    'usd_farda_sell', 'usd_farda_buy', 'usd_shakhs', 'usd_sherkat', 'usd_pp',

    // EUR variants
    'eur_hav',

    // GBP variants
    'gbp_hav', 'gbp_wht',

    // CAD variants
    'cad_hav', 'cad_cash', 'hav_cad_my', 'hav_cad_cheque', 'hav_cad_cash',

    // AUD variants
    'aud_hav', 'aud_wht',
  ],
  crypto: ['usdt', 'btc', 'eth'],
  gold: ['sekkeh', 'bahar', 'nim', 'rob', 'gerami', '18ayar'],
};
```

---

### Step 1.3: Add Additional Currencies (for Show More)

**File**: `apps/backend/src/navasan/navasan.service.ts`

**Research needed**: First, check which currency codes are actually available in the Navasan API response. You can:
1. Check the API response structure
2. Look at Navasan API documentation
3. Make a test API call and log all available keys

**Example additional currencies to add** (verify these codes with API):
```typescript
// Additional currencies (add to the currencies array)
'chf', 'jpy', 'rub', 'inr', 'pkr', 'iqd', 'kwd', 'sar', 'qar', 'omr', 'bhd'
```

**For crypto** (verify codes):
```typescript
crypto: [
  'usdt', 'btc', 'eth',
  // Additional crypto
  'bnb', 'xrp', 'ada', 'doge', 'sol', 'matic', 'dot', 'ltc', 'trx', 'avax'
],
```

**For gold**:
```typescript
gold: ['sekkeh', 'bahar', 'nim', 'rob', 'gerami', '18ayar', 'abshodeh'],
```

---

### Step 1.4: Update Chart Service Mappings

**File**: `apps/backend/src/chart/chart.service.ts`

**Add to `itemCodeMap`** (around line 15):
```typescript
private readonly itemCodeMap: Record<string, string> = {
  // Existing mappings...
  usd: 'usd_sell',
  eur: 'eur',
  // ... existing entries ...

  // NEW: Add mappings for new currencies
  aed: 'aed',
  cny: 'cny',
  try: 'try',

  // NEW: Add mappings for variants (use main code on frontend, map to specific API code)
  usd_buy: 'usd_buy',
  usd_harat: 'dolar_harat_sell',
  // ... add more as needed
};
```

**Add to `itemCategoryMap`**:
```typescript
private readonly itemCategoryMap: Record<string, ItemCategory> = {
  // Existing...
  usd_sell: 'currencies',

  // NEW
  aed: 'currencies',
  cny: 'currencies',
  try: 'currencies',
  usd_buy: 'currencies',
  // ... etc
};
```

**Testing**: After backend changes, verify:
```bash
# Start backend in dev mode
cd apps/backend
npm run dev

# Check API response at http://localhost:3001/api/navasan/latest
# Verify new currencies and variants are in the response
```

---

## 🎨 Phase 2: Frontend Data Layer

### Step 2.1: Add Currency Definitions

**File**: `apps/frontend/src/lib/dataItemHelpers.ts` (around line 8)

**Add new currency definitions**:
```typescript
export const currencyItems: DataItemDefinition[] = [
  // Existing currencies...
  {
    code: 'usd',
    apiCode: 'usd_sell',
    icon: DollarIcon,
    category: 'currencies',
  },
  // ... existing items ...

  // NEW: Main display currencies
  {
    code: 'aed',
    apiCode: 'aed',
    icon: EmiratiDirhamIcon, // You'll need to add this icon
    category: 'currencies',
  },
  {
    code: 'cny',
    apiCode: 'cny',
    icon: YuanIcon, // You'll need to add this icon
    category: 'currencies',
  },
  {
    code: 'try',
    apiCode: 'try',
    icon: TurkishLiraIcon, // You'll need to add this icon
    category: 'currencies',
  },
];
```

**Note**: You'll need to add icon components for AED, CNY, TRY. Check if they exist in `apps/frontend/src/components/icons/` or create them.

---

### Step 2.2: Add Currency Variant Definitions

**File**: `apps/frontend/src/lib/dataItemHelpers.ts`

**Create a new structure for variants**:
```typescript
export interface CurrencyVariant {
  code: string;
  apiCode: string;
  parentCode: string; // e.g., 'usd' for all dollar variants
  variantType: 'buy' | 'sell' | 'harat' | 'tomorrow' | 'special' | 'hawala';
  displayOrder: number;
}

export const currencyVariants: CurrencyVariant[] = [
  // USD variants
  {
    code: 'usd_buy',
    apiCode: 'usd_buy',
    parentCode: 'usd',
    variantType: 'buy',
    displayOrder: 1,
  },
  {
    code: 'usd_harat_sell',
    apiCode: 'dolar_harat_sell',
    parentCode: 'usd',
    variantType: 'harat',
    displayOrder: 2,
  },
  {
    code: 'usd_harat_cash_sell',
    apiCode: 'harat_naghdi_sell',
    parentCode: 'usd',
    variantType: 'harat',
    displayOrder: 3,
  },
  {
    code: 'usd_harat_cash_buy',
    apiCode: 'harat_naghdi_buy',
    parentCode: 'usd',
    variantType: 'harat',
    displayOrder: 4,
  },
  {
    code: 'usd_tomorrow_sell',
    apiCode: 'usd_farda_sell',
    parentCode: 'usd',
    variantType: 'tomorrow',
    displayOrder: 5,
  },
  {
    code: 'usd_tomorrow_buy',
    apiCode: 'usd_farda_buy',
    parentCode: 'usd',
    variantType: 'tomorrow',
    displayOrder: 6,
  },
  {
    code: 'usd_personal',
    apiCode: 'usd_shakhs',
    parentCode: 'usd',
    variantType: 'special',
    displayOrder: 7,
  },
  {
    code: 'usd_company',
    apiCode: 'usd_sherkat',
    parentCode: 'usd',
    variantType: 'special',
    displayOrder: 8,
  },
  {
    code: 'usd_paypal',
    apiCode: 'usd_pp',
    parentCode: 'usd',
    variantType: 'special',
    displayOrder: 9,
  },

  // EUR variants
  {
    code: 'eur_hawala',
    apiCode: 'eur_hav',
    parentCode: 'eur',
    variantType: 'hawala',
    displayOrder: 1,
  },

  // GBP variants
  {
    code: 'gbp_hawala',
    apiCode: 'gbp_hav',
    parentCode: 'gbp',
    variantType: 'hawala',
    displayOrder: 1,
  },
  {
    code: 'gbp_wholesale',
    apiCode: 'gbp_wht',
    parentCode: 'gbp',
    variantType: 'special',
    displayOrder: 2,
  },

  // CAD variants
  {
    code: 'cad_hawala',
    apiCode: 'cad_hav',
    parentCode: 'cad',
    variantType: 'hawala',
    displayOrder: 1,
  },
  {
    code: 'cad_cash',
    apiCode: 'cad_cash',
    parentCode: 'cad',
    variantType: 'special',
    displayOrder: 2,
  },
  // Add more CAD variants...

  // AUD variants
  {
    code: 'aud_hawala',
    apiCode: 'aud_hav',
    parentCode: 'aud',
    variantType: 'hawala',
    displayOrder: 1,
  },
  {
    code: 'aud_wholesale',
    apiCode: 'aud_wht',
    parentCode: 'aud',
    variantType: 'special',
    displayOrder: 2,
  },
];
```

---

### Step 2.3: Create Helper Functions for Variants

**File**: `apps/frontend/src/lib/dataItemHelpers.ts`

**Add these utility functions**:
```typescript
/**
 * Get all variants for a given currency code
 */
export function getVariantsForCurrency(currencyCode: string): CurrencyVariant[] {
  return currencyVariants
    .filter(variant => variant.parentCode === currencyCode)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Check if a currency has variants
 */
export function hasVariants(currencyCode: string): boolean {
  return currencyVariants.some(variant => variant.parentCode === currencyCode);
}

/**
 * Get variant display data from API data
 */
export function getVariantData(
  variant: CurrencyVariant,
  apiData: Record<string, any>
) {
  const data = apiData[variant.apiCode];
  if (!data) return null;

  return {
    code: variant.code,
    apiCode: variant.apiCode,
    variantType: variant.variantType,
    value: data.value,
    change: data.change,
  };
}
```

---

### Step 2.4: Define "Show More" Currency Lists

**File**: `apps/frontend/src/lib/dataItemHelpers.ts`

**Add configuration for which items show by default vs in "show more"**:
```typescript
export const mainCurrencies = [
  'usd', 'eur', 'gbp', 'cad', 'aud', 'aed', 'cny', 'try'
];

export const additionalCurrencies = [
  'chf', 'jpy', 'rub', 'inr', 'pkr', 'iqd', 'kwd', 'sar', 'qar', 'omr', 'bhd'
  // Add more as available from API
];

export const mainCrypto = ['usdt', 'btc', 'eth'];

export const additionalCrypto = [
  'bnb', 'xrp', 'ada', 'doge', 'sol', 'matic', 'dot', 'ltc'
];

export const mainGold = ['sekkeh', 'bahar', 'nim', 'rob', 'gerami', '18ayar'];

export const additionalGold = ['abshodeh'];

/**
 * Split items into main and additional for a category
 */
export function splitItemsByVisibility(
  category: 'currencies' | 'crypto' | 'gold',
  allItems: DataItem[]
) {
  const mainList = category === 'currencies' ? mainCurrencies :
                   category === 'crypto' ? mainCrypto : mainGold;

  const additionalList = category === 'currencies' ? additionalCurrencies :
                         category === 'crypto' ? additionalCrypto : additionalGold;

  const main = allItems.filter(item => mainList.includes(item.code));
  const additional = allItems.filter(item => additionalList.includes(item.code));

  return { main, additional };
}
```

---

### Step 2.5: Update Translations

**Files**:
- `apps/frontend/src/locales/fa.json`
- `apps/frontend/src/locales/en.json`
- `apps/frontend/src/locales/ar.json`

**Add to each file**:

**Persian (fa.json)**:
```json
{
  "currencies": {
    "aed": "درهم امارات",
    "cny": "یوان چین",
    "try": "لیر ترکیه",
    "chf": "فرانک سوئیس",
    "jpy": "ین ژاپن",
    "rub": "روبل روسیه",
    "inr": "روپیه هند",
    "pkr": "روپیه پاکستان",
    "iqd": "دینار عراق"
  },
  "currencyVariants": {
    "usd_buy": "دلار - خرید",
    "usd_harat_sell": "دلار حراج - فروش",
    "usd_harat_cash_sell": "دلار حراج نقدی - فروش",
    "usd_harat_cash_buy": "دلار حراج نقدی - خرید",
    "usd_tomorrow_sell": "دلار فردا - فروش",
    "usd_tomorrow_buy": "دلار فردا - خرید",
    "usd_personal": "دلار شخص",
    "usd_company": "دلار شرکت",
    "usd_paypal": "دلار پی‌پال",
    "eur_hawala": "یورو حواله",
    "gbp_hawala": "پوند حواله",
    "gbp_wholesale": "پوند عمده",
    "cad_hawala": "دلار کانادا حواله",
    "aud_hawala": "دلار استرالیا حواله"
  },
  "ui": {
    "showMore": "نمایش بیشتر",
    "showLess": "نمایش کمتر",
    "showMoreItems": "نمایش {{count}} مورد بیشتر",
    "variants": "نرخ‌های مختلف",
    "buyPrice": "قیمت خرید",
    "sellPrice": "قیمت فروش"
  }
}
```

**English (en.json)**:
```json
{
  "currencies": {
    "aed": "UAE Dirham",
    "cny": "Chinese Yuan",
    "try": "Turkish Lira",
    "chf": "Swiss Franc",
    "jpy": "Japanese Yen",
    "rub": "Russian Ruble",
    "inr": "Indian Rupee",
    "pkr": "Pakistani Rupee",
    "iqd": "Iraqi Dinar"
  },
  "currencyVariants": {
    "usd_buy": "Dollar - Buy",
    "usd_harat_sell": "Dollar Harat - Sell",
    "usd_harat_cash_sell": "Dollar Harat Cash - Sell",
    "usd_harat_cash_buy": "Dollar Harat Cash - Buy",
    "usd_tomorrow_sell": "Dollar Tomorrow - Sell",
    "usd_tomorrow_buy": "Dollar Tomorrow - Buy",
    "usd_personal": "Dollar Personal",
    "usd_company": "Dollar Company",
    "usd_paypal": "Dollar PayPal",
    "eur_hawala": "Euro Hawala",
    "gbp_hawala": "Pound Hawala",
    "gbp_wholesale": "Pound Wholesale",
    "cad_hawala": "CAD Hawala",
    "aud_hawala": "AUD Hawala"
  },
  "ui": {
    "showMore": "Show More",
    "showLess": "Show Less",
    "showMoreItems": "Show {{count}} more",
    "variants": "Price Variants",
    "buyPrice": "Buy Price",
    "sellPrice": "Sell Price"
  }
}
```

**Arabic (ar.json)**: Similar structure with Arabic translations.

---

## 🎨 Phase 3: Frontend UI Components

### Step 3.1: Create Currency Variants Dropdown Component

**File**: `apps/frontend/src/components/CurrencyVariantsDropdown.tsx` (NEW)

**Create this component**:
```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MoreVertical } from 'lucide-react';
import type { CurrencyVariant } from '@/lib/dataItemHelpers';
import { formatPrice, formatChange } from '@/lib/utils';

interface VariantData {
  code: string;
  variantType: string;
  value: string;
  change: number;
}

interface CurrencyVariantsDropdownProps {
  currencyCode: string;
  variants: VariantData[];
}

export default function CurrencyVariantsDropdown({
  currencyCode,
  variants,
}: CurrencyVariantsDropdownProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={t('ui.variants')}
      >
        <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="py-1">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('ui.variants')}
              </p>
            </div>

            {variants.map((variant) => (
              <div
                key={variant.code}
                className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t(`currencyVariants.${variant.code}`)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatPrice(variant.value)}
                    </span>
                    <span
                      className={`text-xs ${
                        variant.change >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {variant.change >= 0 ? '+' : ''}
                      {formatChange(variant.change)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Step 3.2: Create Show More Button Component

**File**: `apps/frontend/src/components/ShowMoreButton.tsx` (NEW)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ShowMoreButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  itemCount: number;
}

export default function ShowMoreButton({
  isExpanded,
  onToggle,
  itemCount,
}: ShowMoreButtonProps) {
  const t = useTranslations();

  return (
    <button
      onClick={onToggle}
      className="w-full mt-4 py-3 px-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {isExpanded
          ? t('ui.showLess')
          : t('ui.showMoreItems', { count: itemCount })}
      </span>
      {isExpanded ? (
        <ChevronUp className="w-4 h-4" />
      ) : (
        <ChevronDown className="w-4 h-4" />
      )}
    </button>
  );
}
```

---

### Step 3.3: Modify ItemCard to Support Variants

**File**: `apps/frontend/src/components/ItemCard/index.tsx`

**Add variants prop and conditional rendering**:

1. Update the component props:
```typescript
interface ItemCardProps {
  // ... existing props
  variants?: VariantData[];  // NEW
  hasVariants?: boolean;      // NEW
}
```

2. Import the dropdown component:
```typescript
import CurrencyVariantsDropdown from '../CurrencyVariantsDropdown';
```

3. Add the 3-dot button next to the chart button:
```typescript
// Inside the component, find where the chart button is rendered
// Add this conditional rendering:

<div className="flex items-center gap-1">
  {/* Existing chart button */}
  <button onClick={handleChartClick}>
    {/* ... existing chart button code */}
  </button>

  {/* NEW: Variants dropdown */}
  {hasVariants && variants && variants.length > 0 && (
    <CurrencyVariantsDropdown
      currencyCode={item.code}
      variants={variants}
    />
  )}
</div>
```

---

### Step 3.4: Create Expandable Section Wrapper

**File**: `apps/frontend/src/components/ExpandableSection.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ShowMoreButton from './ShowMoreButton';

interface ExpandableSectionProps {
  mainContent: React.ReactNode;
  additionalContent: React.ReactNode;
  additionalItemCount: number;
}

export default function ExpandableSection({
  mainContent,
  additionalContent,
  additionalItemCount,
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (additionalItemCount === 0) {
    return <>{mainContent}</>;
  }

  return (
    <div>
      {mainContent}

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {additionalContent}
          </motion.div>
        )}
      </AnimatePresence>

      <ShowMoreButton
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        itemCount={additionalItemCount}
      />
    </div>
  );
}
```

---

### Step 3.5: Update DataSection Component

**File**: `apps/frontend/src/components/DataSection.tsx` or create wrapper

**Modify to use ExpandableSection**:

```typescript
import ExpandableSection from './ExpandableSection';
import ItemCardGrid from './ItemCardGrid';
import { splitItemsByVisibility, getVariantsForCurrency, hasVariants, getVariantData } from '@/lib/dataItemHelpers';

// Inside the component:

const { main: mainItems, additional: additionalItems } = splitItemsByVisibility(
  category,
  allItems
);

// Render with expandable section:
<ExpandableSection
  mainContent={
    <ItemCardGrid>
      {mainItems.map(item => {
        const itemHasVariants = hasVariants(item.code);
        const variants = itemHasVariants
          ? getVariantsForCurrency(item.code).map(v => getVariantData(v, apiData)).filter(Boolean)
          : undefined;

        return (
          <ItemCard
            key={item.code}
            item={item}
            hasVariants={itemHasVariants}
            variants={variants}
            // ... other props
          />
        );
      })}
    </ItemCardGrid>
  }
  additionalContent={
    <ItemCardGrid>
      {additionalItems.map(item => (
        <ItemCard
          key={item.code}
          item={item}
          // ... props
        />
      ))}
    </ItemCardGrid>
  }
  additionalItemCount={additionalItems.length}
/>
```

---

### Step 3.6: Add Currency Icons

**File**: `apps/frontend/src/components/icons/` (check existing structure)

**You need to add icons for**:
- `AED.tsx` - UAE Dirham icon
- `CNY.tsx` - Chinese Yuan icon
- `TRY.tsx` - Turkish Lira icon

**Example icon component**:
```typescript
export default function AEDIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* SVG path for AED icon */}
      {/* You can find flag icons or currency symbols online */}
    </svg>
  );
}
```

**Alternative**: Use a library like `lucide-react` or `react-icons` if they have these currency icons.

---

## 🧪 Phase 4: Testing & Verification

### Step 4.1: Backend Testing

**Test commands**:
```bash
# 1. Start backend
cd apps/backend
npm run dev

# 2. Test API endpoint
curl http://localhost:3001/api/navasan/latest

# 3. Verify response includes:
# - aed, cny, try in currencies
# - All variant codes (usd_buy, dolar_harat_sell, etc.)
# - Additional currencies for show more
```

**Checklist**:
- [ ] AED, CNY, TRY appear in API response
- [ ] All USD variants present (usd_buy, dolar_harat_sell, etc.)
- [ ] EUR, GBP, CAD, AUD variants present
- [ ] Additional currencies present
- [ ] Caching works correctly
- [ ] No errors in backend logs

---

### Step 4.2: Frontend Testing

**Test in browser**:
```bash
cd apps/frontend
npm run dev
```

**Manual testing checklist**:

**Main Display**:
- [ ] AED appears in currencies section
- [ ] CNY appears in currencies section
- [ ] TRY appears in currencies section
- [ ] Icons display correctly
- [ ] Prices display correctly
- [ ] Changes display correctly

**Variants Dropdown**:
- [ ] 3-dot button appears on USD
- [ ] Clicking 3-dot opens dropdown
- [ ] All USD variants show in dropdown
- [ ] Variant names translated correctly
- [ ] Variant prices and changes display
- [ ] Dropdown closes when clicking outside
- [ ] 3-dot appears on other currencies with variants (EUR, GBP, etc.)

**Show More**:
- [ ] "Show More" button appears at bottom of currencies section
- [ ] Shows correct count (e.g., "Show 10 more")
- [ ] Clicking expands section smoothly
- [ ] Additional currencies display correctly
- [ ] Button changes to "Show Less"
- [ ] Clicking collapses section smoothly
- [ ] Works for crypto section
- [ ] Works for gold section

**Responsive Design**:
- [ ] Works on mobile (viewport < 640px)
- [ ] Works on tablet (viewport 640-1024px)
- [ ] Works on desktop (viewport > 1024px)
- [ ] Dropdown doesn't overflow screen
- [ ] Expand/collapse animation smooth

**Translations**:
- [ ] Switch to English - all labels correct
- [ ] Switch to Arabic - all labels correct
- [ ] Switch to Persian - all labels correct
- [ ] Currency names translated
- [ ] Variant names translated
- [ ] UI elements translated

**Chart Integration**:
- [ ] Chart still opens for main currencies
- [ ] Chart still opens for variants (if applicable)
- [ ] No conflicts between chart and dropdown buttons

---

### Step 4.3: Performance Testing

**Check**:
- [ ] Page load time acceptable
- [ ] No layout shift when expanding/collapsing
- [ ] Animations run at 60fps
- [ ] Bundle size increase acceptable
- [ ] No memory leaks (check with DevTools)

**Tools**:
```bash
# Check bundle size
npm run build
# Look for size warnings

# Run Lighthouse audit
# In Chrome DevTools > Lighthouse
```

---

## 📝 Implementation Checklist

Use this as your step-by-step guide:

### Backend
- [ ] Step 1.1: Add AED, CNY, TRY to currencies array
- [ ] Step 1.2: Add all variant codes to currencies array
- [ ] Step 1.3: Add additional currencies for show more
- [ ] Step 1.4: Update chart service mappings
- [ ] Test backend API response

### Frontend - Data Layer
- [ ] Step 2.1: Add AED, CNY, TRY definitions to dataItemHelpers
- [ ] Step 2.2: Add variant definitions
- [ ] Step 2.3: Add helper functions for variants
- [ ] Step 2.4: Define main vs additional currency lists
- [ ] Step 2.5: Add all translations (FA, EN, AR)
- [ ] Step 3.6: Add currency icons for AED, CNY, TRY

### Frontend - UI Components
- [ ] Step 3.1: Create CurrencyVariantsDropdown component
- [ ] Step 3.2: Create ShowMoreButton component
- [ ] Step 3.3: Modify ItemCard to support variants
- [ ] Step 3.4: Create ExpandableSection wrapper
- [ ] Step 3.5: Update DataSection to use ExpandableSection

### Testing
- [ ] Step 4.1: Backend testing
- [ ] Step 4.2: Frontend testing (all checklist items)
- [ ] Step 4.3: Performance testing

---

## 🎯 Implementation Sessions

### Session 1: Backend Foundation (30-45 min)
Ask for help with:
```
Let's implement Phase 1: Backend Changes
- Add AED, CNY, TRY to the currencies list
- Add all currency variants
- Add additional currencies for show more
- Update chart service mappings
```

### Session 2: Data Layer & Translations (45-60 min)
Ask for help with:
```
Let's implement Phase 2: Frontend Data Layer
- Add currency definitions for new currencies
- Create variant definitions and helper functions
- Define main vs additional lists
- Add all translations
```

### Session 3: UI Components (60-90 min)
Ask for help with:
```
Let's implement Phase 3: Frontend UI Components
- Create the variants dropdown component
- Create the show more button
- Modify ItemCard to support variants
- Create expandable section wrapper
- Integrate everything
```

### Session 4: Testing & Polish (30-45 min)
Ask for help with:
```
Let's test everything and fix any issues:
- Test all functionality
- Fix any bugs
- Optimize performance
- Final polish
```

---

## 🚨 Common Issues & Solutions

### Issue: Icons not found for AED, CNY, TRY
**Solution**:
1. Check if icons exist in `apps/frontend/src/components/icons/`
2. If not, create simple SVG icons or use existing ones as templates
3. Alternative: Use generic currency icon temporarily

### Issue: Variant codes don't match API
**Solution**:
1. Make a test API call to Navasan
2. Log all available keys in the response
3. Update variant apiCode values to match exactly

### Issue: Dropdown positioning issues on mobile
**Solution**:
1. Add responsive positioning classes
2. Use `right-0` for LTR, `left-0` for RTL
3. Add max-width constraint
4. Consider using a modal on small screens

### Issue: Translations not showing
**Solution**:
1. Check translation key paths match exactly
2. Verify translation files are valid JSON
3. Clear Next.js cache: `rm -rf .next`
4. Restart dev server

### Issue: Show more animation janky
**Solution**:
1. Ensure framer-motion is installed
2. Use `height: auto` with `overflow: hidden`
3. Add `will-change: height` for GPU acceleration
4. Test with fewer items if performance poor

---

## 📚 Additional Resources

- **Navasan API**: Check API documentation for all available currency codes
- **Framer Motion**: https://www.framer.com/motion/ (for animations)
- **Lucide Icons**: https://lucide.dev/ (for icons)
- **Next.js i18n**: For translation best practices

---

## ✅ Definition of Done

This feature is complete when:
1. ✅ AED, CNY, TRY appear in main currency display
2. ✅ All currencies with variants show 3-dot button
3. ✅ Clicking 3-dot shows dropdown with all variants
4. ✅ "Show More" button shows additional currencies
5. ✅ Expanding shows all API currencies not in main display
6. ✅ All three languages (FA, EN, AR) work correctly
7. ✅ Responsive on mobile, tablet, desktop
8. ✅ No performance degradation
9. ✅ No console errors or warnings
10. ✅ Code follows existing patterns and style

---

**Ready to start? Begin with Session 1!**
