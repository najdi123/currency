/**
 * Type-Safe Error Definitions
 *
 * This module provides comprehensive type definitions for all error types
 * in the application, along with type guards for type-safe error handling.
 */

import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'

/**
 * HTTP Error Status Codes
 */
export type HttpStatusCode =
  | 400 // Bad Request
  | 401 // Unauthorized
  | 403 // Forbidden
  | 404 // Not Found
  | 429 // Too Many Requests
  | 500 // Internal Server Error
  | 502 // Bad Gateway
  | 503 // Service Unavailable
  | number // Other status codes

/**
 * Network Error Types
 */
export type NetworkErrorType =
  | 'FETCH_ERROR'      // Network request failed
  | 'PARSING_ERROR'    // JSON parsing failed
  | 'TIMEOUT_ERROR'    // Request timeout
  | 'CUSTOM_ERROR'     // Custom error

/**
 * API Error - HTTP errors from the backend
 */
export interface ApiError {
  type: 'api'
  status: HttpStatusCode
  data?: {
    message?: string
    error?: string
    statusCode?: number
    [key: string]: unknown
  }
}

/**
 * Network Error - Connection/parsing/timeout errors
 */
export interface NetworkError {
  type: 'network'
  status: NetworkErrorType
  error?: string
  originalStatus?: number
}

/**
 * Validation Error - Client-side validation failures
 */
export interface ValidationError {
  type: 'validation'
  field: string
  message: string
  value?: unknown
}

/**
 * Generic Application Error
 */
export interface AppError {
  type: 'app'
  message: string
  code?: string
  details?: unknown
}

/**
 * Union type of all possible errors
 */
export type ApplicationError =
  | ApiError
  | NetworkError
  | ValidationError
  | AppError
  | SerializedError

/**
 * RTK Query Error Union
 */
export type RtkQueryError = FetchBaseQueryError | SerializedError | undefined

/**
 * Error with user-friendly message
 */
export interface ErrorWithMessage {
  message: string
  code?: string | number
  details?: unknown
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is FetchBaseQueryError
 */
export function isFetchBaseQueryError(
  error: unknown
): error is FetchBaseQueryError {
  return typeof error === 'object' && error != null && 'status' in error
}

/**
 * Check if error is SerializedError (from RTK)
 */
export function isSerializedError(error: unknown): error is SerializedError {
  return (
    typeof error === 'object' &&
    error != null &&
    'name' in error &&
    'message' in error
  )
}

/**
 * Check if error is HTTP error (status is number)
 */
export function isHttpError(
  error: FetchBaseQueryError
): error is FetchBaseQueryError & { status: number } {
  return typeof error.status === 'number'
}

/**
 * Check if error is network error (status is string)
 */
export function isNetworkError(
  error: FetchBaseQueryError
): error is FetchBaseQueryError & { status: NetworkErrorType } {
  return typeof error.status === 'string'
}

/**
 * Check if error is specific HTTP status code
 */
export function isStatusCode(
  error: FetchBaseQueryError,
  statusCode: HttpStatusCode
): error is FetchBaseQueryError & { status: typeof statusCode } {
  return error.status === statusCode
}

/**
 * Check if error is 4xx client error
 */
export function isClientError(error: FetchBaseQueryError): boolean {
  return typeof error.status === 'number' && error.status >= 400 && error.status < 500
}

/**
 * Check if error is 5xx server error
 */
export function isServerError(error: FetchBaseQueryError): boolean {
  return typeof error.status === 'number' && error.status >= 500 && error.status < 600
}

/**
 * Check if error is unauthorized (401)
 */
export function isUnauthorizedError(error: FetchBaseQueryError): boolean {
  return error.status === 401
}

/**
 * Check if error is forbidden (403)
 */
export function isForbiddenError(error: FetchBaseQueryError): boolean {
  return error.status === 403
}

/**
 * Check if error is not found (404)
 */
export function isNotFoundError(error: FetchBaseQueryError): boolean {
  return error.status === 404
}

/**
 * Check if error is rate limit (429)
 */
export function isRateLimitError(error: FetchBaseQueryError): boolean {
  return error.status === 429
}

/**
 * Check if error is connection error
 */
export function isConnectionError(error: FetchBaseQueryError): boolean {
  return error.status === 'FETCH_ERROR'
}

/**
 * Check if error is parsing error
 */
export function isParsingError(error: FetchBaseQueryError): boolean {
  return error.status === 'PARSING_ERROR'
}

/**
 * Check if error is timeout error
 */
export function isTimeoutError(error: FetchBaseQueryError): boolean {
  return error.status === 'TIMEOUT_ERROR'
}

// ============================================================================
// Error Message Extraction
// ============================================================================

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return 'خطای ناشناخته رخ داده است.'
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error
  }

  // Handle FetchBaseQueryError
  if (isFetchBaseQueryError(error)) {
    // Check if data has message
    if (error.data && typeof error.data === 'object' && 'message' in error.data) {
      const message = (error.data as { message?: unknown }).message
      if (typeof message === 'string') {
        return message
      }
    }

    // Check if error has error property
    if ('error' in error && typeof error.error === 'string') {
      return error.error
    }

    // Fall back to status-based message
    return getStatusMessage(error.status)
  }

  // Handle SerializedError
  if (isSerializedError(error)) {
    return error.message || 'خطای ناشناخته رخ داده است.'
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message
  }

  // Handle objects with message property
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }

  // Default fallback
  return 'خطای ناشناخته رخ داده است.'
}

