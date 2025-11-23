# Phase 3 Frontend Implementation Guide

**Date**: 2025-11-16
**Status**: Implementation Ready
**Estimated Time**: 2-3 hours

---

## 📊 Progress Status

### ✅ Completed
- [x] useRateLimit hook created
- [x] Backend API endpoint ready (`/api/rate-limit/status`)
- [x] TypeScript interfaces defined

### ⏳ To Implement
- [ ] RateLimitBadge component
- [ ] RateLimitMeter component
- [ ] RateLimitError component
- [ ] Translations (fa, en, ar)
- [ ] Integration into layout

---

## 📁 File Structure

```
apps/frontend/src/
├── hooks/
│   └── useRateLimit.ts ✅ DONE
├── components/
│   └── RateLimit/
│       ├── RateLimitBadge.tsx ⏳ TODO
│       ├── RateLimitMeter.tsx ⏳ TODO
│       ├── RateLimitError.tsx ⏳ TODO
│       └── index.ts ⏳ TODO
└── messages/
    ├── fa.json (update) ⏳ TODO
    ├── en.json (update) ⏳ TODO
    └── ar.json (update) ⏳ TODO
```

---

## 🎯 Component 1: RateLimitBadge

**File**: `apps/frontend/src/components/RateLimit/RateLimitBadge.tsx`

**Purpose**: Compact badge for header/navbar showing current rate limit status

**Code**:
```tsx
'use client';

import { useRateLimit } from '@/hooks/useRateLimit';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function RateLimitBadge() {
  const t = useTranslations('rateLimit');
  const { status, loading } = useRateLimit();

  if (loading || !status) {
    return (
      <div className="h-8 w-24 animate-pulse bg-white/5 rounded-lg" />
    );
  }

  const getColor = () => {
    if (status.percentage > 50) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (status.percentage > 20) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getTierColor = () => {
    const colors = {
      free: 'bg-gray-500/20 text-gray-300',
      premium: 'bg-blue-500/20 text-blue-300',
      enterprise: 'bg-purple-500/20 text-purple-300',
    };
    return colors[status.tier] || colors.free;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
      {/* Tier Badge */}
      <span className={cn(
        'px-2 py-0.5 text-xs rounded font-medium',
        getTierColor()
      )}>
        {status.tier.toUpperCase()}
      </span>

      {/* Usage Indicator */}
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium',
        getColor()
      )}>
        <div className={cn(
          'w-2 h-2 rounded-full',
          status.percentage > 50 ? 'bg-green-400' :
          status.percentage > 20 ? 'bg-yellow-400' : 'bg-red-400',
          status.percentage < 30 && 'animate-pulse'
        )} />
        <span>
          {status.remaining}/{status.limit}
        </span>
      </div>
    </div>
  );
}
```

**Features**:
- ✅ Color-coded status (green/yellow/red)
- ✅ Tier badge
- ✅ Pulse animation when low
- ✅ Loading skeleton
- ✅ Responsive design

---

## 🎯 Component 2: RateLimitMeter

**File**: `apps/frontend/src/components/RateLimit/RateLimitMeter.tsx`

**Purpose**: Detailed meter for settings page with progress bar and upgrade CTA

