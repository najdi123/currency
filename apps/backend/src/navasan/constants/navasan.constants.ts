/**
 * Navasan Service Constants
 *
 * Centralized configuration values for the Navasan service
 */

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  FRESH: 5 * 60 * 1000, // 5 minutes
  STALE: 7 * 24 * 60 * 60 * 1000, // 7 days
  OHLC: 60 * 60 * 1000, // 1 hour
  HISTORICAL: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Request timing
export const REQUEST_TIMING = {
  MAX_CONCURRENT: 5, // Maximum concurrent API requests
  API_TIMEOUT: 10000, // 10 seconds
  RETRY_DELAY: 1000, // 1 second between retries
} as const;

// Circuit breaker configuration
export const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 10, // Open circuit after 10 failures
  RESET_TIMEOUT: 60000, // Reset after 1 minute
  HALF_OPEN_MAX_CALLS: 3, // Max calls in half-open state
} as const;

// Time windows
export const TIME_WINDOWS = {
  HOURS_IN_WEEK: 168,
  SECONDS_IN_HOUR: 3600,
  MILLISECONDS_IN_SECOND: 1000,
  MINUTES_IN_HOUR: 60,
} as const;

// Data validation
export const VALIDATION = {
  MAX_URL_LENGTH: 50,
  MAX_CATEGORY_LENGTH: 50,
  SAFE_CATEGORY_PATTERN: /^[a-zA-Z0-9_-]+$/,
  MAX_DAYS_HISTORY: 365,
  MIN_DAYS_HISTORY: 1,
} as const;

// Snapshot configuration
export const SNAPSHOT = {
  INTERVAL_HOURS: 1, // Take snapshots every hour
  RETENTION_DAYS: 90, // Keep snapshots for 90 days
} as const;

// Item categories and codes
export const ITEM_CATEGORIES = {
  currencies: [
    'usd_sell',
    'usd_buy',
    'eur_sell',
    'eur_buy',
    'gbp_sell',
    'gbp_buy',
    'aed_sell',
    'aed_buy',
    'try_sell',
    'try_buy',
  ],
  crypto: ['btc', 'eth', 'usdt', 'bnb', 'xrp', 'ada', 'doge', 'ltc'],
  gold: ['gold_mesghal', 'gold_geram18', 'gold_ons', 'sekee', 'gold_nim'],
} as const;

// API endpoints
export const API_ENDPOINTS = {
  CURRENCIES: '/price',
  CRYPTO: '/digital-currency/price',
  GOLD: '/gold',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_CATEGORY: 'Invalid category parameter',
  INVALID_URL: 'Invalid URL format',
  CIRCUIT_OPEN: 'Circuit breaker is open - too many recent failures',
  API_TIMEOUT: 'API request timed out',
  NO_DATA_AVAILABLE: 'No data available',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
} as const;

// Type helpers
export type ItemCategory = keyof typeof ITEM_CATEGORIES;
export type ItemCode = typeof ITEM_CATEGORIES[ItemCategory][number];
