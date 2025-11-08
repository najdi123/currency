# Multi-Language Implementation Guide for Currency Exchange App

## Overview

This guide outlines how to implement internationalization (i18n) in the Next.js App Router frontend to support English, Arabic, and Farsi languages.

---

## Two Main Approaches

### 1. Native Next.js Approach (Manual Implementation)

#### Project Structure
```
apps/frontend/
├── src/
│   ├── app/
│   │   └── [lang]/              # Dynamic locale segment
│   │       ├── layout.tsx       # Root layout for all locales
│   │       ├── page.tsx         # Home page
│   │       ├── wallet/
│   │       ├── settings/
│   │       ├── admin/
│   │       └── login/
│   ├── middleware.ts            # Locale detection & redirect
│   └── dictionaries/
│       ├── en.json              # English translations
│       ├── ar.json              # Arabic translations
│       └── fa.json              # Farsi translations
```

#### Implementation Steps

##### Step 1: Restructure Routes
Move all pages under `app/[lang]/` folder so every route receives the locale as a parameter:
- Current: `app/page.tsx` → New: `app/[lang]/page.tsx`
- Current: `app/wallet/page.tsx` → New: `app/[lang]/wallet/page.tsx`
- And so on for all routes...

##### Step 2: Create Translation Dictionaries

Create `src/dictionaries/` folder with JSON files:

**en.json:**
```json
{
  "PageHeader": {
    "title": "Currency Exchange",
    "subtitle": "Real-time rates"
  },
  "DataSection": {
    "currencies": "Currencies",
    "digital": "Digital Currencies",
    "gold": "Gold"
  },
  "common": {
    "loading": "Loading...",
    "error": "Error occurred"
  }
}
```

**ar.json:**
```json
{
  "PageHeader": {
    "title": "صرف العملات",
    "subtitle": "أسعار في الوقت الفعلي"
  },
  "DataSection": {
    "currencies": "العملات",
    "digital": "العملات الرقمية",
    "gold": "ذهب"
  },
  "common": {
    "loading": "جار التحميل...",
    "error": "حدث خطأ"
  }
}
```

**fa.json:**
```json
{
  "PageHeader": {
    "title": "صرافی ارز",
    "subtitle": "نرخ‌های لحظه‌ای"
  },
  "DataSection": {
    "currencies": "ارزها",
    "digital": "ارزهای دیجیتال",
    "gold": "طلا"
  },
  "common": {
    "loading": "در حال بارگذاری...",
    "error": "خطا رخ داده است"
  }
}
```

##### Step 3: Create Dictionary Loader

**src/lib/dictionaries.ts:**
```typescript
import 'server-only';

const dictionaries = {
  en: () => import('@/dictionaries/en.json').then((module) => module.default),
  ar: () => import('@/dictionaries/ar.json').then((module) => module.default),
  fa: () => import('@/dictionaries/fa.json').then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;

export const getDictionary = async (locale: Locale) => dictionaries[locale]();
```

##### Step 4: Create Middleware for Locale Detection

**src/middleware.ts:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Negotiator from 'negotiator';
import { match } from '@formatjs/intl-localematcher';

const locales = ['en', 'ar', 'fa'];
const defaultLocale = 'en';

function getLocale(request: NextRequest): string {
  const negotiatorHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value));

  const languages = new Negotiator({ headers: negotiatorHeaders }).languages();
  return match(languages, locales, defaultLocale);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if there is any supported locale in the pathname
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);
    return NextResponse.redirect(
      new URL(`/${locale}${pathname}`, request.url)
    );
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

##### Step 5: Update Root Layout

**app/[lang]/layout.tsx:**
```typescript
import { Locale } from '@/lib/dictionaries';

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const direction = lang === 'ar' || lang === 'fa' ? 'rtl' : 'ltr';

  return (
    <html lang={lang} dir={direction}>
      <body>{children}</body>
    </html>
  );
}
```

##### Step 6: Use Translations in Components

**app/[lang]/page.tsx:**
```typescript
import { getDictionary, Locale } from '@/lib/dictionaries';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div>
      <h1>{dict.PageHeader.title}</h1>
      <p>{dict.PageHeader.subtitle}</p>
    </div>
  );
}
```

##### Step 7: Generate Static Params

```typescript
export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'fa' }];
}
```

#### Required Dependencies
```bash
npm install negotiator @formatjs/intl-localematcher
npm install -D @types/negotiator
npm install server-only
```

---

### 2. Library Approach (Recommended: `next-intl`)

This is the **recommended approach** due to less boilerplate, better TypeScript support, and easier maintenance.

#### Project Structure
```
apps/frontend/
├── messages/
│   ├── en.json
│   ├── ar.json
│   └── fa.json
├── src/
│   ├── i18n/
│   │   └── request.ts          # i18n configuration
│   ├── middleware.ts           # Locale routing
│   └── app/
│       └── [locale]/           # Dynamic locale segment
│           ├── layout.tsx
│           ├── page.tsx
│           └── ...all routes
└── next.config.ts              # Add next-intl plugin
```

#### Implementation Steps

##### Step 1: Install next-intl
```bash
npm install next-intl
```

##### Step 2: Create Translation Files

Create `messages/` folder in project root:

