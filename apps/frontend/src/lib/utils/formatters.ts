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
 * Format a change amount with sign and comma separators
 * @param change - The change amount
 * @returns Formatted string with +/- sign (e.g., "+1,500" or "-2,300")
 */
export function formatChange(change: number | undefined | null): string {
  if (change === undefined || change === null || change === 0) return '0'

  const formatted = new Intl.NumberFormat('en-US').format(Math.abs(Math.round(change)))
  const sign = change > 0 ? '+' : '-'

  return `${sign}${formatted}`
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
