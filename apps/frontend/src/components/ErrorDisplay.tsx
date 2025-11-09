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
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('Errors')
  const [copied, setCopied] = useState(false)
  const errorMessage = getUserErrorMessage(error, t)
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
    alert(t('copyToSupport'))
  }

  return (
    <div
      className={`bg-bg-elevated border border-border-light rounded-[var(--radius-lg)] ${compact ? 'p-4' : 'p-6'} ${className} animate-fade-in`}
      
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className={`${compact ? 'text-2xl' : 'text-3xl'} text-accent opacity-60`} aria-hidden="true">
            {errorMessage.icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={`font-semibold text-text-primary ${compact ? 'text-apple-body mb-1' : 'text-apple-title mb-2'}`}>
            {title}
          </h3>

          {/* Description */}
          <p className={`text-text-secondary ${compact ? 'text-apple-caption mb-2' : 'text-apple-body mb-3'} leading-relaxed`}>
            {errorMessage.description}
          </p>

          {/* Suggested Actions */}
          {!compact && errorMessage.suggestedActions.length > 0 && (
            <div className="mb-4">
              <p className="text-text-primary font-semibold text-apple-caption mb-2">{t('suggestions')}</p>
              <ul className="text-text-secondary text-apple-caption space-y-1 pr-5">
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
                <summary className="cursor-pointer text-xs text-text-secondary hover:text-text-primary transition-apple-fast select-none">
                  <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                  {' '}{t('technicalDetails')}
                </summary>
                <div className="mt-2 bg-bg-secondary border border-border-light rounded-lg p-2">
                  <p className="text-xs font-mono text-text-secondary break-all">
                    {t('errorCode')} {errorCode}
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
                className="btn-apple-tinted active-scale-apple focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900 text-sm"
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
                {t('retry')}
              </button>
            )}

            {/* Report Problem Button */}
            {showReportButton && (
              <button
                onClick={handleReport}
                className="btn-apple-gray active-scale-apple focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900 text-sm"
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
                {t('reportProblem')}
              </button>
            )}

            {/* Copy Error Button */}
            {showCopyButton && (
              <button
                onClick={handleCopy}
                className="btn-apple-gray active-scale-apple focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900 text-sm"
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
                    {t('copied')}
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
                    {t('copyDetails')}
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
  const t = useTranslations('Errors')
  const errorMessage = getUserErrorMessage(error, t)

  return (
    <div className="text-error text-apple-caption" >
      {errorMessage.title}
    </div>
  )
}

export default ErrorDisplay
