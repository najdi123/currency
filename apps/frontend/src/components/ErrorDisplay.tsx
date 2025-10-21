/**
 * Error Display Component
 *
 * Consistent error UI component for displaying user-friendly error messages
 * with suggested actions and retry functionality.
 *
 * Features:
 * - User-friendly Persian messages
 * - Suggested actions list
 * - Retry button
 * - Copy error details button
 * - Report problem button
 * - Severity-based styling
 * - Technical details in development mode
 */

'use client'

import { useState } from 'react'
import {
  getUserErrorMessage,
  getSeverityColor,
  copyErrorToClipboard,
  type ErrorSeverity,
} from '@/lib/utils/errorMessages'
import { getErrorCode } from '@/types/errors'
import { config } from '@/lib/config'

/**
 * Error Display Props
 */
export interface ErrorDisplayProps {
  /** The error to display */
  error: unknown
  /** Callback when retry is clicked */
  onRetry?: () => void
  /** Title override (optional) */
  title?: string
  /** Custom className */
  className?: string
  /** Show report button (default: true) */
  showReportButton?: boolean
  /** Show copy button (default: true in dev) */
  showCopyButton?: boolean
  /** Compact mode (smaller padding, hide actions list) */
  compact?: boolean
}

/**
 * Comprehensive Error Display Component
 */
export function ErrorDisplay({
  error,
  onRetry,
  title: titleOverride,
  className = '',
  showReportButton = true,
  showCopyButton = config.isDevelopment,
  compact = false,
}: ErrorDisplayProps) {
  const [copied, setCopied] = useState(false)
  const errorMessage = getUserErrorMessage(error)
  const errorCode = getErrorCode(error)
  const colors = getSeverityColor(errorMessage.severity)

  const title = titleOverride || errorMessage.title

  // Handle copy to clipboard
  const handleCopy = async () => {
    const success = await copyErrorToClipboard(error)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Handle report problem
  const handleReport = () => {
    // TODO: Implement error reporting to support system
    // For now, just copy to clipboard
    handleCopy()
    alert('جزئیات خطا کپی شد. لطفاً آن را به تیم پشتیبانی ارسال کنید.')
  }

  return (
    <div
      className={`${colors.bg} border ${colors.border} rounded-lg ${compact ? 'p-4' : 'p-6'} ${className}`}
      dir="rtl"
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className={`text-3xl ${compact ? 'text-2xl' : ''}`} aria-hidden="true">
            {errorMessage.icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={`font-bold ${colors.text} ${compact ? 'text-base mb-1' : 'text-lg mb-2'}`}>
            {title}
          </h3>

          {/* Description */}
          <p className={`${colors.text} opacity-90 ${compact ? 'text-sm mb-2' : 'text-base mb-3'}`}>
            {errorMessage.description}
          </p>

          {/* Suggested Actions */}
          {!compact && errorMessage.suggestedActions.length > 0 && (
            <div className="mb-4">
              <p className={`${colors.text} font-semibold text-sm mb-2`}>پیشنهادات:</p>
              <ul className={`${colors.text} opacity-80 text-sm space-y-1 pr-5`}>
                {errorMessage.suggestedActions.map((action, index) => (
                  <li key={index} className="list-disc">
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Code (in development) */}
          {errorCode && errorMessage.showTechnicalDetails && config.isDevelopment && (
            <div className="mb-3">
              <details className="group">
                <summary className={`cursor-pointer text-xs ${colors.text} opacity-75 hover:opacity-100 select-none`}>
                  <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                  {' '}جزئیات فنی (فقط در حالت توسعه)
                </summary>
                <div className="mt-2 bg-white bg-opacity-50 border border-current border-opacity-20 rounded p-2">
                  <p className={`text-xs font-mono ${colors.text} break-all`}>
                    کد خطا: {errorCode}
                  </p>
                </div>
              </details>
            </div>
          )}

          {/* Action Buttons */}
          <div className={`flex flex-wrap gap-2 ${compact ? 'mt-2' : 'mt-4'}`}>
            {/* Retry Button */}
            {errorMessage.canRetry && onRetry && (
              <button
                onClick={onRetry}
                className={`${colors.button} ${colors.buttonHover} text-white px-4 py-2 rounded transition-colors font-medium text-sm flex items-center gap-2`}
              >
                <svg
                  className="w-4 h-4"
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
            )}

            {/* Report Problem Button */}
            {showReportButton && (
              <button
                onClick={handleReport}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition-colors font-medium text-sm flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
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
                گزارش مشکل
              </button>
            )}

            {/* Copy Error Button */}
            {showCopyButton && (
              <button
                onClick={handleCopy}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition-colors font-medium text-sm flex items-center gap-2"
                disabled={copied}
              >
                {copied ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    کپی شد!
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    کپی جزئیات
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline Error Display (Compact)
 */
export function InlineError({
  error,
  onRetry,
  className = '',
}: Pick<ErrorDisplayProps, 'error' | 'onRetry' | 'className'>) {
  return (
    <ErrorDisplay
      error={error}
      onRetry={onRetry}
      className={className}
      compact={true}
      showReportButton={false}
      showCopyButton={false}
    />
  )
}

/**
 * Simple Error Message (Text Only)
 */
export function SimpleErrorMessage({ error }: { error: unknown }) {
  const errorMessage = getUserErrorMessage(error)

  return (
    <div className="text-red-600 text-sm" dir="rtl">
      {errorMessage.title}
    </div>
  )
}

export default ErrorDisplay
