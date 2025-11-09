'use client'

import React, { Component, ReactNode, ErrorInfo } from 'react'
import { logComponentError, addBreadcrumb } from '@/lib/errorLogger'
import { useTranslations } from 'next-intl'

/**
 * Error Boundary Props
 */
interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode
  /** Custom fallback UI (optional) */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Error callback for logging (optional) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Name/ID for this boundary (for logging purposes) */
  boundaryName?: string
  /** Translations object (provided by wrapper) */
  translations?: {
    errorBoundaryTitle: string
    errorBoundaryTitleWithName: string
    errorBoundaryDescription: string
    retry: string
    technicalDetails: string
  }
}

/**
 * Error Boundary State
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Reusable Error Boundary Component
 *
 * This is a generic React Error Boundary that can be used to wrap any component.
 * It catches JavaScript errors anywhere in the child component tree.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary
 *   boundaryName="CurrencySection"
 *   fallback={(error, reset) => <CustomErrorUI error={error} onRetry={reset} />}
 *   onError={(error, errorInfo) => console.log('Error in CurrencySection:', error)}
 * >
 *   <CurrencyComponent />
 * </ErrorBoundary>
 * ```
 *
 * Features:
 * - Catches errors in children components
 * - Prevents entire app crash
 * - Provides reset functionality
 * - Supports custom fallback UI
 * - Supports error logging callbacks
 * - Production-ready error handling
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  /**
   * Log error when caught
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, boundaryName } = this.props

    // Log to console
    console.error(
      `🔴 ErrorBoundary ${boundaryName ? `"${boundaryName}"` : ''} caught an error:`,
      error,
      errorInfo
    )

    // Add breadcrumb for user action tracking
    addBreadcrumb({
      category: 'error',
      message: `Error caught in ${boundaryName || 'ErrorBoundary'}`,
      level: 'error',
      data: {
        boundaryName: boundaryName || 'ErrorBoundary',
        errorMessage: error.message,
      },
    })

    // Log to error monitoring service
    logComponentError(
      error,
      boundaryName || 'ErrorBoundary',
      errorInfo.componentStack || undefined,
      'Component render error'
    )

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }
  }

  /**
   * Reset error state
   */
  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback, boundaryName, translations } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.resetError)
      }

      // Get translated text (with fallback to English)
      const t = translations || {
        errorBoundaryTitle: 'Error displaying section',
        errorBoundaryTitleWithName: 'Error displaying section "{section}"',
        errorBoundaryDescription: 'Unfortunately, a problem occurred while displaying this section.',
        retry: 'Try again',
        technicalDetails: 'Technical details (development only)',
      }

      const title = boundaryName
        ? t.errorBoundaryTitleWithName.replace('{section}', boundaryName)
        : t.errorBoundaryTitle

      // Default fallback UI
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-4" >
          <div className="flex items-start gap-3">
            {/* Error Icon */}
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-600"
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

            {/* Error Content */}
            <div className="flex-1">
              <h3 className="text-red-900 font-semibold mb-1">
                {title}
              </h3>
              <p className="text-red-700 text-sm mb-3">
                {t.errorBoundaryDescription}
              </p>

              {/* Error details in development */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mb-3">
                  <summary className="cursor-pointer text-xs text-red-600 hover:text-red-800 select-none">
                    {t.technicalDetails}
                  </summary>
                  <div className="mt-2 bg-white border border-red-300 rounded p-2 overflow-auto max-h-32">
                    <p className="text-xs font-mono text-red-900 break-all">
                      {error.message}
                    </p>
                  </div>
                </details>
              )}

              {/* Reset Button */}
              <button
                onClick={this.resetError}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm font-medium"
              >
                {t.retry}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // No error, render children normally
    return children
  }
}

/**
 * Wrapper component that provides translations to ErrorBoundary
 */
export function ErrorBoundaryWithTranslations({
  children,
  ...props
}: Omit<ErrorBoundaryProps, 'translations'>) {
  const t = useTranslations('Errors')

  const translations = {
    errorBoundaryTitle: t('errorBoundaryTitle'),
    errorBoundaryTitleWithName: t('errorBoundaryTitleWithName'),
    errorBoundaryDescription: t('errorBoundaryDescription'),
    retry: t('retry'),
    technicalDetails: t('technicalDetails'),
  }

  return (
    <ErrorBoundary {...props} translations={translations}>
      {children}
    </ErrorBoundary>
  )
}

/**
 * Hook-based wrapper for functional components
 * (Note: This is just a wrapper, the actual Error Boundary is still a class)
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children' | 'translations'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundaryWithTranslations {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundaryWithTranslations>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`

  return WrappedComponent
}

export default ErrorBoundaryWithTranslations
