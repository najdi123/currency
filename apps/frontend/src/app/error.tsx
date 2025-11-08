'use client'

import { useEffect } from 'react'
import { logComponentError, addBreadcrumb } from '@/lib/errorLogger'

/**
 * Page-Level Error Boundary
 *
 * This catches errors in page components and their children.
 * More user-friendly than the global error boundary - allows retry without full page reload.
 *
 * IMPORTANT: This must be a client component placed in the app directory.
 * Next.js will automatically use this to catch errors in the route segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console
    console.error('⚠️ Page Error Boundary caught an error:', error)

    // Add breadcrumb for tracking
    addBreadcrumb({
      category: 'error',
      message: 'Page Error Boundary triggered',
      level: 'error',
      data: {
        errorMessage: error.message,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    })

    // Log to error monitoring service
    logComponentError(
      error,
      'Page Error Boundary',
      undefined,
      'Page component error'
    )
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {/* Error Icon */}
        <div className="mb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <h2 className="text-xl font-bold text-gray-900 mb-3 text-center">
          مشکلی پیش آمده
        </h2>
        <p className="text-gray-600 mb-6 text-center">
          متأسفانه در بارگذاری این صفحه خطایی رخ داده است. لطفاً دوباره تلاش کنید.
        </p>

        {/* Error Details (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6">
            <details className="group">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2 select-none">
                <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                {' '}جزئیات خطا (فقط در حالت توسعه)
              </summary>
              <div className="bg-red-50 border border-red-200 rounded p-3 overflow-auto max-h-32 mt-2">
                <p className="text-xs font-mono text-red-700 whitespace-pre-wrap break-all">
                  {error.message}
                </p>
                {error.stack && (
                  <p className="text-xs font-mono text-red-600 mt-2 whitespace-pre-wrap break-all">
                    {error.stack.split('\n').slice(0, 5).join('\n')}
                  </p>
                )}
                {error.digest && (
                  <p className="text-xs text-gray-600 mt-2">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            تلاش مجدد
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            بازگشت به صفحه اصلی
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 text-center mt-6">
          اگر این مشکل ادامه دارد، لطفاً مرورگر خود را رفرش کنید یا بعداً تلاش کنید.
        </p>
      </div>
    </div>
  )
}
