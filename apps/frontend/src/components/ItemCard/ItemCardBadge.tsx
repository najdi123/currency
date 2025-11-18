import React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FiArrowUp, FiArrowDown } from 'react-icons/fi'
import { formatChangeParts } from '@/lib/utils/formatters'

interface ItemCardBadgeProps {
  /**
   * Change amount (can be positive or negative)
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
 * - Formatted change text with sign and suffix
 * - Responsive sizing for compact mode
 * - Persian/Farsi digits when locale is 'fa'
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
  const { label, signedNumber } = formatChangeParts(change, locale)

  return (
    <div
      className={
        isPositive
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
      <span>{label}</span>
      <span>{signedNumber}</span>
      {isPositive ? (
        <FiArrowUp className="text-xs sm:text-sm mb-1" aria-hidden="true" />
      ) : (
        <FiArrowDown className="text-xs sm:text-sm mb-1" aria-hidden="true" />
      )}
    </div>
  )
}
