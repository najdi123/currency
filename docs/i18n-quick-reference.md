# i18n Quick Reference Guide

Quick reference for implementing translations while working on components.

---

## Import Patterns

### Server Components
```typescript
import { getTranslations } from 'next-intl/server';

export default async function MyServerComponent() {
  const t = await getTranslations('NamespaceName');

  return <h1>{t('keyName')}</h1>;
}
```

### Client Components
```typescript
'use client';
import { useTranslations } from 'next-intl';

export default function MyClientComponent() {
  const t = useTranslations('NamespaceName');

  return <h1>{t('keyName')}</h1>;
}
```

### Get Current Locale
```typescript
// Server Component
import { getLocale } from 'next-intl/server';

export default async function Page() {
  const locale = await getLocale();
  const isRTL = locale === 'ar' || locale === 'fa';
}

// Client Component
'use client';
import { useLocale } from 'next-intl';

export default function Component() {
  const locale = useLocale();
  const isRTL = locale === 'ar' || locale === 'fa';
}
```

---

## Common Translation Patterns

### Simple Text Replacement
```typescript
// Before
<h1>نرخ ارز و طلا</h1>

// After
const t = useTranslations('PageHeader');
<h1>{t('title')}</h1>

// In messages/en.json
{
  "PageHeader": {
    "title": "Exchange Rates & Gold"
  }
}
```

### With Variables
```typescript
// Before
<p>آخرین بروزرسانی: {time}</p>

// After
const t = useTranslations('Common');
<p>{t('lastUpdated', { time })}</p>

// In messages/en.json
{
  "Common": {
    "lastUpdated": "Last updated: {time}"
  }
}
```

### Conditional Text
```typescript
// Before
{isLoading ? 'در حال بارگذاری...' : 'بارگذاری'}

// After
const t = useTranslations('Common');
{isLoading ? t('loading') : t('load')}
```

### ARIA Labels
```typescript
// Before
<button aria-label="بستن">

// After
const t = useTranslations('Common');
<button aria-label={t('close')}>
```

### Button Text with State
```typescript
// Before
<button>
  {isRefreshing ? 'در حال بروزرسانی...' : 'بروزرسانی'}
</button>

// After
const t = useTranslations('Actions');
<button>
  {isRefreshing ? t('refreshing') : t('refresh')}
</button>
```

---

## Date & Time Formatting

### Locale-Aware Date
```typescript
// Before
const dateStr = date.toLocaleDateString('fa-IR');

// After
import { useLocale } from 'next-intl';
const locale = useLocale();
const dateStr = date.toLocaleDateString(locale);
```

### Locale-Aware Time
```typescript
// Before
const timeStr = date.toLocaleTimeString('fa-IR');

// After
import { useLocale } from 'next-intl';
const locale = useLocale();
const timeStr = date.toLocaleTimeString(locale, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});
```

### Custom Date Formatting
```typescript
import { useLocale } from 'next-intl';

const locale = useLocale();
const formatted = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}).format(date);
```

---

## Number Formatting

### Basic Number
```typescript
import { useLocale } from 'next-intl';

const locale = useLocale();
const formatted = new Intl.NumberFormat(locale).format(number);
```

### Currency
```typescript
import { useLocale } from 'next-intl';

const locale = useLocale();
const formatted = new Intl.NumberFormat(locale, {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(price);
```

### Percentage
```typescript
import { useLocale } from 'next-intl';

const locale = useLocale();
const formatted = new Intl.NumberFormat(locale, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
}).format(percentage / 100);
```

---

## RTL/LTR Handling

### Conditional Direction Class
```typescript
const locale = useLocale();
const isRTL = locale === 'ar' || locale === 'fa';

<div className={isRTL ? 'flex-row-reverse' : 'flex-row'}>
```

### Conditional Margin
```typescript
const locale = useLocale();
const isRTL = locale === 'ar' || locale === 'fa';

<div className={isRTL ? 'mr-4' : 'ml-4'}>
```

### Use Logical Properties (Recommended)
```css
/* Instead of margin-left */
margin-inline-start: 1rem;

/* Instead of margin-right */
margin-inline-end: 1rem;

/* Instead of padding-left */
padding-inline-start: 1rem;

/* Instead of text-align: left */
text-align: start;
```

### Tailwind Logical Classes
```typescript
// Use these instead of ml-4, mr-4, etc.
<div className="ms-4"> {/* margin-inline-start */}
<div className="me-4"> {/* margin-inline-end */}
<div className="ps-4"> {/* padding-inline-start */}
<div className="pe-4"> {/* padding-inline-end */}
<div className="text-start"> {/* instead of text-left */}
```

---

## Navigation with Locale

### Link to Another Page
```typescript
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

const locale = useLocale();
const router = useRouter();

// Navigate within same locale
router.push(`/${locale}/settings`);
```

### Change Language
```typescript
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

const locale = useLocale();
const router = useRouter();
const pathname = usePathname();

const changeLanguage = (newLocale: string) => {
  const pathWithoutLocale = pathname.replace(`/${locale}`, '');
  router.push(`/${newLocale}${pathWithoutLocale}`);
};
```

---

## Access Params in Pages

### Page Component
```typescript
// app/[locale]/settings/page.tsx
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('Settings');

  return <h1>{t('title')}</h1>;
}
```

