'use client'

import React, { useRef } from 'react'
import { formatToman } from '@/lib/utils/formatters'
import { logComponentError } from '@/lib/errorLogger'
import { ItemCardHeader } from './ItemCardHeader'
import { ItemCardBadge } from './ItemCardBadge'
import { ItemCardPrice } from './ItemCardPrice'
import { ItemCardSparkline } from './ItemCardSparkline'
import { useItemCardData } from './useItemCardData'
import { isValidIconComponent, formatTomanForScreenReader } from './itemCard.utils'
import type { ItemCardProps } from './itemCard.types'

/**
 * ItemCard - A reusable card component for displaying currency, crypto, and gold items
 * Apple-inspired minimalist design with unified blue accent system
 *
 * Layout Structure:
 * - Top row: Icon (left) and Name (right)
 * - Bottom section: Change badge (above) and Price value (below), both left-aligned
 * - Vertical flex layout for consistent card structure
 *
 * Design Features (Apple-inspired):
 * - Single blue accent color for all categories (no purple/gold)
 * - Subtle hover effect: soft background change + gentle shadow elevation
 * - Generous whitespace with increased padding
 * - Larger border radius (16px) for modern look
 * - Soft shadows for depth without visual noise
 * - No colored borders - clean, minimal aesthetic
 * - Subtle scale on active state (0.98)
 * - Uses ONLY Tailwind CSS classes (no inline styles)
 *
 * Accessibility Features:
 * - Displays item icon, name, price, and change percentage
 * - Visual indicators for positive (green) and negative (red) changes
 * - Fully accessible with keyboard navigation and focus rings
 * - Comprehensive ARIA labels for screen readers
 * - Touch-optimized with proper target sizes (120px+ min-height)
 * - Performance optimized with motion-reduce support
 *
 * Responsive Behavior:
 * - All breakpoints: Consistent vertical layout
 * - Icon size scales from 20px to 48px across breakpoints
 * - Text size scales from 14px to 18px (name) and 20px to 48px (price)
 * - Padding scales from 16px to 24px (more generous than before)
 * - Min-height scales from 120px to 160px for proper spacing
 * - Touch targets meet WCAG AAA standards (120px+ on mobile)
 */
const ItemCardComponent: React.FC<ItemCardProps> = ({
  id,
  code,
  name,
  icon,
  iconColor,
  value,
  change,
  type,
  compact = false,
  accentColor = 'blue',
  onClick,
  role,
}) => {
  // Process data using custom hook
  const { sparklineData, isPositive, sparklineColor } = useItemCardData({
    code,
    value,
    change,
    type,
  })

  // Track if we've logged an invalid icon error to prevent spam
  const hasLoggedInvalidIcon = useRef(false)

  /**
   * Generates the card button className based on compact mode
   */
  const getCardClassName = (isCompact: boolean) =>
    `card-apple cursor-pointer active:scale-[0.98] group flex flex-col ${
      isCompact
        ? 'min-h-[90px] sm:min-h-[100px] lg:min-h-[140px] p-3'
        : 'min-h-[110px] sm:min-h-[130px] lg:min-h-[150px] p-4'
    } w-full text-left focus:outline-none focus:ring-[3px] focus:ring-[rgba(var(--accent-primary),0.4)] focus:ring-offset-2 touch-manipulation [-webkit-tap-highlight-color:transparent] motion-reduce:transition-none motion-reduce:active:scale-100`

  // Runtime validation for icon
  if (!isValidIconComponent(icon)) {
    if (!hasLoggedInvalidIcon.current) {
      logComponentError(
        new Error(`Invalid icon component passed for item: ${id}`),
        'ItemCard',
        undefined,
        `Icon validation failed for item: ${id}`
      )
      hasLoggedInvalidIcon.current = true
    }

    // Return a fallback card without icon and without sparkline
    return (
      <button
        type="button"
        onClick={onClick}
        role={role}
        className={getCardClassName(compact)}
        aria-label={`${name}: ${formatTomanForScreenReader(value)}، ${
          isPositive ? 'افزایش' : 'کاهش'
        } ${formatTomanForScreenReader(Math.abs(change))} نسبت به قبل`}
      >
        {/* Header Section with fallback */}
        <ItemCardHeader icon={icon} name={name} id={id} iconColor={iconColor} compact={compact} />

        {/* Bottom Section: Badge + Price only (no sparkline) */}
        <div className="flex flex-col items-start gap-1.5 mt-auto">
          <ItemCardBadge change={change} isPositive={isPositive} compact={compact} />
          <ItemCardPrice value={value} compact={compact} />
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      role={role}
      className={getCardClassName(compact)}
      aria-label={`${name}: ${formatTomanForScreenReader(value)}، ${
        isPositive ? 'افزایش' : 'کاهش'
      } ${formatTomanForScreenReader(Math.abs(change))} نسبت به قبل`}
    >
      {/* Header Section */}
      <ItemCardHeader icon={icon} name={name} id={id} iconColor={iconColor} compact={compact} />

      {/* Bottom Section: Left side (Change badge and Price) + Right side (Sparkline) */}
      <div className="flex items-end justify-between gap-2.5 mt-auto">
        {/* Left side: Change badge and Price */}
        <div className="flex flex-col items-start gap-1.5 flex-1 min-w-0">
          <ItemCardBadge change={change} isPositive={isPositive} compact={compact} />
          <ItemCardPrice value={value} compact={compact} />
        </div>

        {/* Right side: Sparkline chart - Only show in normal (single-column) mode */}
        <ItemCardSparkline
          data={sparklineData}
          color={sparklineColor}
          isPositive={isPositive}
          compact={compact}
          show={!compact}
        />
      </div>
    </button>
  )
}

/**
 * Memoized ItemCard component with custom comparison function
 *
 * Optimization Strategy:
 * - Compares all visual props (id, value, change, name, iconColor, icon, accentColor)
 * - Excludes onClick and role from comparison (they're stable or don't affect visual rendering)
 * - Uses reference equality for icon (works because react-icons components are stable)
 * - Only re-renders when meaningful visual changes occur
 */
export const ItemCard = React.memo<ItemCardProps>(
  ItemCardComponent,
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render)
    // Return false if props are different (perform re-render)
    // We intentionally exclude onClick and role from comparison as they may change
    // frequently or are stable references that don't affect rendering
    return (
      prevProps.id === nextProps.id &&
      prevProps.code === nextProps.code &&
      prevProps.value === nextProps.value &&
      prevProps.change === nextProps.change &&
      prevProps.name === nextProps.name &&
      prevProps.iconColor === nextProps.iconColor &&
      prevProps.icon === nextProps.icon &&
      prevProps.type === nextProps.type &&
      prevProps.accentColor === nextProps.accentColor &&
      prevProps.compact === nextProps.compact
      // Note: onClick and role are intentionally excluded from comparison
    )
  }
)

ItemCard.displayName = 'ItemCard'

// Re-export types for convenience
export type { ItemCardProps, AccentColorVariant } from './itemCard.types'
