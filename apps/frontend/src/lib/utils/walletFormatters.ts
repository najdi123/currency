import type { CurrencyType, TransactionReason, TransactionDirection } from '@/lib/store/services/walletApi'

/**
 * Format amount with proper decimal places and thousands separators
 * @param amount - The amount as string or number
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted amount string
 */
export function formatAmount(amount: string | number, decimals: number = 2): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(numAmount)) {
    return '0.00'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numAmount)
}

/**
 * Format currency with symbol and amount
 * @param amount - The amount as string or number
 * @param currencyCode - The currency code (e.g., 'USD', 'BTC')
 * @param currencyType - The type of currency (fiat, crypto, gold)
 * @returns Formatted currency string with symbol
 */
export function formatCurrency(
  amount: string | number,
  currencyCode: string,
  currencyType?: CurrencyType
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(numAmount)) {
    return `0 ${currencyCode}`
  }

  // Determine decimal places based on currency type
  let decimals = 2
  if (currencyType === 'crypto') {
    decimals = 8
  } else if (currencyType === 'gold') {
    decimals = 4
  }

  const formattedAmount = formatAmount(numAmount, decimals)

  // Get currency symbol if available
  const symbol = getCurrencySymbol(currencyCode)

  if (symbol && symbol !== currencyCode) {
    return `${symbol}${formattedAmount}`
  }

  return `${formattedAmount} ${currencyCode}`
}

/**
 * Get currency symbol for common currencies
 * @param currencyCode - The currency code
 * @returns Currency symbol or code if not found
 */
export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    IRR: 'ریال',
    BTC: '₿',
    ETH: 'Ξ',
  }

  return symbols[currencyCode.toUpperCase()] || currencyCode
}

/**
 * Get human-readable currency type label with i18n support
 * @param currencyType - The currency type
 * @param t - Translation function from next-intl
 * @returns Localized label
 */
export function getCurrencyTypeLabel(
  currencyType: CurrencyType,
  t: (key: string) => string
): string {
  const labelKeys: Record<CurrencyType, string> = {
    fiat: 'WalletFormatters.fiat',
    crypto: 'WalletFormatters.crypto',
    gold: 'WalletFormatters.gold',
  }

  return t(labelKeys[currencyType])
}

/**
 * Get human-readable transaction reason label with i18n support
 * @param reason - The transaction reason
 * @param t - Translation function from next-intl
 * @returns Localized label
 */
export function getTransactionReasonLabel(
  reason: TransactionReason,
  t: (key: string) => string
): string {
  const labelKeys: Record<TransactionReason, string> = {
    deposit: 'WalletFormatters.deposit',
    withdrawal: 'WalletFormatters.withdrawal',
    transfer: 'WalletFormatters.transfer',
    adjustment: 'WalletFormatters.adjustment',
  }

  return t(labelKeys[reason])
}

/**
 * Get human-readable transaction direction label with i18n support
 * @param direction - The transaction direction
 * @param t - Translation function from next-intl
 * @returns Localized label
 */
export function getTransactionDirectionLabel(
  direction: TransactionDirection,
  t: (key: string) => string
): string {
  const labelKeys: Record<TransactionDirection, string> = {
    credit: 'WalletFormatters.credit',
    debit: 'WalletFormatters.debit',
  }

  return t(labelKeys[direction])
}

/**
 * Get color class based on transaction direction
 * @param direction - The transaction direction
 * @returns Tailwind color class
 */
export function getDirectionColor(direction: TransactionDirection): string {
  return direction === 'credit' ? 'text-success-text' : 'text-error-text'
}

/**
 * Get icon name based on transaction direction
 * @param direction - The transaction direction
 * @returns Icon identifier
 */
export function getDirectionIcon(direction: TransactionDirection): 'up' | 'down' {
  return direction === 'credit' ? 'up' : 'down'
}

/**
 * Get badge color class based on currency type
 * @param currencyType - The currency type
 * @returns Tailwind badge color classes
 */
export function getCurrencyTypeBadgeColor(currencyType: CurrencyType): string {
  const colors: Record<CurrencyType, string> = {
    fiat: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    crypto: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    gold: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  }

  return colors[currencyType] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
}

/**
 * Validate amount input with i18n error messages
 * @param value - Input value
 * @param maxDecimals - Maximum decimal places allowed
 * @param t - Translation function from next-intl
 * @returns Validation result
 */
export function validateAmount(
  value: string,
  maxDecimals: number = 8,
  t: (key: string, values?: Record<string, any>) => string
): {
  isValid: boolean
  error?: string
} {
  if (!value || value.trim() === '') {
    return { isValid: false, error: t('WalletFormatters.amountRequired') }
  }

  const numValue = parseFloat(value)

  if (isNaN(numValue)) {
    return { isValid: false, error: t('WalletFormatters.amountInvalid') }
  }

  if (numValue <= 0) {
    return { isValid: false, error: t('WalletFormatters.amountPositive') }
  }

  // Check decimal places
  const decimalPart = value.split('.')[1]
  if (decimalPart && decimalPart.length > maxDecimals) {
    return {
      isValid: false,
      error: t('WalletFormatters.amountMaxDecimals', { maxDecimals }),
    }
  }

  // Check if matches backend regex pattern
  const pattern = new RegExp(`^\d+(\.\d{1,${maxDecimals}})?$`)
  if (!pattern.test(value)) {
    return {
      isValid: false,
      error: t('WalletFormatters.amountInvalidFormat'),
    }
  }

  return { isValid: true }
}

/**
 * Validate currency code input with i18n error messages
 * @param value - Currency code value
 * @param t - Translation function from next-intl
 * @returns Validation result
 */
export function validateCurrencyCode(
  value: string,
  t: (key: string, values?: Record<string, any>) => string
): {
  isValid: boolean
  error?: string
} {
  if (!value || value.trim() === '') {
    return { isValid: false, error: t('WalletFormatters.currencyCodeRequired') }
  }

  if (value.length < 3 || value.length > 10) {
    return { isValid: false, error: t('WalletFormatters.currencyCodeLength') }
  }

  if (!/^[A-Z0-9_-]+$/i.test(value)) {
    return {
      isValid: false,
      error: t('WalletFormatters.currencyCodeFormat'),
    }
  }

  return { isValid: true }
}

/**
 * Generate a unique idempotency key
 * @returns UUID v4 string
 */
export function generateIdempotencyKey(): string {
  // Simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
