# Multi-Language Implementation Plan
## Comprehensive Plan for English, Arabic, and Farsi Support

---

## Overview

This document provides a step-by-step plan to implement multi-language support (English, Arabic, Farsi) across the entire frontend application, including:
- Infrastructure setup with `next-intl`
- Translation file creation
- App Router restructuring
- Component updates
- Language selector in settings
- RTL/LTR support
- Testing and verification

**Recommended Approach**: Use `next-intl` library

---

## Phase 1: Setup & Infrastructure (Tasks 1-12)

### 1.1 Install Dependencies
```bash
npm install next-intl
```

**Files to create/modify:**
- `package.json` (automatic)

---

### 1.2 Create Folder Structure

**Create new folders:**
```
apps/frontend/
├── messages/           # NEW - Translation files
│   ├── en.json
│   ├── ar.json
│   └── fa.json
└── src/
    └── i18n/          # NEW - i18n configuration
        └── request.ts
```

---

### 1.3 Create Translation Files (messages/*.json)

**Strategy:**
1. Go through ALL components and extract hardcoded Farsi text
2. Create English translations
3. Create Arabic translations
4. Organize by component namespace

**Example structure for `messages/en.json`:**
```json
{
  "PageHeader": {
    "title": "Exchange Rates, Gold & Crypto",
    "refreshButton": "Refresh",
    "refreshing": "Refreshing...",
    "fetching": "Fetching...",
    "lastUpdated": "Last updated",
    "viewModeGrid": "Grid view",
    "viewModeList": "List view",
    "settings": "Settings"
  },
  "DataSection": {
    "currencies": "Currencies",
    "crypto": "Cryptocurrencies",
    "gold": "Gold & Coins",
    "loading": "Loading...",
    "error": "Error loading data",
    "retry": "Try again",
    "autoRefresh": "Data automatically refreshes every 5 minutes"
  },
  "SettingsModal": {
    "title": "Settings",
    "close": "Close",
    "appearance": "Appearance",
    "light": "Light",
    "dark": "Dark",
    "system": "System",
    "language": "Language",
    "account": "Account",
    "userAccount": "User Account",
    "manageAccount": "Manage Account",
    "viewWallet": "View My Wallet",
    "login": "Login",
    "loginPrompt": "Login for more features",
    "management": "Management",
    "manageUsers": "Manage Users",
    "createUser": "Create User"
  },
  "Settings": {
    "pageTitle": "Account Settings",
    "back": "Back",
    "backToHome": "Back to home",
    "editProfile": "Edit Profile",
    "changePassword": "Change Password",
    "accountInfo": "Account Information",
    "accountStatus": "Account Status",
    "active": "Active",
    "userRole": "User Role",
    "admin": "System Administrator",
    "regularUser": "Regular User",
    "joinDate": "Join Date",
    "logout": "Logout",
    "logoutConfirm": "Are you sure you want to logout?",
    "loggingOut": "Logging out...",
    "logoutPrompt": "You will need to login again to access your account"
  },
  "Wallet": {
    "title": "My Wallet",
    "balance": "Balance",
    "addFunds": "Add Funds",
    "withdraw": "Withdraw",
    "transactions": "Transaction History",
    "noTransactions": "No transactions yet"
  },
  "Login": {
    "title": "Login",
    "email": "Email",
    "password": "Password",
    "submit": "Login",
    "forgotPassword": "Forgot password?",
    "noAccount": "Don't have an account?",
    "register": "Register"
  },
  "Profile": {
    "firstName": "First Name",
    "lastName": "Last Name",
    "email": "Email",
    "save": "Save Changes",
    "cancel": "Cancel",
    "updateSuccess": "Profile updated successfully",
    "updateError": "Error updating profile"
  },
  "ChangePassword": {
    "title": "Change Password",
    "currentPassword": "Current Password",
    "newPassword": "New Password",
    "confirmPassword": "Confirm Password",
    "submit": "Change Password",
    "success": "Password changed successfully",
    "error": "Error changing password",
    "passwordMismatch": "Passwords do not match"
  },
  "Admin": {
    "users": "Users",
    "createUser": "Create New User",
    "editUser": "Edit User",
    "deleteUser": "Delete User",
    "userList": "User List",
    "userDetails": "User Details"
  },
  "Errors": {
    "generic": "An error occurred",
    "network": "Network error. Please check your connection",
    "staleData": "Data may be outdated",
    "rateLimit": "Rate limit exceeded. Using cached data",
    "retry": "Try again",
    "goBack": "Go back"
  },
  "Notifications": {
    "success": "Success!",
    "dataRefreshed": "Data refreshed successfully",
    "offline": "You are offline",
    "online": "Back online"
  },
  "Chart": {
    "title": "Price Chart",
    "timeRange": "Time Range",
    "1d": "1 Day",
    "1w": "1 Week",
    "1m": "1 Month",
    "3m": "3 Months",
    "1y": "1 Year",
    "all": "All",
    "price": "Price",
    "change": "Change",
    "high": "High",
    "low": "Low",
    "loading": "Loading chart...",
    "error": "Error loading chart",
    "noData": "No data available"
  },
  "Common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "submit": "Submit",
    "close": "Close",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "filter": "Filter",
    "yes": "Yes",
    "no": "No",
    "ok": "OK",
    "skipToContent": "Skip to main content"
  }
}
```

