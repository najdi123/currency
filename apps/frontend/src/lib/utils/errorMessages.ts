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
 * Translation keys for error messages
 */
export interface ErrorTranslations {
  (key: string): string
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserErrorMessage(error: unknown, t?: ErrorTranslations): UserErrorMessage {
  // Network/Connection Errors
  if (isFetchBaseQueryError(error)) {
    if (isConnectionError(error)) {
      return {
        title: t ? t('connectionErrorTitle') : 'Connection error',
        description: t ? t('connectionErrorDescription') : 'Unable to connect to server. Please check your internet connection.',
        suggestedActions: t ? [
          t('connectionErrorAction1'),
          t('connectionErrorAction2'),
          t('connectionErrorAction3'),
        ] : [
          'Check your internet connection',
          'Make sure WiFi or mobile data is enabled',
          'Wait a moment and try again',
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
        title: t ? t('timeoutTitle') : 'Request timed out',
        description: t ? t('timeoutDescription') : 'The server response took longer than usual. This may be due to slow internet connection or temporary server issue.',
        suggestedActions: t ? [
          t('timeoutAction1'),
          t('timeoutAction2'),
          t('timeoutAction3'),
        ] : [
          'Check your internet speed',
          'Wait a few minutes and try again',
          'If the problem persists, contact support',
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
        title: t ? t('parsingErrorTitle') : 'Data processing error',
        description: t ? t('parsingErrorDescription') : 'The data received from the server cannot be processed. This issue is likely temporary.',
        suggestedActions: t ? [
          t('parsingErrorAction1'),
          t('parsingErrorAction2'),
          t('parsingErrorAction3'),
        ] : [
          'Refresh the page',
          'Wait a moment and try again',
          'If the problem persists, contact support',
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
        title: t ? t('badRequestTitle') : 'Invalid request',
        description: t ? t('badRequestDescription') : 'The submitted information is incorrect. Please make sure all fields are filled correctly.',
        suggestedActions: t ? [
          t('badRequestAction1'),
          t('badRequestAction2'),
          t('badRequestAction3'),
        ] : [
          'Review the entered information',
          'Fill in all required fields',
          'Ensure data format is correct',
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
        title: t ? t('unauthorizedTitle') : 'Login required',
        description: t ? t('unauthorizedDescription') : 'You need to log in to your account to access this section.',
        suggestedActions: t ? [
          t('unauthorizedAction1'),
          t('unauthorizedAction2'),
        ] : [
          'Log in to your account',
          'If already logged in, log out and log in again',
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
        title: t ? t('forbiddenTitle') : 'Access denied',
        description: t ? t('forbiddenDescription') : 'You do not have permission to access this section.',
        suggestedActions: t ? [
          t('forbiddenAction1'),
          t('forbiddenAction2'),
        ] : [
          'Make sure you are logged in with the correct account',
          'If you think you should have access, contact support',
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
        title: t ? t('notFoundTitle') : 'Data not found',
        description: t ? t('notFoundDescription') : 'The requested information is not available on the server. It may have been deleted or moved.',
        suggestedActions: t ? [
          t('notFoundAction1'),
          t('notFoundAction2'),
          t('notFoundAction3'),
        ] : [
          'Check the page address',
          'Return to the homepage and search again',
          'If the problem persists, contact support',
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
        title: t ? t('tooManyRequestsTitle') : 'Too many requests',
        description: t ? t('tooManyRequestsDescription') : 'You have sent too many requests in a short period. Please wait.',
        suggestedActions: t ? [
          t('tooManyRequestsAction1'),
          t('tooManyRequestsAction2'),
          t('tooManyRequestsAction3'),
        ] : [
          'Wait a few minutes',
          'Avoid sending repeated requests',
          'Try again',
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
        title: t ? t('serverErrorTitle') : 'Server error',
        description: t ? t('serverErrorDescription') : 'A problem occurred on the server. The technical team is reviewing the issue.',
        suggestedActions: t ? [
          t('serverErrorAction1'),
          t('serverErrorAction2'),
          t('serverErrorAction3'),
        ] : [
          'Wait a few minutes and try again',
          'Refresh the page',
          'If the problem persists, contact support',
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
        title: t ? t('badGatewayTitle') : 'Server communication error',
        description: t ? t('badGatewayDescription') : 'The server is temporarily unavailable. This issue is usually resolved quickly.',
        suggestedActions: t ? [
          t('badGatewayAction1'),
          t('badGatewayAction2'),
          t('badGatewayAction3'),
        ] : [
          'Wait a moment',
          'Refresh the page',
          'Try again',
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
        title: t ? t('serviceUnavailableTitle') : 'Service unavailable',
        description: t ? t('serviceUnavailableDescription') : 'The server is currently unable to respond. It may be under maintenance.',
        suggestedActions: t ? [
          t('serviceUnavailableAction1'),
          t('serviceUnavailableAction2'),
          t('serviceUnavailableAction3'),
        ] : [
          'Wait a few minutes',
          'Try again',
          'If the problem persists, check back later',
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
        title: t ? t('genericServerErrorTitle') : 'Server issue',
        description: t ? t('genericServerErrorDescription') : 'The server has encountered a problem. Please check back later.',
        suggestedActions: t ? [
          t('genericServerErrorAction1'),
          t('genericServerErrorAction2'),
          t('genericServerErrorAction3'),
        ] : [
          'Wait a few minutes',
          'Try again',
          'If the problem persists, contact support',
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
    title: t ? t('unexpectedErrorTitle') : 'Unexpected error',
    description: t ? t('unexpectedErrorDescription') : 'Unfortunately, something went wrong. Please try again.',
    suggestedActions: t ? [
      t('unexpectedErrorAction1'),
      t('unexpectedErrorAction2'),
      t('unexpectedErrorAction3'),
    ] : [
      'Refresh the page',
      'Try again',
      'If the problem persists, contact support',
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
export function getShortErrorMessage(error: unknown, t?: ErrorTranslations): string {
  const message = getUserErrorMessage(error, t)
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