/**
 * Get user-friendly message based on status code/type
 */
function getStatusMessage(status: number | string): string {
  if (typeof status === 'string') {
    switch (status) {
      case 'FETCH_ERROR':
        return 'خطا در اتصال به سرور. لطفاً اتصال اینترنت خود را بررسی کنید.'
      case 'PARSING_ERROR':
        return 'خطا در پردازش داده‌ها دریافتی از سرور.'
      case 'TIMEOUT_ERROR':
        return 'زمان درخواست به پایان رسید. لطفاً دوباره تلاش کنید.'
      case 'CUSTOM_ERROR':
        return 'خطای سفارشی رخ داده است.'
      default:
        return 'خطای ناشناخته رخ داده است.'
    }
  }

  switch (status) {
    case 400:
      return 'درخواست نامعتبر است.'
    case 401:
      return 'لطفاً وارد حساب کاربری خود شوید.'
    case 403:
      return 'شما دسترسی به این بخش را ندارید.'
    case 404:
      return 'داده مورد نظر یافت نشد.'
    case 429:
      return 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کنید.'
    case 500:
      return 'خطای سرور. لطفاً بعداً تلاش کنید.'
    case 502:
      return 'خطا در ارتباط با سرور. لطفاً بعداً تلاش کنید.'
    case 503:
      return 'سرور در حال حاضر در دسترس نیست. لطفاً بعداً تلاش کنید.'
    default:
      return `خطای سرور (کد ${status})`
  }
}

/**
 * Extract error code from error
 */
export function getErrorCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  // Check FetchBaseQueryError status
  if (isFetchBaseQueryError(error)) {
    return error.status
  }

  // Check for code property
  if ('code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' || typeof code === 'number') {
      return code
    }
  }

  // Check for statusCode property
  if ('statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode
    if (typeof statusCode === 'number') {
      return statusCode
    }
  }

  return undefined
}

/**
 * Extract error details from error
 */
export function getErrorDetails(error: unknown): unknown {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  // Check for details property
  if ('details' in error) {
    return (error as { details?: unknown }).details
  }

  // Check for data property (FetchBaseQueryError)
  if (isFetchBaseQueryError(error) && error.data) {
    return error.data
  }

  return undefined
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format error for display
 */
export function formatError(error: unknown): ErrorWithMessage {
  return {
    message: getErrorMessage(error),
    code: getErrorCode(error),
    details: getErrorDetails(error),
  }
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: unknown): {
  message: string
  code?: string | number
  status?: number | string
  data?: unknown
  stack?: string
} {
  const formatted: ReturnType<typeof formatErrorForLogging> = {
    message: getErrorMessage(error),
    code: getErrorCode(error),
  }

  if (isFetchBaseQueryError(error)) {
    formatted.status = error.status
    formatted.data = error.data
  }

  if (error instanceof Error) {
    formatted.stack = error.stack
  }

  return formatted
}

// ============================================================================
// Error Creation Helpers
// ============================================================================

/**
 * Create API error
 */
export function createApiError(
  status: HttpStatusCode,
  data?: ApiError['data']
): ApiError {
  return {
    type: 'api',
    status,
    data,
  }
}

/**
 * Create network error
 */
export function createNetworkError(
  status: NetworkErrorType,
  error?: string
): NetworkError {
  return {
    type: 'network',
    status,
    error,
  }
}

/**
 * Create validation error
 */
export function createValidationError(
  field: string,
  message: string,
  value?: unknown
): ValidationError {
  return {
    type: 'validation',
    field,
    message,
    value,
  }
}

/**
 * Create app error
 */
export function createAppError(
  message: string,
  code?: string,
  details?: unknown
): AppError {
  return {
    type: 'app',
    message,
    code,
    details,
  }
}
