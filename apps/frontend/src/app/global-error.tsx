'use client'

import { useEffect } from 'react'
import { logComponentError, addBreadcrumb } from '@/lib/errorLogger'

/**
 * Global Error Boundary
 *
 * This catches errors that occur in the root layout.
 * It's a last resort fallback when something goes catastrophically wrong.
 *
 * IMPORTANT: This must be a client component and must accept error and reset props.
 * Next.js automatically wraps the root layout with this error boundary.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console in development
    console.error('🚨 Global Error Boundary caught an error:', error)

    // Add breadcrumb for tracking
    addBreadcrumb({
      category: 'error',
      message: 'Global Error Boundary triggered',
      level: 'fatal',
      data: {
        errorMessage: error.message,
        digest: error.digest,
      },
    })

    // Log to error monitoring service
    logComponentError(
      error,
      'Global Error Boundary',
      undefined,
      'Root layout error'
    )
  }, [error])

  return (
    <html lang="fa" dir="rtl">
      <body>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-lg w-full text-center">
            {/* Error Icon */}
            <div className="mb-6">
              <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              خطای غیرمنتظره
            </h1>
            <p className="text-gray-600 mb-6">
              متأسفانه مشکلی در برنامه رخ داده است. لطفاً صفحه را بازنشانی کنید یا بعداً دوباره تلاش کنید.
            </p>

            {/* Error Details (only in development) */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                  جزئیات خطا (فقط در حالت توسعه)
                </summary>
                <div className="bg-gray-50 border border-gray-200 rounded p-4 overflow-auto max-h-40">
                  <p className="text-xs font-mono text-red-600 break-all">
                    {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-gray-500 mt-2">
                      Digest: {error.digest}
                    </p>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                تلاش مجدد
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                بازگشت به صفحه اصلی
              </button>
            </div>

            {/* Additional Help */}
            <p className="text-xs text-gray-500 mt-6">
              در صورت تکرار این مشکل، لطفاً با پشتیبانی تماس بگیرید.
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