**messages/ar.json** - Arabic translations (RTL)
**messages/fa.json** - Farsi translations (RTL) - Use existing Farsi text as base

---

### 1.4 Create i18n Configuration

**File: `src/i18n/request.ts`**
```typescript
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

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

---

### 1.5 Create Middleware

**File: `src/middleware.ts`**
```typescript
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n/request';

export default createMiddleware({
  // List of all supported locales
  locales,

  // Default locale when browser language doesn't match
  defaultLocale: 'fa', // Keep Farsi as default since app is currently Farsi

  // Always use prefix for locale (e.g., /en, /ar, /fa)
  localePrefix: 'always',

  // Automatically detect browser language
  localeDetection: true,
});

export const config = {
  // Match all pathnames except API routes, static files, etc.
  matcher: ['/', '/(ar|en|fa)/:path*'],
};
```

---

### 1.6 Update Next.js Config

**File: `apps/frontend/next.config.ts`**
```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing config
};

export default withNextIntl(nextConfig);
```

---

## Phase 2: App Router Restructuring (Tasks 7-12)

### 2.1 Restructure App Folder

**Current structure:**
```
src/app/
├── layout.tsx
├── page.tsx
├── settings/page.tsx
├── wallet/page.tsx
├── login/page.tsx
├── admin/
│   └── users/
│       ├── page.tsx
│       ├── create/page.tsx
│       └── [userId]/page.tsx
└── dev/page.tsx
```

**New structure:**
```
src/app/
└── [locale]/              # NEW - Dynamic locale segment
    ├── layout.tsx         # Moved & updated
    ├── page.tsx           # Moved & updated
    ├── settings/page.tsx  # Moved & updated
    ├── wallet/page.tsx    # Moved & updated
    ├── login/page.tsx     # Moved & updated
    ├── admin/             # Moved
    │   └── users/
    │       ├── page.tsx
    │       ├── create/page.tsx
    │       └── [userId]/page.tsx
    └── dev/page.tsx       # Moved
```

**Action Steps:**
1. Create `app/[locale]/` folder
2. Move ALL existing routes into `[locale]/`
3. Delete old route files after confirming move

---

### 2.2 Update Root Layout

**File: `app/[locale]/layout.tsx`**

Key changes:
1. Accept `params: Promise<{ locale: string }>`
2. Wrap with `NextIntlClientProvider`
3. Set `dir` attribute dynamically for RTL/LTR
4. Make metadata locale-aware
5. Add `generateStaticParams`

```typescript
import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/request';
import StoreProvider from "@/lib/StoreProvider";
import { OfflineBannerWrapper } from "@/components/OfflineBannerWrapper";
import { ThemeProvider } from "next-themes";
import { validateConfig } from "@/lib/config";
import "../globals.css";

validateConfig();