**Code**:
```tsx
'use client';

import { useRateLimit } from '@/hooks/useRateLimit';
import { useTranslations } from 'next-intl';
import { Clock, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RateLimitMeter() {
  const t = useTranslations('rateLimit');
  const { status, loading, error } = useRateLimit();

  if (loading) {
    return (
      <div className="animate-pulse bg-white/5 rounded-lg h-48" />
    );
  }

  if (error || !status) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
        <p className="text-red-400 text-sm">{t('errorLoading')}</p>
      </div>
    );
  }

  const used = status.limit - status.remaining;
  const percentage = Math.round((used / status.limit) * 100);

  const getBarColor = () => {
    if (percentage < 50) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    if (percentage < 80) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    return 'bg-gradient-to-r from-red-500 to-pink-500';
  };

  const formatResetTime = () => {
    const resetDate = new Date(status.resetAt);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));

    if (hours > 24) {
      const days = Math.ceil(hours / 24);
      return `${days} ${t(days === 1 ? 'day' : 'days')}`;
    }
    return hours > 1 ? `${hours} ${t('hours')}` : t('lessThanHour');
  };

  return (
    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm rounded-lg p-6 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">
          {t('apiUsage')}
        </h3>
        <div className="flex items-center gap-2">
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            status.tier === 'free' && 'bg-gray-500/20 text-gray-300',
            status.tier === 'premium' && 'bg-blue-500/20 text-blue-300',
            status.tier === 'enterprise' && 'bg-purple-500/20 text-purple-300',
          )}>
            {status.tier.charAt(0).toUpperCase() + status.tier.slice(1)} {t('plan')}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/80 font-medium">
            {used} / {status.limit} {t('requests')}
          </span>
          <span className="text-white/60">
            {percentage}%
          </span>
        </div>

        <div className="relative w-full bg-white/10 rounded-full h-4 overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out',
              getBarColor()
            )}
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* Status Info */}
      <div className="flex items-center justify-between text-sm text-white/60 mb-4">
        <div className="flex items-center gap-2">
          <Clock size={16} />
          <span>{t('resetsIn')} {formatResetTime()}</span>
        </div>

        <div className="flex items-center gap-1.5 text-white/80">
          <span>{status.remaining} {t('remaining')}</span>
        </div>
      </div>

      {/* Upgrade CTA */}
      {status.tier === 'free' && percentage > 70 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white mb-1">
                {t('nearLimitWarning')}
              </p>
              <p className="text-xs text-white/60">
                {t('upgradeForMore')}
              </p>
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium whitespace-nowrap">
              <Zap size={16} />
              <span>{t('upgradePlan')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Critical Warning */}
      {percentage > 90 && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-500/20 rounded-full">
              <TrendingUp className="text-red-400" size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-red-400 mb-1">
                {t('criticalWarning')}
              </p>
              <p className="text-xs text-red-400/70">
                {t('criticalMessage')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Features**:
- ✅ Animated progress bar
- ✅ Color-coded warnings
- ✅ Tier badge
- ✅ Reset countdown
- ✅ Upgrade CTA (>70% usage)
- ✅ Critical warning (>90%)
- ✅ Shimmer animation

---

## 🎯 Component 3: RateLimitError

**File**: `apps/frontend/src/components/RateLimit/RateLimitError.tsx`

**Purpose**: Error modal/banner when rate limit is exceeded (429 response)

**Code**:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RateLimitErrorProps {
  retryAfter: number; // seconds
  resetAt: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export function RateLimitError({ retryAfter, resetAt, onRetry, onClose }: RateLimitErrorProps) {
  const t = useTranslations('rateLimit');
  const [countdown, setCountdown] = useState(retryAfter);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      setCanRetry(true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          setCanRetry(true);
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    if (minutes > 0) {
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    }
    return `0:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-orange-500/30 rounded-xl shadow-2xl overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white/60" />
          </button>
        )}

        <div className="relative p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full border border-orange-500/30">
              <Clock className="text-orange-400" size={32} />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-white text-center mb-2">
            {t('rateLimitExceeded')}
          </h3>

          {/* Message */}
          <p className="text-white/70 text-center mb-6 text-sm">
            {t('rateLimitMessage')}
          </p>

          {/* Countdown */}
          {!canRetry && (
            <div className="flex flex-col items-center mb-6">
              <p className="text-sm text-white/60 mb-2">{t('tryAgainIn')}</p>
              <div className="flex items-center gap-2 text-3xl font-mono font-bold text-orange-400">
                <Clock size={24} />
                <span>{formatTime(countdown)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {canRetry && onRetry ? (
              <button
                onClick={onRetry}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                {t('tryAgain')}
              </button>
            ) : (
              <div className="flex-1 px-6 py-3 bg-white/5 text-white/40 rounded-lg text-center font-medium cursor-not-allowed">
                {t('pleaseWait')}
              </div>
            )}

            <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium">
              <Zap size={18} />
              <span>{t('upgradePlan')}</span>
            </button>
          </div>

          {/* Reset Time */}
          <p className="text-xs text-white/40 text-center mt-4">
            {t('quotaResetsAt')}: {new Date(resetAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Features**:
- ✅ Live countdown timer
- ✅ Auto-enable retry when ready
- ✅ Animated background
- ✅ Upgrade CTA
- ✅ Close button
- ✅ Reset time display
- ✅ Responsive modal

---

## 🎯 Component 4: Index File

**File**: `apps/frontend/src/components/RateLimit/index.ts`

**Code**:
```ts
export { RateLimitBadge } from './RateLimitBadge';
export { RateLimitMeter } from './RateLimitMeter';
export { RateLimitError } from './RateLimitError';
```

---

## 🌍 Translations

### English (`messages/en.json`)

**Add to existing en.json**:
```json
{
  "rateLimit": {
    "apiUsage": "API Usage",
    "plan": "Plan",
    "requests": "requests",
    "remaining": "remaining",
    "resetsIn": "Resets in",
    "hours": "hours",
    "day": "day",
    "days": "days",
    "lessThanHour": "less than 1 hour",
    "upgradePlan": "Upgrade Plan",
    "upgradeForMore": "Upgrade for unlimited requests",
    "nearLimitWarning": "You're approaching your daily limit",
    "criticalWarning": "Almost out of requests!",
    "criticalMessage": "Consider upgrading to avoid service interruption",
    "rateLimitExceeded": "Rate Limit Exceeded",
    "rateLimitMessage": "You've reached your daily API limit. Your quota will reset soon.",
    "tryAgainIn": "You can try again in",
    "tryAgain": "Try Again",
    "pleaseWait": "Please Wait",
    "quotaResetsAt": "Quota resets at",
    "errorLoading": "Failed to load rate limit status"
  }
}
```

### Farsi (`messages/fa.json`)

**Add to existing fa.json**:
```json
{
  "rateLimit": {
    "apiUsage": "استفاده از API",
    "plan": "پلن",
    "requests": "درخواست‌ها",
    "remaining": "باقی‌مانده",
    "resetsIn": "بازنشانی در",
    "hours": "ساعت",
    "day": "روز",
    "days": "روز",
    "lessThanHour": "کمتر از ۱ ساعت",
    "upgradePlan": "ارتقای پلن",
    "upgradeForMore": "برای درخواست‌های نامحدود ارتقا دهید",
    "nearLimitWarning": "شما به محدودیت روزانه خود نزدیک می‌شوید",
    "criticalWarning": "تقریباً از درخواست‌ها تمام شده!",
    "criticalMessage": "برای جلوگیری از قطع سرویس، ارتقا را در نظر بگیرید",
    "rateLimitExceeded": "محدودیت نرخ فراتر رفت",
    "rateLimitMessage": "شما به محدودیت روزانه API خود رسیده‌اید. سهمیه شما به زودی بازنشانی می‌شود.",
    "tryAgainIn": "می‌توانید دوباره امتحان کنید در",
    "tryAgain": "دوباره امتحان کنید",
    "pleaseWait": "لطفا صبر کنید",
    "quotaResetsAt": "سهمیه بازنشانی می‌شود در",
    "errorLoading": "بارگذاری وضعیت محدودیت نرخ ناموفق بود"
  }
}
```

### Arabic (`messages/ar.json`)

**Add to existing ar.json**:
```json
{
  "rateLimit": {
    "apiUsage": "استخدام API",
    "plan": "الخطة",
    "requests": "طلبات",
    "remaining": "المتبقي",
    "resetsIn": "يعاد تعيين في",
    "hours": "ساعات",
    "day": "يوم",
    "days": "أيام",
    "lessThanHour": "أقل من ساعة",
    "upgradePlan": "ترقية الخطة",
    "upgradeForMore": "قم بالترقية للحصول على طلبات غير محدودة",
    "nearLimitWarning": "أنت تقترب من حدك اليومي",
    "criticalWarning": "نفدت الطلبات تقريبًا!",
    "criticalMessage": "فكر في الترقية لتجنب انقطاع الخدمة",
    "rateLimitExceeded": "تم تجاوز حد المعدل",
    "rateLimitMessage": "لقد وصلت إلى حد API اليومي. ستتم إعادة تعيين حصتك قريبًا.",
    "tryAgainIn": "يمكنك المحاولة مرة أخرى في",
    "tryAgain": "حاول مرة أخرى",
    "pleaseWait": "يرجى الانتظار",
    "quotaResetsAt": "إعادة تعيين الحصة في",
    "errorLoading": "فشل تحميل حالة حد المعدل"
  }
}
```

---

## 🔧 Integration

### Step 1: Add Badge to Header

**File**: Find your main header/navbar component (e.g., `components/Header.tsx` or `app/[locale]/layout.tsx`)

**Add**:
```tsx
import { RateLimitBadge } from '@/components/RateLimit';

// In your header JSX:
<div className="flex items-center gap-4">
  {/* Other header items */}
  <RateLimitBadge />
</div>
```

### Step 2: Add Meter to Settings

**File**: `app/[locale]/settings/page.tsx`

**Add**:
```tsx
import { RateLimitMeter } from '@/components/RateLimit';

export default function SettingsPage() {
  return (
    <div>
      {/* Other settings sections */}

      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">API Usage</h2>
        <RateLimitMeter />
      </section>
    </div>
  );
}
```

### Step 3: Add Global Error Handling

**File**: Create `lib/api-client.ts` or add to existing API client

**Code**:
```typescript
export class RateLimitError extends Error {
  retryAfter: number;
  resetAt: string;

  constructor(data: any) {
    super('Rate limit exceeded');
    this.retryAfter = data.retryAfter || 0;
    this.resetAt = data.resetAt;
  }
}

export async function apiClient(url: string, options?: RequestInit) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const data = await response.json();
    throw new RateLimitError(data);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}
```

**Usage**:
```tsx
'use client';

import { useState } from 'react';
import { RateLimitError } from '@/components/RateLimit';
import { apiClient, RateLimitError as RateLimitErrorClass } from '@/lib/api-client';

export function MyComponent() {
  const [rateLimitError, setRateLimitError] = useState<any>(null);

  async function fetchData() {
    try {
      const response = await apiClient('/api/some-endpoint');
      const data = await response.json();
      // ... handle data
    } catch (error) {
      if (error instanceof RateLimitErrorClass) {
        setRateLimitError({
          retryAfter: error.retryAfter,
          resetAt: error.resetAt,
        });
      }
    }
  }

  return (
    <>
      {/* Your component JSX */}

      {rateLimitError && (
        <RateLimitError
          retryAfter={rateLimitError.retryAfter}
          resetAt={rateLimitError.resetAt}
          onRetry={() => {
            setRateLimitError(null);
            fetchData();
          }}
          onClose={() => setRateLimitError(null)}
        />
      )}
    </>
  );
}
```

---

## 🎨 Styling Notes

All components use:
- **Tailwind CSS** for styling
- **Utility function** `cn()` from `@/lib/utils` for conditional classes
- **Lucide React** icons (`Clock`, `Zap`, `TrendingUp`, `X`)
- **Gradient backgrounds** and **backdrop-blur** for modern look
- **RTL support** built-in via Tailwind

**If `cn()` utility doesn't exist**, create it:
```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## ✅ Implementation Checklist

### Phase 1: Create Components (1 hour)
- [ ] Create `RateLimitBadge.tsx`
- [ ] Create `RateLimitMeter.tsx`
- [ ] Create `RateLimitError.tsx`
- [ ] Create `index.ts` barrel export
- [ ] Verify `useRateLimit.ts` exists

### Phase 2: Add Translations (15 minutes)
- [ ] Update `messages/en.json`
- [ ] Update `messages/fa.json`
- [ ] Update `messages/ar.json`

### Phase 3: Integration (30 minutes)
- [ ] Add badge to header/navbar
- [ ] Add meter to settings page
- [ ] Create API client with error handling
- [ ] Test error modal

### Phase 4: Testing (30 minutes)
- [ ] Test all components render
- [ ] Test countdown timer
- [ ] Test translations (all 3 languages)
- [ ] Test responsive design
- [ ] Test RTL layout (Arabic)
- [ ] Test upgrade CTAs

---

## 🧪 Testing Guide

### Manual Testing

1. **Badge Test**:
   ```bash
   # Start backend
   npm run start:dev

   # Visit frontend
   # Check header shows badge with correct tier and count
   ```

2. **Meter Test**:
   ```bash
   # Visit /settings page
   # Verify progress bar shows correct percentage
   # Check countdown timer updates
   ```

3. **Error Test**:
   ```bash
   # Make 101 requests (exceed FREE tier)
   # Should show RateLimitError modal
   # Countdown should work
   # Retry button should enable after countdown
   ```

4. **Translation Test**:
   ```bash
   # Switch language to Farsi (fa)
   # Switch language to Arabic (ar)
   # Verify all text translates correctly
   # Check RTL layout
   ```

---

## 🎯 Expected Impact

### Before (7.8/10)
- No frontend visibility into rate limits
- Users surprised by 429 errors
- No upgrade prompts

### After (8.6/10)
- ✅ Clear badge in header (+0.3)
- ✅ Detailed meter in settings (+0.2)
- ✅ User-friendly error modal (+0.2)
- ✅ Multi-language support (+0.1)

**Total Gain**: +0.8 points

---

## 📚 Additional Resources

### Tailwind CSS
- Gradients: https://tailwindcss.com/docs/gradient-color-stops
- Animations: https://tailwindcss.com/docs/animation
- Backdrop Blur: https://tailwindcss.com/docs/backdrop-blur

### Next.js i18n
- next-intl: https://next-intl-docs.vercel.app/

### Icons
- Lucide React: https://lucide.dev/

---

## 🚀 Quick Start

```bash
# 1. Create all component files
cd apps/frontend/src/components
mkdir RateLimit

# 2. Copy code from this guide into respective files

# 3. Update translations

# 4. Add to header and settings page

# 5. Test
npm run dev
```

---

**Total Estimated Time**: 2-3 hours
**Expected Rating**: 8.6/10 (from 7.8/10)
**Next Step**: Phase 4 complete, move to testing and deployment

Good luck! 🎉
