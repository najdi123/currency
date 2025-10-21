/**
 * Error Message Utility
 *
 * Maps error codes and types to user-friendly Persian messages
 * with suggested actions for users.
 */

import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { isFetchBaseQueryError, isConnectionError, isServerError } from '@/types/errors'

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info'

/**
 * User-facing error message
 */
export interface UserErrorMessage {
  /** Main title */
  title: string
  /** Detailed description */
  description: string
  /** Suggested actions for user */
  suggestedActions: string[]
  /** Error severity */
  severity: ErrorSeverity
  /** Icon type */
  icon: '🔴' | '⚠️' | 'ℹ️' | '🌐' | '⏱️' | '🔒' | '❌' | '📡'
  /** Can user retry? */
  canRetry: boolean
  /** Should show technical details in dev mode? */
  showTechnicalDetails: boolean
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserErrorMessage(error: unknown): UserErrorMessage {
  // Network/Connection Errors
  if (isFetchBaseQueryError(error)) {
    if (isConnectionError(error)) {
      return {
        title: 'خطا در اتصال به سرور',
        description: 'امکان برقراری ارتباط با سرور وجود ندارد. لطفاً اتصال اینترنت خود را بررسی کنید.',
        suggestedActions: [
          'اتصال اینترنت خود را بررسی کنید',
          'از فعال بودن وای‌فای یا داده موبایل مطمئن شوید',
          'چند لحظه صبر کنید و دوباره تلاش کنید',
        ],
        severity: 'error',
        icon: '🌐',
        canRetry: true,
        showTechnicalDetails: true,
      }
    }

    // Timeout Error
    if (error.status === 'TIMEOUT_ERROR') {
      return {
        title: 'زمان درخواست به پایان رسید',
        description: 'پاسخ سرور بیش از حد معمول طول کشید. این ممکن است به دلیل کندی اتصال اینترنت یا مشکل موقت سرور باشد.',
        suggestedActions: [
          'سرعت اینترنت خود را بررسی کنید',
          'چند دقیقه صبر کنید و دوباره تلاش کنید',
          'اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید',
        ],
        severity: 'warning',
        icon: '⏱️',
        canRetry: true,
        showTechnicalDetails: true,
      }
    }

    // Parsing Error
    if (error.status === 'PARSING_ERROR') {
      return {
        title: 'خطا در پردازش داده‌ها',
        description: 'داده‌های دریافتی از سرور قابل پردازش نیستند. این مشکل احتمالاً موقتی است.',
        suggestedActions: [
          'صفحه را رفرش کنید',
          'چند لحظه صبر کنید و دوباره تلاش کنید',
          'اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید',
        ],
        severity: 'error',
        icon: '❌',
        canRetry: true,
        showTechnicalDetails: true,
      }
    }

    // HTTP Status Codes
    const status = error.status

    // 400 - Bad Request
    if (status === 400) {
      return {
        title: 'درخواست نامعتبر',
        description: 'اطلاعات ارسالی نادرست است. لطفاً مطمئن شوید که تمام فیلدها به درستی پر شده‌اند.',
        suggestedActions: [
          'اطلاعات وارد شده را بررسی کنید',
          'تمام فیلدهای الزامی را پر کنید',
          'از صحت فرمت داده‌ها مطمئن شوید',
        ],
        severity: 'error',
        icon: '❌',
        canRetry: false,
        showTechnicalDetails: true,
      }
    }

    // 401 - Unauthorized
    if (status === 401) {
      return {
        title: 'نیاز به ورود',
        description: 'برای دسترسی به این بخش باید وارد حساب کاربری خود شوید.',
        suggestedActions: [
          'وارد حساب کاربری خود شوید',
          'اگر وارد شده‌اید، از صفحه خارج و دوباره وارد شوید',
        ],
        severity: 'warning',
        icon: '🔒',
        canRetry: false,
        showTechnicalDetails: false,
      }
    }

    // 403 - Forbidden
    if (status === 403) {
      return {
        title: 'دسترسی غیرمجاز',
        description: 'شما مجوز دسترسی به این بخش را ندارید.',
        suggestedActions: [
          'مطمئن شوید که با حساب کاربری صحیح وارد شده‌اید',
          'اگر فکر می‌کنید باید دسترسی داشته باشید، با پشتیبانی تماس بگیرید',
        ],
        severity: 'error',
        icon: '🔒',
        canRetry: false,
        showTechnicalDetails: false,
      }
    }

    // 404 - Not Found
    if (status === 404) {
      return {
        title: 'داده‌ای یافت نشد',
        description: 'اطلاعات مورد نظر در سرور موجود نیست. ممکن است حذف شده یا منتقل شده باشد.',
        suggestedActions: [
          'آدرس صفحه را بررسی کنید',
          'به صفحه اصلی بازگردید و دوباره جستجو کنید',
          'اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید',
        ],
        severity: 'error',
        icon: '❌',
        canRetry: false,
        showTechnicalDetails: true,
      }
    }

    // 429 - Too Many Requests
    if (status === 429) {
      return {
        title: 'درخواست‌های بیش از حد',
        description: 'شما تعداد زیادی درخواست در مدت زمان کوتاه ارسال کرده‌اید. لطفاً کمی صبر کنید.',
        suggestedActions: [
          'چند دقیقه صبر کنید',
          'از ارسال درخواست‌های مکرر خودداری کنید',
          'دوباره تلاش کنید',
        ],
        severity: 'warning',
        icon: '⏱️',
        canRetry: true,
        showTechnicalDetails: false,
      }
    }

    // 500 - Internal Server Error
    if (status === 500) {
      return {
        title: 'خطای سرور',
        description: 'مشکلی در سرور رخ داده است. تیم فنی در حال بررسی موضوع هستند.',
        suggestedActions: [
          'چند دقیقه صبر کنید و دوباره تلاش کنید',
          'صفحه را رفرش کنید',
          'اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید',
        ],
        severity: 'error',
        icon: '🔴',
        canRetry: true,
        showTechnicalDetails: true,
      }
    }

    // 502 - Bad Gateway
    if (status === 502) {
      return {
        title: 'خطا در ارتباط با سرور',
        description: 'سرور موقتاً در دسترس نیست. این مشکل معمولاً به سرعت برطرف می‌شود.',
        suggestedActions: [
          'چند لحظه صبر کنید',
          'صفحه را رفرش کنید',
          'دوباره تلاش کنید',
        ],
        severity: 'warning',
        icon: '📡',
        canRetry: true,
        showTechnicalDetails: true,
      }
    }

    // 503 - Service Unavailable
    if (status === 503) {
      return {
        title: 'سرویس در دسترس نیست',
        description: 'سرور در حال حاضر قادر به پاسخگویی نیست. ممکن است در حال تعمیر و نگهداری باشد.',
        suggestedActions: [
          'چند دقیقه صبر کنید',
          'دوباره تلاش کنید',
          'اگر مشکل ادامه داشت، بعداً مراجعه کنید',
        ],
        severity: 'warning',
        icon: '⏱️',
        canRetry: true,
        showTechnicalDetails: true,
      }
    }

    // Server Errors (5xx)
    if (isServerError(error)) {
      return {
        title: 'مشکل سرور',
        description: 'سرور با مشکل مواجه شده است. لطفاً بعداً مراجعه کنید.',
        suggestedActions: [
          'چند دقیقه صبر کنید',
          'دوباره تلاش کنید',
          'اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید',
        ],
        severity: 'error',
        icon: '🔴',
        canRetry: true,
        showTechnicalDetails: true,
      }
    }
  }

  // Generic Error (fallback)
  return {
    title: 'خطای غیرمنتظره',
    description: 'متأسفانه مشکلی پیش آمده است. لطفاً دوباره تلاش کنید.',
    suggestedActions: [
      'صفحه را رفرش کنید',
      'دوباره تلاش کنید',
      'اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید',
    ],
    severity: 'error',
    icon: '🔴',
    canRetry: true,
    showTechnicalDetails: true,
  }
}

/**
 * Get short error message (for inline display)
 */
export function getShortErrorMessage(error: unknown): string {
  const message = getUserErrorMessage(error)
  return message.title
}

/**
 * Get icon color class based on severity
 */
export function getSeverityColor(severity: ErrorSeverity): {
  text: string
  bg: string
  border: string
  button: string
  buttonHover: string
} {
  switch (severity) {
    case 'error':
      return {
        text: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        button: 'bg-red-600',
        buttonHover: 'hover:bg-red-700',
      }
    case 'warning':
      return {
        text: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        button: 'bg-orange-600',
        buttonHover: 'hover:bg-orange-700',
      }
    case 'info':
      return {
        text: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        button: 'bg-blue-600',
        buttonHover: 'hover:bg-blue-700',
      }
  }
}

/**
 * Format error for reporting to support
 */
export function formatErrorForSupport(error: unknown): string {
  if (isFetchBaseQueryError(error)) {
    const status = error.status
    const data = error.data

    return `Error Code: ${status}
Status: ${typeof status === 'number' ? status : status}
Data: ${JSON.stringify(data, null, 2)}
Time: ${new Date().toISOString()}
URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}
User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`
  }

  if (error instanceof Error) {
    return `Error: ${error.message}
Stack: ${error.stack || 'N/A'}
Time: ${new Date().toISOString()}
URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`
  }

  return `Error: ${String(error)}
Time: ${new Date().toISOString()}
URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`
}

/**
 * Copy error details to clipboard for support
 */
export async function copyErrorToClipboard(error: unknown): Promise<boolean> {
  try {
    const errorText = formatErrorForSupport(error)
    await navigator.clipboard.writeText(errorText)
    return true
  } catch {
    return false
  }
}