// Vazirmatn supports Arabic and Latin
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazirmatn",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Currency Exchange Rates",
  description: "Real-time currency, cryptocurrency, and gold prices",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure locale is valid
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Get all messages for client-side
  const messages = await getMessages();

  // Determine text direction
  const direction = locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={direction}
      className={vazirmatn.variable}
      suppressHydrationWarning
    >
      <body className={`${vazirmatn.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <StoreProvider>
              <OfflineBannerWrapper />
              {children}
            </StoreProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

// Generate static params for all locales
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
```

---

## Phase 3: Component Updates (Tasks 13-29)

### Strategy for Each Component:

1. **For Server Components:**
   ```typescript
   import { getTranslations } from 'next-intl/server';

   export default async function MyComponent() {
     const t = await getTranslations('ComponentNamespace');

     return <h1>{t('title')}</h1>;
   }
   ```

2. **For Client Components:**
   ```typescript
   'use client';
   import { useTranslations } from 'next-intl';

   export default function MyComponent() {
     const t = useTranslations('ComponentNamespace');

     return <h1>{t('title')}</h1>;
   }
   ```

### 3.1 PageHeader Component

**File: `src/components/PageHeader/PageHeader.tsx`**

Changes needed:
- Import `useTranslations`
- Replace all hardcoded strings:
  - "نرخ ارز، طلا و ارز دیجیتال"
  - "بروزرسانی"
  - "در حال بروزرسانی..."
  - "آخرین بروزرسانی:"
  - ARIA labels

**Example:**
```typescript
const t = useTranslations('PageHeader');

<h1>{t('title')}</h1>
<button aria-label={t('refreshButton')}>
  {isRefreshing ? t('refreshing') : t('refreshButton')}
</button>
```

---

### 3.2 DataSection Component

**File: `src/components/DataSection/DataSection.tsx`**

Update props to accept translation keys instead of hardcoded titles.

---

### 3.3 Home Page

**File: `app/[locale]/page.tsx`**

Replace:
- "ارزها" → `t('DataSection.currencies')`
- "ارزهای دیجیتال" → `t('DataSection.crypto')`
- "طلا و سکه" → `t('DataSection.gold')`
- Error messages
- Skip to content text
- Footer auto-refresh text

---

### 3.4 SettingsModal

**File: `src/components/SettingsModal.tsx`**

Add Language section with LanguageSwitcher component (see Phase 4).

---

### 3.5 Other Components

Apply same pattern to:
- Settings page
- Login page
- Wallet page
- Admin pages
- Error components
- Notification components
- Profile/Password components
- Chart components
- UI components

---

## Phase 4: Language Selector (Tasks 30-34)

### 4.1 Create LanguageSwitcher Component

**File: `src/components/LanguageSwitcher.tsx`**

```typescript
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales } from '@/i18n/request';

const languageNames: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  fa: 'فارسی',
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    // Replace the current locale in the pathname
    const pathWithoutLocale = pathname.replace(`/${locale}`, '');
    const newPath = `/${newLocale}${pathWithoutLocale}`;
    router.push(newPath);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          className={`w-full text-right px-4 py-3 rounded-lg border transition-colors ${
            locale === loc
              ? 'bg-accent text-white border-accent'
              : 'bg-bg-base hover:bg-bg-secondary border-border-light text-text-primary'
          }`}
        >
          <span className="font-medium">{languageNames[loc]}</span>
        </button>
      ))}
    </div>
  );
}
```

---

### 4.2 Add to SettingsModal

**In `src/components/SettingsModal.tsx`:**

Add Language section between Appearance and Account sections:

```typescript
{/* Language Section */}
<section>
  <h3 className="text-sm font-medium text-text-secondary mb-3">
    {t('language')}
  </h3>
  <LanguageSwitcher />
</section>

{/* Divider */}
<div className="border-t border-border-light" />
```

---

## Phase 5: RTL/LTR Support (Tasks 35-40)

### 5.1 CSS Considerations

**Check these areas:**
1. **Flexbox direction** - may need `flex-row-reverse` for RTL
2. **Margins/Paddings** - use logical properties or conditional classes
3. **Text alignment** - use `text-start` instead of `text-left`
4. **Icons/Arrows** - may need rotation for RTL
5. **Chart positioning** - verify labels and legends

**Conditional classes example:**
```typescript
const { locale } = await params;
const isRTL = locale === 'ar' || locale === 'fa';

<div className={isRTL ? 'flex-row-reverse' : 'flex-row'}>
```

---

### 5.2 Date/Time Formatting

Update all date formatting to be locale-aware:

```typescript
// Before
lastUpdated.toLocaleTimeString('fa-IR')

// After
lastUpdated.toLocaleTimeString(locale, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})
```

---

### 5.3 Number Formatting

Update currency and number formatting:

```typescript
// Use Intl.NumberFormat with locale
const formatter = new Intl.NumberFormat(locale, {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

formatter.format(price)
```

---

## Phase 6: Testing & Verification (Tasks 41-50)

### 6.1 Testing Checklist

**Per Language (en, ar, fa):**
- [ ] Home page renders correctly
- [ ] All section titles are translated
- [ ] Settings modal shows correct translations
- [ ] Settings page works
- [ ] Login page works
- [ ] Wallet page works
- [ ] Admin pages work (if admin user)
- [ ] Error messages display in correct language
- [ ] Success notifications display in correct language
- [ ] Chart component shows correct labels
- [ ] Date/time formats correctly
- [ ] Numbers format correctly
- [ ] RTL layout works (ar, fa)
- [ ] LTR layout works (en)

**Functional Testing:**
- [ ] Language switcher changes language
- [ ] Language preference persists after refresh
- [ ] Browser language detection works on first visit
- [ ] All routes work with locale prefix (/en/*, /ar/*, /fa/*)
- [ ] Redux state persists across language changes
- [ ] API calls work regardless of language
- [ ] No console errors or warnings

**Build Testing:**
- [ ] `npm run build` succeeds
- [ ] No missing translation warnings
- [ ] Production build works for all locales
- [ ] Static generation works for all locale routes

---

## Implementation Order Recommendation

### Week 1: Infrastructure
- Day 1-2: Tasks 1-6 (Install, configure, create translation files)
- Day 3-4: Tasks 7-12 (Restructure app router)
- Day 5: Test infrastructure works

### Week 2: Components (Part 1)
- Day 1: Tasks 13-15 (PageHeader, DataSection, Home page)
- Day 2: Tasks 16-17 (Settings modal & page)
- Day 3: Tasks 18-20 (Auth pages & wallet)
- Day 4: Tasks 21-22 (Error & notification components)
- Day 5: Test all updated components

### Week 3: Components (Part 2) & Language Selector
- Day 1: Tasks 23-27 (Profile, wallet, user management components)
- Day 2: Tasks 28-29 (Chart & UI components)
- Day 3: Tasks 30-34 (Language switcher implementation)
- Day 4: Task 35-40 (RTL/LTR support & formatting)
- Day 5: Initial testing

### Week 4: Testing & Refinement
- Day 1-2: Tasks 41-45 (RTL/LTR testing)
- Day 3-4: Tasks 46-48 (Functional testing)
- Day 5: Tasks 49-50 (Build & production testing)

---

## Translation File Template

For each component, follow this pattern in translation files:

### Component: ExampleComponent.tsx

**Farsi text extraction:**
```
"عنوان صفحه" → PageHeader.title
"دکمه ذخیره" → Common.save
"خطا در بارگذاری" → Errors.loading
```

**English translation:**
```json
{
  "PageHeader": {
    "title": "Page Title"
  },
  "Common": {
    "save": "Save"
  },
  "Errors": {
    "loading": "Error loading"
  }
}
```

**Arabic translation:**
```json
{
  "PageHeader": {
    "title": "عنوان الصفحة"
  },
  "Common": {
    "save": "حفظ"
  },
  "Errors": {
    "loading": "خطأ في التحميل"
  }
}
```

---

## Common Pitfalls to Avoid

1. **Don't forget async/await** for `getTranslations()` in server components
2. **Don't use `t()` in server components** - use `getTranslations()` instead
3. **Don't hardcode `'fa-IR'` in date/time functions** - use locale variable
4. **Don't forget to update ARIA labels** - they need translation too
5. **Don't assume text length** - English text is often longer than Farsi/Arabic
6. **Don't forget `dir` attribute** - critical for RTL languages
7. **Don't use directional CSS properties** - use logical or conditional
8. **Don't forget to test with real data** - some characters may break layout
9. **Don't skip accessibility testing** - screen readers need proper lang attributes
10. **Don't forget validation messages** - they should also be translated

---

## Resources

- next-intl docs: https://next-intl.dev
- Next.js i18n docs: https://nextjs.org/docs/app/building-your-application/routing/internationalization
- RTL Styling Guide: https://rtlstyling.com
- Arabic Typography: https://fonts.google.com/?subset=arabic
- Farsi/Persian Typography: https://fonts.google.com/?subset=persian

---

## Notes

- **Current app language**: Farsi (RTL)
- **Default locale**: Recommend keeping `fa` as default
- **Font**: Vazirmatn already supports Arabic and Latin
- **Redux**: No changes needed to Redux store setup
- **API**: Backend responses are language-agnostic (numbers/data)
- **Browser detection**: Automatic with next-intl middleware
- **Cookie persistence**: Automatic with next-intl
- **Type safety**: Consider using next-intl TypeScript plugin for type-safe keys

---

## Success Criteria

✅ All text in the application is translatable
✅ Three languages fully implemented (en, ar, fa)
✅ Language selector in settings menu works
✅ Browser language detection works
✅ RTL layout works correctly for Arabic and Farsi
✅ LTR layout works correctly for English
✅ Date/time formatting is locale-aware
✅ Number formatting is locale-aware
✅ All routes accessible in all three languages
✅ No hardcoded text remains
✅ Production build successful
✅ All tests pass

---

## Post-Implementation

After completing the implementation:

1. **Translation Review**: Have native speakers review translations
2. **Performance Check**: Verify bundle sizes haven't increased significantly
3. **SEO**: Consider adding hreflang tags for better SEO
4. **Analytics**: Track which languages users prefer
5. **Maintenance**: Create process for adding new translations when adding features
6. **Documentation**: Update README with language switching instructions
