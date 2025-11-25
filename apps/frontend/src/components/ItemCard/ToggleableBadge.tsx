'use client'

import React, { useState, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FiArrowUp, FiArrowDown } from 'react-icons/fi'
import { formatChangeParts, toPersianDigits } from '@/lib/utils/formatters'

interface ToggleableBadgeProps {
  /**
   * Absolute change in Toman (can be positive, negative, or zero)
   */
  absoluteChange: number

  /**
   * Daily change percentage (can be positive, negative, or zero)
   */
  percentChange: number

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
 * ToggleableBadge - Displays price change with tap-to-toggle between Toman and percentage
 *
 * Features:
 * - Default: Shows absolute change in Toman (e.g., "+500 تومان", "-2.5 هزار تومان")
 * - On tap/click: Toggles to percentage view (e.g., "+0.5%", "-1.2%")
 * - Color-coded: green (positive), red (negative), gray (zero)
 * - Arrow indicators for direction
 * - Responsive sizing for compact mode
 * - Dark mode support
 * - Smooth transitions with scale effect on tap
 *
 * Accessibility:
 * - Interactive button for keyboard/screen reader users
 * - ARIA label describes the change and toggle functionality
 * - Focus ring for keyboard navigation
 */
export const ToggleableBadge: React.FC<ToggleableBadgeProps> = ({
  absoluteChange,
  percentChange,
  compact = false,
  className = '',
}) => {
  const locale = useLocale()
  const t = useTranslations('ItemCard')

  // State: false = Toman (default), true = percentage
  const [showPercent, setShowPercent] = useState(false)

  // Toggle between Toman and percentage display
  const handleToggle = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation() // Prevent card click
    setShowPercent(prev => !prev)
  }, [])

  // Determine if change is positive/negative/zero
  const isPositive = absoluteChange >= 0
  const isZero = absoluteChange === 0

  // Format Toman change using existing formatter
  const { label, signedNumber } = formatChangeParts(absoluteChange, locale, {
    toman: t('toman'),
    thousandToman: t('thousandToman'),
    millionToman: t('millionToman'),
    billionToman: t('billionToman')
  })

  // Format percentage
  const formatPercent = () => {
    const sign = percentChange >= 0 ? '+' : ''
    const value = percentChange.toFixed(2)
    const formatted = locale === 'fa' ? toPersianDigits(value) : value
    return `${sign}${formatted}%`
  }

  // Color classes based on change direction
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
    <button
      type="button"
      onClick={handleToggle}
      onTouchEnd={handleToggle}
      className={`
        inline-flex items-center rounded-lg font-semibold transition-all duration-150
        ${bgColor} ${textColor} ${sizeClasses} ${className}
        cursor-pointer select-none
        hover:opacity-90 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-offset-1
        ${isZero ? 'focus:ring-gray-400' : isPositive ? 'focus:ring-green-400' : 'focus:ring-red-400'}
      `}
      role="button"
      aria-label={`${isPositive ? t('priceIncrease') : t('priceDecrease')}. ${t('tapToToggle') || 'Tap to toggle'}`}
      aria-pressed={showPercent}
      dir="ltr"
    >
      {!isZero && <ArrowIcon className={compact ? 'text-xs' : 'text-sm'} aria-hidden="true" />}

      {showPercent ? (
        // Percentage view
        <span>{formatPercent()}</span>
      ) : (
        // Toman view (default)
        <>
          <span>{signedNumber}</span>
          <span className={compact ? 'text-[10px]' : 'text-xs'}>{label}</span>
        </>
      )}
    </button>
  )
}
