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
 * Format a change amount in Toman with sign on the left
 * @param change - The change amount in Toman
 * @returns Formatted string with +/- sign on the left (e.g., "+2.5T" or "-1.3T")
 */
export function formatChange(change: number | undefined | null): string {
  if (change === undefined || change === null || change === 0) return '0T'

  const sign = change > 0 ? '+' : '-'
  const absValue = Math.abs(change).toFixed(2)

  return `${sign}${absValue}T`
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
