/**
 * Error Logging Service
 *
 * Abstraction layer for error monitoring services (Sentry, LogRocket, etc.)
 * Provides a unified interface for logging errors with context and metadata.
 *
 * Features:
 * - Environment-aware (only logs in production by default)
 * - Support for multiple monitoring services
 * - Context tracking (user actions, component stack, API calls)
 * - Performance metrics
 * - Breadcrumb support for debugging
 */

import { config } from '@/lib/config'
import { formatErrorForLogging } from '@/types/errors'

/**
 * Error severity levels
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

/**
 * Error context - additional information about the error
 */
export interface ErrorContext {
  /** Component or service where error occurred */
  component?: string
  /** User action that triggered the error */
  action?: string
  /** Additional tags for categorization */
  tags?: Record<string, string>
  /** Extra metadata */
  extra?: Record<string, unknown>
  /** User information (non-sensitive) */
  user?: {
    id?: string
    username?: string
    email?: string
  }
  /** Request information (for API errors) */
  request?: {
    url?: string
    method?: string
    endpoint?: string
    params?: unknown
    duration?: number
  }
  /** Component stack trace (from React Error Boundary) */
  componentStack?: string
  /** Application state snapshot */
  state?: unknown
}

/**
 * Breadcrumb - track user actions leading to error
 */
export interface Breadcrumb {
  /** Breadcrumb category (navigation, http, user, etc.) */
  category: 'navigation' | 'http' | 'user' | 'console' | 'error' | 'custom'
  /** Breadcrumb message */
  message: string
  /** Breadcrumb level */
  level?: ErrorSeverity
  /** Timestamp */
  timestamp?: number
  /** Additional data */
  data?: Record<string, unknown>
}

/**
 * Error monitoring service interface
 */
interface ErrorMonitoringService {
  /** Initialize the service */
  init(): void
  /** Log an error */
  captureException(error: Error, context?: ErrorContext): void
  /** Log a message */
  captureMessage(message: string, level?: ErrorSeverity, context?: ErrorContext): void
  /** Add breadcrumb */
  addBreadcrumb(breadcrumb: Breadcrumb): void
  /** Set user context */
  setUser(user: ErrorContext['user']): void
  /** Set tags */
  setTags(tags: Record<string, string>): void
  /** Set extra context */
  setExtra(key: string, value: unknown): void
}

/**
 * Console-based error logger (fallback/development)
 */
class ConsoleLogger implements ErrorMonitoringService {
  private breadcrumbs: Breadcrumb[] = []
  private userContext: ErrorContext['user'] = {}
  private tags: Record<string, string> = {}
  private extras: Record<string, unknown> = {}

  init(): void {
    console.log('📋 Console error logger initialized (development mode)')
  }

  captureException(error: Error, context?: ErrorContext): void {
    const formatted = formatErrorForLogging(error)

    console.group('🔴 Error Logged')
    console.error('Error:', error)
    console.log('Formatted:', formatted)

    if (context) {
      console.log('Context:', context)
    }

    if (this.breadcrumbs.length > 0) {
      console.log('Breadcrumbs:', this.breadcrumbs)
    }

    if (this.userContext && Object.keys(this.userContext).length > 0) {
      console.log('User:', this.userContext)
    }

    if (Object.keys(this.tags).length > 0) {
      console.log('Tags:', this.tags)
    }

    if (Object.keys(this.extras).length > 0) {
      console.log('Extra:', this.extras)
    }

    console.groupEnd()
  }

  captureMessage(message: string, level: ErrorSeverity = 'info', context?: ErrorContext): void {
    const emoji = {
      fatal: '💀',
      error: '🔴',
      warning: '⚠️',
      info: 'ℹ️',
      debug: '🐛',
    }[level]

    console.log(`${emoji} [${level.toUpperCase()}] ${message}`, context || '')
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now(),
      level: breadcrumb.level || 'info',
    })

    // Keep only last 50 breadcrumbs
    if (this.breadcrumbs.length > 50) {
      this.breadcrumbs.shift()
    }

    if (config.isDevelopment) {
      console.log('🍞 Breadcrumb:', breadcrumb)
    }
  }

  setUser(user: ErrorContext['user']): void {
    this.userContext = { ...this.userContext, ...user }
  }

  setTags(tags: Record<string, string>): void {
    this.tags = { ...this.tags, ...tags }
  }

  setExtra(key: string, value: unknown): void {
    this.extras[key] = value
  }
}

/**
 * Sentry error logger (production)
 *
 * To enable Sentry:
 * 1. Install: npm install @sentry/nextjs
 * 2. Run: npx @sentry/wizard -i nextjs
 * 3. Add NEXT_PUBLIC_SENTRY_DSN to .env.local
 * 4. Uncomment the Sentry implementation below
 */
class SentryLogger implements ErrorMonitoringService {
  private isInitialized = false

  init(): void {
    // TODO: Uncomment when Sentry is installed
    // if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    //   Sentry.init({
    //     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    //     environment: config.nodeEnv,
    //     tracesSampleRate: config.isProduction ? 0.1 : 1.0,
    //     beforeSend(event, hint) {
    //       // Filter sensitive data
    //       return event
    //     },
    //   })
    //   this.isInitialized = true
    //   console.log('✅ Sentry initialized')
    // }

    console.warn(
      '⚠️  Sentry not configured. Install @sentry/nextjs and set NEXT_PUBLIC_SENTRY_DSN to enable.'
    )
  }

