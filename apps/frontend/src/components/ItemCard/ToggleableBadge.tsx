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
 * ToggleableBadge - Touch-friendly badge for toggling between Toman and percentage
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
 * Touch Optimizations:
 * - WCAG Level AA/AAA compliant touch targets (44x44px / 48x48px)
 * - Proper touch event handling (no double-firing)
 * - Event propagation prevention (doesn't trigger parent card)
 * - Optimized for mobile (touch-manipulation, no tap delay)
 * - Haptic feedback on supported devices
 *
 * Accessibility:
 * - Interactive button for keyboard/screen reader users
 * - ARIA label describes current state and toggle functionality
 * - ARIA live region announces state changes
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
  const handleToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()    // Prevent default behavior
    e.stopPropagation()   // Prevent card click

    // Haptic feedback for mobile devices
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

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

  // WCAG compliant touch target sizes: minimum 44x44px (AA) and 48x48px (AAA)
  const sizeClasses = compact
    ? 'text-xs px-3 py-2 gap-1 min-w-[44px] min-h-[44px]'
    : 'text-sm px-4 py-2.5 gap-1.5 min-w-[48px] min-h-[48px]'

  const ArrowIcon = isPositive ? FiArrowUp : FiArrowDown

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`
        inline-flex items-center justify-center rounded-lg font-semibold
        ${bgColor} ${textColor} ${sizeClasses} ${className}
        cursor-pointer select-none
        touch-manipulation [-webkit-tap-highlight-color:transparent]
        hover:opacity-90 active:opacity-80
        transition-opacity duration-100
        focus:outline-none focus:ring-2 focus:ring-offset-1
        ${isZero ? 'focus:ring-gray-400' : isPositive ? 'focus:ring-green-400' : 'focus:ring-red-400'}
      `}
      role="button"
      aria-label={`${isPositive ? t('priceIncrease') : t('priceDecrease')}. ${showPercent ? `${t('showingPercent')}: ${formatPercent()}` : `${t('showingToman')}: ${signedNumber} ${label}`}. ${t('tapToToggle') || 'Tap to toggle'}`}
      aria-pressed={showPercent}
      aria-live="polite"
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
