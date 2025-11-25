import React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FiArrowUp, FiArrowDown } from 'react-icons/fi'
import { toPersianDigits } from '@/lib/utils/formatters'

interface ItemCardBadgeProps {
  /**
   * Change percentage as decimal (e.g., 0.035 for 3.5%, -0.012 for -1.2%)
   */
  change: number

  /**
   * Whether the change is positive
   */
  isPositive: boolean

  /**
   * Compact mode flag
   */
  compact?: boolean
}

/**
 * ItemCardBadge - Displays the percentage change pill badge
 *
 * Features:
 * - Color-coded based on positive (green) or negative (red) change
 * - Includes directional arrow icon (up/down)
 * - Displays percentage with sign (e.g., +3.5%, -1.2%)
 * - Responsive sizing for compact mode
 * - Persian/Farsi digits when locale is 'fa'
 *
 * Note: The `change` prop is expected to be a decimal percentage from the API
 * (e.g., 0.035 for 3.5%). This is converted to display format (3.5%).
 *
 * Accessibility:
 * - ARIA label describes the change direction in Persian
 * - Icon marked as decorative (aria-hidden)
 * - Uses semantic color classes from design system
 */
export const ItemCardBadge: React.FC<ItemCardBadgeProps> = ({
  change,
  isPositive,
  compact = false,
}) => {
  const locale = useLocale()
  const t = useTranslations('ItemCard')

  // Format percentage: convert decimal to percentage display
  // e.g., 0.035 -> "+3.5%", -0.012 -> "-1.2%"
  const formatPercent = () => {
    const sign = change >= 0 ? '+' : ''
    // Convert decimal to percentage (0.035 -> 3.5)
    const percentValue = Math.abs(change * 100)
    // Format with appropriate precision
    const formatted = percentValue < 0.01
      ? '0'
      : percentValue < 1
        ? percentValue.toFixed(2)
        : percentValue < 10
          ? percentValue.toFixed(1)
          : percentValue.toFixed(0)
    const displayValue = locale === 'fa' ? toPersianDigits(formatted) : formatted
    return `${sign}${change < 0 ? '-' : ''}${displayValue}%`
  }

  const isZero = change === 0

  return (
    <div
      className={
        isZero
          ? compact
            ? 'badge-pill-neutral badge-pill-neutral-compact'
            : 'badge-pill-neutral'
          : isPositive
            ? compact
              ? 'badge-pill-success badge-pill-success-compact'
              : 'badge-pill-success'
            : compact
              ? 'badge-pill-error badge-pill-error-compact'
              : 'badge-pill-error'
      }
      dir="ltr"
      aria-label={isPositive ? t('priceIncrease') : t('priceDecrease')}
    >
      <span>{formatPercent()}</span>
      {!isZero && (isPositive ? (
        <FiArrowUp className="text-xs sm:text-sm" aria-hidden="true" />
      ) : (
        <FiArrowDown className="text-xs sm:text-sm" aria-hidden="true" />
      ))}
    </div>
  )
}
