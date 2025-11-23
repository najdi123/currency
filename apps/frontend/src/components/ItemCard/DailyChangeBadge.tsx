'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { FiArrowUp, FiArrowDown } from 'react-icons/fi'

interface DailyChangeBadgeProps {
  /**
   * Daily change percentage (can be positive, negative, or zero)
   */
  dailyChangePercent: number

  /**
   * Compact mode for smaller displays
   */
  compact?: boolean

  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * DailyChangeBadge - Displays daily OHLC change percentage
 *
 * Features:
 * - Shows percentage change from open to close
 * - Color-coded: green (positive), red (negative), gray (zero)
 * - Arrow indicators for direction
 * - Responsive sizing for compact mode
 * - Dark mode support
 * - Smooth transitions
 *
 * Accessibility:
 * - ARIA label describes the change
 * - Role status for dynamic updates
 * - Screen reader friendly
 *
 * Design:
 * - Apple-inspired minimal design
 * - Consistent with existing badge system
 * - Uses Tailwind utility classes
 */
export const DailyChangeBadge: React.FC<DailyChangeBadgeProps> = ({
  dailyChangePercent,
  compact = false,
  className = '',
}) => {
  const t = useTranslations('ItemCard')
  const isPositive = dailyChangePercent >= 0
  const isZero = dailyChangePercent === 0

  const bgColor = isZero
    ? 'bg-gray-100 dark:bg-gray-800'
    : isPositive
    ? 'bg-green-100 dark:bg-green-900/20'
    : 'bg-red-100 dark:bg-red-900/20'

  const textColor = isZero
    ? 'text-gray-600 dark:text-gray-400'
    : isPositive
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'

  const sizeClasses = compact
    ? 'text-xs px-1.5 py-0.5 gap-0.5'
    : 'text-sm px-2 py-1 gap-1'

  const ArrowIcon = isPositive ? FiArrowUp : FiArrowDown

  return (
    <div
      className={`inline-flex items-center rounded-lg font-semibold transition-colors ${bgColor} ${textColor} ${sizeClasses} ${className}`}
      role="status"
      aria-label={isPositive ? t('priceIncrease') : t('priceDecrease')}
      dir="ltr"
    >
      {!isZero && <ArrowIcon className={compact ? 'text-xs' : 'text-sm'} aria-hidden="true" />}
      <span>
        {isPositive && '+'}
        {dailyChangePercent.toFixed(2)}%
      </span>
    </div>
  )
}