**messages/en.json:**
```json
{
  "PageHeader": {
    "title": "Currency Exchange",
    "subtitle": "Real-time rates"
  },
  "DataSection": {
    "currencies": "Currencies",
    "digitalCurrencies": "Digital Currencies",
    "gold": "Gold"
  },
  "Wallet": {
    "title": "My Wallet",
    "balance": "Balance",
    "addFunds": "Add Funds"
  },
  "Settings": {
    "title": "Settings",
    "profile": "Profile",
    "changePassword": "Change Password",
    "language": "Language"
  },
  "Auth": {
    "login": "Login",
    "logout": "Logout",
    "username": "Username",
    "password": "Password"
  },
  "common": {
    "loading": "Loading...",
    "error": "Error occurred",
    "save": "Save",
    "cancel": "Cancel",
    "submit": "Submit"
  }
}
```

**messages/ar.json:** (Arabic translations)
**messages/fa.json:** (Farsi translations)

##### Step 3: Configure i18n

**src/i18n/request.ts:**
```typescript
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

// Can be imported from a shared config
export const locales = ['en', 'ar', 'fa'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) notFound();

  return {
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

##### Step 4: Setup Middleware

**src/middleware.ts:**
```typescript
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n/request';

export default createMiddleware({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale: 'en',

  // Always use prefix for locale (e.g., /en, /ar, /fa)
  localePrefix: 'always',
});

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(ar|en|fa)/:path*'],
};
```

##### Step 5: Add next-intl Plugin

**next.config.ts:**
```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing Next.js config
};

export default withNextIntl(nextConfig);
```

##### Step 6: Update Root Layout

**app/[locale]/layout.tsx:**
```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/request';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client side is the easiest way to get started
  const messages = await getMessages();

  const direction = locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

##### Step 7: Use Translations in Components

**Server Components:**
```typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('PageHeader');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </div>
  );
}
```

**Client Components:**
```typescript
'use client';

import { useTranslations } from 'next-intl';

export default function DataSection() {
  const t = useTranslations('DataSection');

  return (
    <div>
      <button>{t('currencies')}</button>
      <button>{t('digitalCurrencies')}</button>
      <button>{t('gold')}</button>
    </div>
  );
}
```

##### Step 8: Language Switcher Component

**src/components/LanguageSwitcher.tsx:**
```typescript
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    // Replace the current locale in the pathname
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <select value={locale} onChange={(e) => handleChange(e.target.value)}>
      <option value="en">English</option>
      <option value="ar">العربية</option>
      <option value="fa">فارسی</option>
    </select>
  );
}
```

---

## RTL (Right-to-Left) Support for Arabic & Farsi

### CSS Considerations

1. **Use Logical Properties** (recommended):
```css
/* Instead of margin-left, use: */
margin-inline-start: 1rem;

/* Instead of padding-right, use: */
padding-inline-end: 1rem;

/* Instead of text-align: left, use: */
text-align: start;
```

2. **Conditional Styling**:
```typescript
// In Tailwind
<div className={`${locale === 'ar' || locale === 'fa' ? 'flex-row-reverse' : 'flex-row'}`}>
```

3. **Tailwind RTL Plugin** (optional):
```bash
npm install tailwindcss-rtl
```

Add to `tailwind.config.js`:
```javascript
plugins: [require('tailwindcss-rtl')]
```

### UI Adjustments Needed

1. **Flip directional icons** (arrows, chevrons)
2. **Mirror layouts** (navigation bars, sidebars)
3. **Adjust chart/graph orientations**
4. **Test form field alignments**

---

## Recommendation

**Use the `next-intl` library approach** because:

✅ Less boilerplate code
✅ Built-in middleware handling
✅ Better TypeScript support with autocomplete
✅ Easier to maintain translations
✅ Good documentation and active community
✅ Client and Server Component support out of the box
✅ Handles locale routing automatically
✅ Type-safe translation keys

---

## Migration Checklist

When implementing i18n, you'll need to:

- [ ] Install dependencies (`next-intl` or manual approach packages)
- [ ] Create translation files for all three languages (en, ar, fa)
- [ ] Restructure `app/` folder to `app/[locale]/`
- [ ] Move all existing routes under `[locale]/` segment
- [ ] Configure middleware for locale detection
- [ ] Update root layout with `dir` attribute for RTL
- [ ] Wrap app with `NextIntlClientProvider` (if using next-intl)
- [ ] Update all hardcoded text in components to use translations
- [ ] Create language switcher component
- [ ] Test RTL layout for Arabic and Farsi
- [ ] Update Redux store actions/API calls if they contain text
- [ ] Add locale parameter to API routes if needed
- [ ] Test all routes with each locale
- [ ] Update tests to handle multiple locales

---

## Additional Resources

- Next.js i18n Docs: https://nextjs.org/docs/app/building-your-application/routing/internationalization
- next-intl Docs: https://next-intl.dev/docs/getting-started/app-router
- RTL Styling Guide: https://rtlstyling.com/
- Arabic Typography: https://fonts.google.com/?subset=arabic
- Farsi Typography: https://fonts.google.com/?subset=persian

---

## Notes

- All translation keys should be consistent across all language files
- Consider using a translation management tool for larger projects (e.g., Lokalise, Crowdin)
- Test with actual native speakers for Arabic and Farsi accuracy
- Remember that Farsi numbers are different from Arabic numbers
- Date/time formatting should also be localized
- Currency formatting may need adjustment per locale