  captureException(error: Error, context?: ErrorContext): void {
    if (!this.isInitialized) {
      // Fallback to console in development
      if (config.isDevelopment) {
        console.error('Sentry not initialized. Error:', error, 'Context:', context)
      }
      return
    }

    // TODO: Uncomment when Sentry is installed
    // Sentry.captureException(error, {
    //   tags: context?.tags,
    //   extra: {
    //     ...context?.extra,
    //     component: context?.component,
    //     action: context?.action,
    //     request: context?.request,
    //     componentStack: context?.componentStack,
    //   },
    //   user: context?.user,
    // })
  }

  captureMessage(message: string, level: ErrorSeverity = 'info', context?: ErrorContext): void {
    if (!this.isInitialized) return

    // TODO: Uncomment when Sentry is installed
    // Sentry.captureMessage(message, {
    //   level: level as Sentry.SeverityLevel,
    //   tags: context?.tags,
    //   extra: context?.extra,
    //   user: context?.user,
    // })
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    if (!this.isInitialized) return

    // TODO: Uncomment when Sentry is installed
    // Sentry.addBreadcrumb({
    //   category: breadcrumb.category,
    //   message: breadcrumb.message,
    //   level: breadcrumb.level as Sentry.SeverityLevel,
    //   timestamp: breadcrumb.timestamp ? breadcrumb.timestamp / 1000 : undefined,
    //   data: breadcrumb.data,
    // })
  }

  setUser(user: ErrorContext['user']): void {
    if (!this.isInitialized) return

    // TODO: Uncomment when Sentry is installed
    // Sentry.setUser(user || null)
  }

  setTags(tags: Record<string, string>): void {
    if (!this.isInitialized) return

    // TODO: Uncomment when Sentry is installed
    // Sentry.setTags(tags)
  }

  setExtra(key: string, value: unknown): void {
    if (!this.isInitialized) return

    // TODO: Uncomment when Sentry is installed
    // Sentry.setExtra(key, value)
  }
}

/**
 * Error logger class - singleton
 */
class ErrorLogger {
  private service: ErrorMonitoringService
  private isInitialized = false

  constructor() {
    // Use Sentry in production, console in development
    if (config.isProduction) {
      this.service = new SentryLogger()
    } else {
      this.service = new ConsoleLogger()
    }
  }

  /**
   * Initialize error logging service
   * Call this once during app startup
   */
  init(): void {
    if (this.isInitialized) {
      console.warn('Error logger already initialized')
      return
    }

    this.service.init()
    this.isInitialized = true

    // Set default tags
    this.service.setTags({
      environment: config.nodeEnv,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
    })

    // Log initialization
    if (config.isDevelopment) {
      console.log('✅ Error logger initialized')
    }
  }

  /**
   * Log an error
   */
  logError(error: Error | unknown, context?: ErrorContext): void {
    // Convert unknown to Error
    const errorObj = error instanceof Error ? error : new Error(String(error))

    this.service.captureException(errorObj, context)
  }

  /**
   * Log a message
   */
  logMessage(message: string, level: ErrorSeverity = 'info', context?: ErrorContext): void {
    this.service.captureMessage(message, level, context)
  }

  /**
   * Add breadcrumb (track user actions)
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.service.addBreadcrumb(breadcrumb)
  }

  /**
   * Set user context (call after user login)
   */
  setUser(user: ErrorContext['user']): void {
    this.service.setUser(user)
  }

  /**
   * Clear user context (call after user logout)
   */
  clearUser(): void {
    this.service.setUser({})
  }

  /**
   * Set tags for categorization
   */
  setTags(tags: Record<string, string>): void {
    this.service.setTags(tags)
  }

  /**
   * Set extra context
   */
  setExtra(key: string, value: unknown): void {
    this.service.setExtra(key, value)
  }

  /**
   * Log API error with request details
   */
  logApiError(
    error: Error | unknown,
    endpoint: string,
    method: string = 'GET',
    params?: unknown,
    duration?: number
  ): void {
    this.logError(error, {
      component: 'RTK Query',
      action: `API Request: ${method} ${endpoint}`,
      tags: {
        api_endpoint: endpoint,
        api_method: method,
      },
      request: {
        endpoint,
        method,
        params,
        duration,
      },
    })
  }

  /**
   * Log React component error
   */
  logComponentError(
    error: Error | unknown,
    componentName: string,
    componentStack?: string,
    action?: string
  ): void {
    this.logError(error, {
      component: componentName,
      action,
      componentStack,
      tags: {
        error_boundary: componentName,
      },
    })
  }

  /**
   * Log performance issue
   */
  logPerformance(metric: string, value: number, context?: Partial<ErrorContext>): void {
    this.logMessage(`Performance: ${metric} = ${value}ms`, 'info', {
      ...context,
      extra: {
        ...context?.extra,
        metric,
        value,
      },
    })
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger()

// Convenience functions
export const logError = (error: Error | unknown, context?: ErrorContext) =>
  errorLogger.logError(error, context)

export const logMessage = (message: string, level?: ErrorSeverity, context?: ErrorContext) =>
  errorLogger.logMessage(message, level, context)

export const addBreadcrumb = (breadcrumb: Breadcrumb) =>
  errorLogger.addBreadcrumb(breadcrumb)

export const setUser = (user: ErrorContext['user']) =>
  errorLogger.setUser(user)

export const clearUser = () =>
  errorLogger.clearUser()

export const logApiError = (
  error: Error | unknown,
  endpoint: string,
  method?: string,
  params?: unknown,
  duration?: number
) => errorLogger.logApiError(error, endpoint, method, params, duration)

export const logComponentError = (
  error: Error | unknown,
  componentName: string,
  componentStack?: string,
  action?: string
) => errorLogger.logComponentError(error, componentName, componentStack, action)

export const logPerformance = (metric: string, value: number, context?: Partial<ErrorContext>) =>
  errorLogger.logPerformance(metric, value, context)
