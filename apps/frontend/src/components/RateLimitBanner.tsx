import React from 'react'
import { HiExclamationCircle } from 'react-icons/hi'

interface RateLimitBannerProps {
  onDismiss?: () => void
}

/**
 * RateLimitBanner - Displays a friendly message when API rate limit is reached
 *
 * Features:
 * - Clear explanation of the situation
 * - Reassurance that cached data is still available
 * - Guidance on when service will resume
 * - Dismissible for better UX
 */
export const RateLimitBanner: React.FC<RateLimitBannerProps> = ({ onDismiss }) => {
  return (
    <div
      className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mx-3 sm:mx-6 lg:mx-8 mb-4 animate-fade-in"
      role="alert"
      aria-live="polite"
      dir="rtl"
    >
      <div className="flex items-start gap-3">
        <HiExclamationCircle
          className="text-amber-600 dark:text-amber-400 text-xl flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
            محدودیت موقت در دریافت داده‌های جدید
          </h3>
          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
            به دلیل محدودیت تعداد درخواست‌ها، در حال حاضر امکان به‌روزرسانی خودکار داده‌ها وجود ندارد.
            <span className="block mt-1">
              ✓ داده‌های قبلی همچنان در دسترس هستند و قابل مشاهده می‌باشند
            </span>
            <span className="block mt-1 text-xs text-amber-700 dark:text-amber-300">
              برای به‌روزرسانی، می‌توانید از دکمه بروزرسانی در بالای صفحه استفاده کنید
            </span>
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="بستن پیام"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
