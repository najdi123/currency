/**
 * Format a number or string as Toman currency with comma separators
 * @param value - The value to format (number or string)
 * @returns Formatted string with commas (e.g., "106,850")
 */
export function formatToman(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '0'

  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) return '0'

  return new Intl.NumberFormat('en-US').format(Math.round(num))
}

/**
 * Format a change amount in Toman with Persian scale units
 * @param change - The change amount in Toman
 * @returns Formatted string with +/- sign and scale (e.g., "+2.5 میلیون تومان", "-800 هزار تومان")
 *
 * Formatting rules (Persian convention):
 * - Under 1,000: Exact number (e.g., "+850 تومان")
 * - 1,000 - 999,999: "هزار تومان" with up to 1 decimal (e.g., "+12.5 هزار تومان")
 * - 1,000,000 - 999,999,999: "میلیون تومان" with up to 2 decimals (e.g., "+2.31 میلیون تومان")
 * - 1 billion+: "میلیارد تومان" with up to 2 decimals (e.g., "+12.13 میلیارد تومان")
 */
export function formatChange(change: number | undefined | null): string {
  if (change === undefined || change === null || change === 0) return '0 تومان'

  const sign = change > 0 ? '+' : '-'
  const absNum = Math.abs(change)

  // Under 1,000: show exact number
  if (absNum < 1000) {
    return `${sign}${new Intl.NumberFormat('en-US').format(Math.round(absNum))} تومان`
  }

  // 1,000 - 999,999: use "هزار تومان" (thousand)
  if (absNum < 1_000_000) {
    const thousands = absNum / 1000
    const formatted = thousands % 1 === 0
      ? thousands.toFixed(0)
      : thousands.toFixed(1)
    return `${sign}${new Intl.NumberFormat('en-US').format(parseFloat(formatted))} هزار تومان`
  }

  // 1,000,000 - 999,999,999: use "میلیون تومان" (million)
  if (absNum < 1_000_000_000) {
    const millions = absNum / 1_000_000
    const formatted = millions % 1 === 0
      ? millions.toFixed(0)
      : millions < 10
        ? millions.toFixed(2) // More precision for single-digit millions
        : millions.toFixed(1) // Less precision for larger numbers
    return `${sign}${new Intl.NumberFormat('en-US').format(parseFloat(formatted))} میلیون تومان`
  }

  // 1 billion+: use "میلیارد تومان" (billion)
  const billions = absNum / 1_000_000_000
  const formatted = billions % 1 === 0
    ? billions.toFixed(0)
    : billions < 10
      ? billions.toFixed(2)
      : billions.toFixed(1)
  return `${sign}${new Intl.NumberFormat('en-US').format(parseFloat(formatted))} میلیارد تومان`
}

/**
 * Format a change amount as separate parts for custom layout
 * @param change - The change amount in Toman
 * @returns Object with label (Persian text), sign, and formatted number
 */
export function formatChangeParts(change: number | undefined | null): {
  label: string
  signedNumber: string
} {
  if (change === undefined || change === null || change === 0) {
    return { label: 'تومان', signedNumber: '0' }
  }

  const sign = change > 0 ? '+' : '-'
  const absNum = Math.abs(change)

  // Under 1,000: show exact number
  if (absNum < 1000) {
    return {
      label: 'تومان',
      signedNumber: `${sign}${new Intl.NumberFormat('en-US').format(Math.round(absNum))}`
    }
  }

  // 1,000 - 999,999: use "هزار تومان" (thousand)
  if (absNum < 1_000_000) {
    const thousands = absNum / 1000
    const formatted = thousands % 1 === 0
      ? thousands.toFixed(0)
      : thousands.toFixed(1)
    return {
      label: 'هزار تومان',
      signedNumber: `${sign}${new Intl.NumberFormat('en-US').format(parseFloat(formatted))}`
    }
  }

  // 1,000,000 - 999,999,999: use "میلیون تومان" (million)
  if (absNum < 1_000_000_000) {
    const millions = absNum / 1_000_000
    const formatted = millions % 1 === 0
      ? millions.toFixed(0)
      : millions < 10
        ? millions.toFixed(2)
        : millions.toFixed(1)
    return {
      label: 'میلیون تومان',
      signedNumber: `${sign}${new Intl.NumberFormat('en-US').format(parseFloat(formatted))}`
    }
  }

  // 1 billion+: use "میلیارد تومان" (billion)
  const billions = absNum / 1_000_000_000
  const formatted = billions % 1 === 0
    ? billions.toFixed(0)
    : billions < 10
      ? billions.toFixed(2)
      : billions.toFixed(1)
  return {
    label: 'میلیارد تومان',
    signedNumber: `${sign}${new Intl.NumberFormat('en-US').format(parseFloat(formatted))}`
  }
}

/**
 * Get the appropriate color class for a change value
 * @param change - The change amount
 * @returns Tailwind CSS color class
 */
export function getChangeColor(change: number | undefined | null): string {
  if (change === undefined || change === null || change === 0) return 'text-gray-600'

  return change > 0 ? 'text-green-600' : 'text-red-600'
}
