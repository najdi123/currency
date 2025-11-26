/**
 * Market Data Service Constants
 *
 * Centralized configuration values for the MarketData service
 * Provider-agnostic naming for flexibility with different API providers
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
  MAX_RETRIES: 3, // Maximum retry attempts
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
  SEARCH_WINDOW_HOURS: 6, // Search window for finding closest snapshot
} as const;

// Valid categories
export const VALID_CATEGORIES = ['all', 'currencies', 'crypto', 'gold', 'coins'] as const;

// Item codes by category (UPPERCASE for ohlc_permanent storage)
export const CATEGORY_ITEM_CODES = {
  currencies: [
    'USD_SELL',
    'USD_BUY',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'AED',
    'AED_SELL',
    'DIRHAM_DUBAI',
    'CNY',
    'TRY',
    'CHF',
    'JPY',
    'RUB',
    'INR',
    'PKR',
    'IQD',
    'KWD',
    'SAR',
    'QAR',
    'OMR',
    'BHD',
  ],
  crypto: [
    'USDT',
    'BTC',
    'ETH',
    'BNB',
    'XRP',
    'ADA',
    'DOGE',
    'SOL',
    'MATIC',
    'DOT',
    'LTC',
  ],
  gold: [
    'SEKKEH',
    'BAHAR',
    'NIM',
    'ROB',
    'GERAMI',
    '18AYAR',
    'ABSHODEH',
  ],
  coins: [
    'SEKKEH',
    'BAHAR',
    'NIM',
    'ROB',
    'GERAMI',
  ],
} as const;

// Item strings for API requests (lowercase, comma-separated)
export const CATEGORY_ITEMS = {
  all: 'usd_sell,eur,gbp,cad,aud,aed,aed_sell,dirham_dubai,cny,try,chf,jpy,rub,inr,pkr,iqd,kwd,sar,qar,omr,bhd,usd_buy,dolar_harat_sell,harat_naghdi_sell,harat_naghdi_buy,usd_farda_sell,usd_farda_buy,usd_shakhs,usd_sherkat,usd_pp,dolar_mashad_sell,dolar_kordestan_sell,dolar_soleimanie_sell,eur_hav,gbp_hav,gbp_wht,cad_hav,cad_cash,hav_cad_my,hav_cad_cheque,hav_cad_cash,aud_hav,aud_wht,usdt,btc,eth,bnb,xrp,ada,doge,sol,matic,dot,ltc,sekkeh,bahar,nim,rob,gerami,18ayar,abshodeh',
  currencies: 'usd_sell,eur,gbp,cad,aud,aed,aed_sell,dirham_dubai,cny,try,chf,jpy,rub,inr,pkr,iqd,kwd,sar,qar,omr,bhd,usd_buy,dolar_harat_sell,harat_naghdi_sell,harat_naghdi_buy,usd_farda_sell,usd_farda_buy,usd_shakhs,usd_sherkat,usd_pp,dolar_mashad_sell,dolar_kordestan_sell,dolar_soleimanie_sell,eur_hav,gbp_hav,gbp_wht,cad_hav,cad_cash,hav_cad_my,hav_cad_cheque,hav_cad_cash,aud_hav,aud_wht',
  crypto: 'usdt,btc,eth,bnb,xrp,ada,doge,sol,matic,dot,ltc',
  gold: 'sekkeh,bahar,nim,rob,gerami,18ayar,abshodeh',
  coins: 'sekkeh,bahar,nim,rob,gerami',
} as const;

// Gold items that need to be multiplied by 1000 (stored in thousands)
export const GOLD_MULTIPLIER_ITEMS = ['sekkeh', 'bahar', 'nim', 'rob', 'gerami'] as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_CATEGORY: 'Invalid category parameter',
  INVALID_URL: 'Invalid URL format',
  CIRCUIT_OPEN: 'Circuit breaker is open - too many recent failures',
  API_TIMEOUT: 'API request timed out',
  NO_DATA_AVAILABLE: 'No data available',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  FUTURE_DATE: 'Target date cannot be in the future',
  CATEGORY_TOO_LONG: 'Category name too long',
  CATEGORY_INVALID_CHARS: 'Category contains invalid characters',
} as const;

// Type helpers
export type ItemCategory = 'all' | 'currencies' | 'crypto' | 'gold' | 'coins';
export type ValidCategory = typeof VALID_CATEGORIES[number];
