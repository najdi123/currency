import React from 'react'
import { IconType } from 'react-icons'
import { FiArrowUp, FiArrowDown } from 'react-icons/fi'
import { formatToman, formatChange } from '@/lib/utils/formatters'
import { logComponentError } from '@/lib/errorLogger'
import { MiniSparkline } from './MiniSparkline'
import { getSparklineData } from '@/lib/utils/mockSparklineData'

/**
 * Supported accent color variants - DEPRECATED
 * All variants now use unified blue accent (Apple-style)
 */
export type AccentColorVariant = 'blue' | 'purple' | 'gold'

export interface ItemCardProps {
  /**
   * Unique identifier for the item
   */
  id: string

  /**
   * Item code for sparkline data generation (e.g., "usd_sell", "btc")
   * This is used as a seed to generate consistent trend data
   */
  code: string

  /**
   * Display name of the item (e.g., "دلار آمریکا")
   */
  name: string

  /**
   * Icon component from react-icons
   */
  icon: IconType

  /**
   * Icon color class (e.g., "text-blue-600")
   */
  iconColor: string

  /**
   * Price value in Toman (must be a number)
   */
  value: number

  /**
   * Change amount (can be positive or negative)
   */
  change: number

  /**
   * Optional accent color variant - DEPRECATED
   * All cards now use unified blue accent system (Apple-style)
   */
  accentColor?: AccentColorVariant

  /**
   * Compact mode for 2-column mobile layout
   * Reduces font sizes and padding for denser display
   */
  compact?: boolean

  /**
   * Optional click handler
   */
  onClick?: () => void

