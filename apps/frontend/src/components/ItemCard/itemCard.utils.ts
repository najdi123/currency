import { IconType } from 'react-icons'

/**
 * Type guard to validate if a value is a valid React icon component
 * @param icon - The icon to validate
 * @returns True if the icon is a valid React component
 */
export function isValidIconComponent(icon: unknown): icon is IconType {
  return icon !== null && icon !== undefined && typeof icon === 'function'
}

/**
 * Format Toman value for screen readers in a more natural way
 * Converts to "X هزار تومان" format for better pronunciation
 * @param value - The value in Toman
 * @returns Formatted string for screen readers
 */
export function formatTomanForScreenReader(value: number): string {
  const thousands = Math.round(value / 1000)
  return `${thousands} هزار تومان`
}