### Dynamic Route
```typescript
// app/[locale]/admin/users/[userId]/page.tsx
export default async function UserPage({
  params,
}: {
  params: Promise<{ locale: string; userId: string }>;
}) {
  const { locale, userId } = await params;
  const t = await getTranslations('Admin');

  return <h1>{t('userDetails')}</h1>;
}
```

---

## Translation File Structure

### Organize by Component
```json
{
  "ComponentName": {
    "title": "Title text",
    "subtitle": "Subtitle text",
    "action": "Action button"
  },
  "AnotherComponent": {
    "heading": "Heading"
  }
}
```

### Nested Translations
```json
{
  "Settings": {
    "title": "Settings",
    "account": {
      "title": "Account",
      "email": "Email",
      "password": "Password"
    },
    "appearance": {
      "title": "Appearance",
      "light": "Light",
      "dark": "Dark"
    }
  }
}
```

Access nested:
```typescript
const t = useTranslations('Settings');
<h1>{t('account.title')}</h1>
<label>{t('account.email')}</label>
```

---

## Common Namespaces

Recommended organization:

```json
{
  "Common": {},          // Shared across all components
  "Errors": {},          // All error messages
  "Notifications": {},   // Success/info messages
  "Actions": {},         // Button labels, action text
  "Navigation": {},      // Menu items, breadcrumbs
  "Forms": {},           // Form labels, placeholders
  "PageHeader": {},      // Header component
  "DataSection": {},     // Data section component
  "SettingsModal": {},   // Settings modal
  "Settings": {},        // Settings page
  "Login": {},           // Login page
  "Wallet": {},          // Wallet page
  "Admin": {},           // Admin pages
  "Chart": {},           // Chart component
  "Profile": {}          // Profile component
}
```

---

## Checklist for Each Component

When updating a component:

- [ ] Import `useTranslations` (client) or `getTranslations` (server)
- [ ] Create namespace in translation files (en, ar, fa)
- [ ] Replace all hardcoded text with `t('key')`
- [ ] Replace ARIA labels with `t('key')`
- [ ] Update date/time formatting to use locale
- [ ] Update number formatting to use locale
- [ ] Test in all three languages
- [ ] Test RTL layout (ar, fa)
- [ ] Test LTR layout (en)
- [ ] Verify no console warnings

---

## Debugging

### Check Current Locale
```typescript
console.log('Current locale:', locale);
```

### Check Translation Keys
```typescript
// See all available keys in namespace
console.log(t.raw(''));
```

### Missing Translation
If translation is missing, it will show the key:
```
Output: "PageHeader.title" (instead of translated text)
```

Check:
1. Key exists in all three translation files
2. Namespace name matches
3. No typos in key name
4. Translation files are valid JSON

---

## Quick Commands

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Type Check
```bash
npx tsc --noEmit
```

### Verify Translation Files
```bash
# Check JSON validity
node -e "console.log(JSON.parse(require('fs').readFileSync('./messages/en.json')))"
node -e "console.log(JSON.parse(require('fs').readFileSync('./messages/ar.json')))"
node -e "console.log(JSON.parse(require('fs').readFileSync('./messages/fa.json')))"
```

---

## Example: Complete Component Update

### Before
```typescript
'use client';

export default function MyComponent() {
  return (
    <div dir="rtl">
      <h1>عنوان</h1>
      <p>توضیحات</p>
      <button>ذخیره</button>
      <button>لغو</button>
      <p>آخرین بروزرسانی: {new Date().toLocaleTimeString('fa-IR')}</p>
    </div>
  );
}
```

### After
```typescript
'use client';
import { useTranslations, useLocale } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('MyComponent');
  const locale = useLocale();
  const isRTL = locale === 'ar' || locale === 'fa';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button>{t('save')}</button>
      <button>{t('cancel')}</button>
      <p>
        {t('lastUpdated', {
          time: new Date().toLocaleTimeString(locale)
        })}
      </p>
    </div>
  );
}
```

### Translation Files

**messages/en.json**
```json
{
  "MyComponent": {
    "title": "Title",
    "description": "Description",
    "save": "Save",
    "cancel": "Cancel",
    "lastUpdated": "Last updated: {time}"
  }
}
```

**messages/ar.json**
```json
{
  "MyComponent": {
    "title": "عنوان",
    "description": "وصف",
    "save": "حفظ",
    "cancel": "إلغاء",
    "lastUpdated": "آخر تحديث: {time}"
  }
}
```

**messages/fa.json**
```json
{
  "MyComponent": {
    "title": "عنوان",
    "description": "توضیحات",
    "save": "ذخیره",
    "cancel": "لغو",
    "lastUpdated": "آخرین بروزرسانی: {time}"
  }
}
```

---

## Tips

1. **Start with Common strings** - extract frequently used words first (save, cancel, close, etc.)
2. **Use meaningful namespace names** - match component file names
3. **Keep keys semantic** - use `title`, `description` not `text1`, `text2`
4. **Test frequently** - test each component as you update it
5. **Use variables** - for dynamic content, use `{variable}` in translations
6. **Consistent naming** - use same key names across components where possible
7. **ARIA matters** - don't forget to translate accessibility labels
8. **Number/Date formatting** - always use locale parameter
9. **Logical CSS** - use `start`/`end` instead of `left`/`right`
10. **Review with native speakers** - especially for Arabic translations