  /**
   * Optional role for ARIA relationships (e.g., "listitem")
   */
  role?: string
}

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
  icon: Icon,
  iconColor,
  value,
  change,
  compact = false,
  accentColor = 'blue',
  onClick,
  role,
}) => {
  // Generate sparkline data based on item code and current value
  const sparklineData = React.useMemo(
    () => getSparklineData(code, value),
    [code, value]
  )

  // Determine sparkline color based on change direction
  const isPositive = change >= 0
  const sparklineColor = isPositive
    ? 'rgb(var(--success))'
    : 'rgb(var(--error))'
  // Runtime validation for icon
  if (!Icon || typeof Icon !== 'function') {
    logComponentError(
      new Error(`Invalid icon component passed for item: ${id}`),
      'ItemCard',
      undefined,
      `Icon validation failed for item: ${id}`
    )
    const isPositiveFallback = change >= 0
    // Return a fallback card without icon
    return (
      <button
        type="button"
        onClick={onClick}
        role={role}
        className={`card-apple cursor-pointer active:scale-[0.98] group flex flex-col ${compact ? 'min-h-[90px] sm:min-h-[100px] lg:min-h-[140px] p-3' : 'min-h-[110px] sm:min-h-[130px] lg:min-h-[150px] p-4'} w-full text-left focus:outline-none focus:ring-[3px] focus:ring-[rgba(var(--accent-primary),0.4)] focus:ring-offset-2 touch-manipulation [-webkit-tap-highlight-color:transparent] motion-reduce:transition-none motion-reduce:active:scale-100`}
        aria-label={`${name}: ${formatToman(value)} تومان، ${isPositiveFallback ? 'افزایش' : 'کاهش'} ${Math.abs(change)} تومان نسبت به قبل`}
      >
        {/* Top row: Placeholder Icon (left) and Name (right) */}
        <div className="flex justify-between items-start gap-2.5 mb-auto" dir="ltr">
          <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 bg-bg-tertiary rounded-full flex-shrink-0" aria-hidden="true" />
          <p className={`${compact ? 'text-xs sm:text-xs md:text-sm' : 'text-sm sm:text-base'} font-semibold text-text-secondary truncate text-right flex-1`}>
            {name}
          </p>
        </div>

        {/* Bottom section: Change badge and Price (both on left) */}
        <div className="flex flex-col items-start gap-1.5 mt-auto">
          {/* Change badge - Enhanced pill-style design */}
          <div
            className={
              isPositiveFallback
                ? compact
                  ? 'badge-pill-success badge-pill-success-compact'
                  : 'badge-pill-success'
                : compact
                ? 'badge-pill-error badge-pill-error-compact'
                : 'badge-pill-error'
            }
            dir="ltr"
            aria-label={isPositiveFallback ? 'افزایش قیمت' : 'کاهش قیمت'}
          >
            {isPositiveFallback ? (
              <FiArrowUp className="text-xs sm:text-sm" aria-hidden="true" />
            ) : (
              <FiArrowDown className="text-xs sm:text-sm" aria-hidden="true" />
            )}
            {formatChange(change)}
          </div>

          {/* Price */}
          <p className={`${compact ? 'text-lg sm:text-xl' : 'text-[1.6rem] sm:text-[1.75rem]'} leading-tight font-bold font-mono text-text-primary`}>
            {formatToman(value)}{' '}
            <span className={`${compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'} font-normal text-text-tertiary`}>تومان</span>
          </p>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      role={role}
      className={`card-apple cursor-pointer active:scale-[0.98] group flex flex-col ${compact ? 'min-h-[90px] sm:min-h-[100px] lg:min-h-[140px] p-3' : 'min-h-[110px] sm:min-h-[130px] lg:min-h-[150px] p-4'} w-full text-left focus:outline-none focus:ring-[3px] focus:ring-[rgba(var(--accent-primary),0.4)] focus:ring-offset-2 touch-manipulation [-webkit-tap-highlight-color:transparent] motion-reduce:transition-none motion-reduce:active:scale-100`}
      aria-label={`${name}: ${formatToman(value)} تومان، ${isPositive ? 'افزایش' : 'کاهش'} ${Math.abs(change)} تومان نسبت به قبل`}
    >
      {/* Top row: Icon (left) and Name (right) */}
      <div className="flex justify-between items-start gap-2.5 mb-auto" dir="ltr">
        <Icon
          className={`${compact ? 'text-xl sm:text-2xl md:text-3xl lg:text-4xl' : 'text-2xl sm:text-3xl lg:text-4xl xl:text-5xl'} flex-shrink-0 text-accent`}
          aria-hidden="true"
        />
        <h3 className={`${compact ? 'text-xs sm:text-xs md:text-sm' : 'text-sm sm:text-base'} font-semibold text-text-secondary truncate text-right flex-1`}>
          {name}
        </h3>
      </div>

      {/* Bottom section: Left side (Change badge and Price) + Right side (Sparkline) */}
      <div className="flex items-end justify-between gap-2.5 mt-auto">
        {/* Left side: Change badge and Price */}
        <div className="flex flex-col items-start gap-1.5 flex-1 min-w-0">
          {/* Change badge - Enhanced pill-style design */}
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
            aria-label={isPositive ? 'افزایش قیمت' : 'کاهش قیمت'}
          >
            {isPositive ? (
              <FiArrowUp className="text-xs sm:text-sm" aria-hidden="true" />
            ) : (
              <FiArrowDown className="text-xs sm:text-sm" aria-hidden="true" />
            )}
            {formatChange(change)}
          </div>

          {/* Price */}
          <p className={`${compact ? 'text-lg sm:text-xl' : 'text-[1.6rem] sm:text-[1.75rem]'} leading-tight font-bold font-mono text-text-primary truncate max-w-full`}>
            {formatToman(value)}{' '}
            <span className={`${compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'} font-normal text-text-tertiary`}>تومان</span>
          </p>
        </div>

        {/* Right side: Sparkline chart */}
        <div className="flex-shrink-0 self-center">
          <MiniSparkline
            data={sparklineData}
            color={sparklineColor}
            width={compact ? 60 : 80}
            height={compact ? 24 : 32}
            strokeWidth={compact ? 1.2 : 1.5}
            className="opacity-70"
          />
        </div>
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
      prevProps.accentColor === nextProps.accentColor &&
      prevProps.compact === nextProps.compact
      // Note: onClick and role are intentionally excluded from comparison
    )
  }
)

ItemCard.displayName = 'ItemCard'
