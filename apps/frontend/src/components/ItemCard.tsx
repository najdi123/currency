import React from 'react'
import { IconType } from 'react-icons'
import { FiArrowUp, FiArrowDown } from 'react-icons/fi'
import { formatToman, formatChange } from '@/lib/utils/formatters'
import { logComponentError } from '@/lib/errorLogger'

/**
 * Supported accent color variants for hover border effects
 */
export type AccentColorVariant = 'blue' | 'purple' | 'amber'

/**
 * Mapping of accent color variants to their Tailwind classes
 * This ensures Tailwind can statically analyze and include these classes in the build
 */
const accentColorClasses: Record<AccentColorVariant, string> = {
  blue: 'hover:border-l-blue-500',
  purple: 'hover:border-l-purple-500',
  amber: 'hover:border-l-amber-500',
}

export interface ItemCardProps {
  /**
   * Unique identifier for the item
   */
  id: string

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
   * Optional accent color variant for hover border
   */
  accentColor?: AccentColorVariant

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
 *
 * Features:
 * - Displays item icon, name, price, and change percentage
 * - Visual indicators for positive (green) and negative (red) changes
 * - Hover effects with left border accent
 * - Fully accessible with keyboard navigation
 * - Responsive text sizing
 * - Optimized with React.memo to prevent unnecessary re-renders
 */
const ItemCardComponent: React.FC<ItemCardProps> = ({
  id,
  name,
  icon: Icon,
  iconColor,
  value,
  change,
  accentColor = 'blue',
  onClick,
  role,
}) => {
  // Runtime validation for icon
  if (!Icon || typeof Icon !== 'function') {
    logComponentError(
      new Error(`Invalid icon component passed for item: ${id}`),
      'ItemCard',
      undefined,
      `Icon validation failed for item: ${id}`
    )
    // Return a fallback card without icon
    return (
      <button
        type="button"
        onClick={onClick}
        role={role}
        className={`
          flex justify-between items-center
          bg-white rounded-lg shadow-sm hover:shadow-md
          border border-gray-200 border-l-2 border-l-transparent
          hover:bg-gray-50 hover:border-l-4 ${accentColorClasses[accentColor]}
          transition-all duration-200
          p-4
          cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
          w-full text-left
        `}
        aria-label={`${name}: ${formatToman(value)} تومان، ${change >= 0 ? 'افزایش' : 'کاهش'} ${Math.abs(change)} درصد نسبت به قبل`}
      >
        {/* Left side - Placeholder Icon, Name and Price */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full" aria-hidden="true" />
          <div>
            <p className="text-base md:text-lg font-semibold text-gray-700">
              {name}
            </p>
            <p className="text-2xl md:text-3xl font-bold font-mono text-gray-900">
              {formatToman(value)}{' '}
              <span className="text-sm font-normal text-gray-600">تومان</span>
            </p>
          </div>
        </div>

        {/* Right side - Change badge */}
        <div
          className={`
            inline-flex items-center gap-1
            ${change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
            rounded-full px-3 py-1 text-sm font-medium
          `}
          aria-label={change >= 0 ? 'افزایش قیمت' : 'کاهش قیمت'}
        >
          {change >= 0 ? (
            <FiArrowUp className="text-base" aria-hidden="true" />
          ) : (
            <FiArrowDown className="text-base" aria-hidden="true" />
          )}
          {formatChange(change)}
        </div>
      </button>
    )
  }

  const isPositive = change >= 0

  return (
    <button
      type="button"
      onClick={onClick}
      role={role}
      className={`
        flex justify-between items-center
        bg-white rounded-lg shadow-sm hover:shadow-md
        border border-gray-200 border-l-2 border-l-transparent
        hover:bg-gray-50 hover:border-l-4 ${accentColorClasses[accentColor]}
        transition-all duration-200
        p-4
        cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
        w-full text-left
      `}
      aria-label={`${name}: ${formatToman(value)} تومان، ${isPositive ? 'افزایش' : 'کاهش'} ${Math.abs(change)} درصد نسبت به قبل`}
    >
      {/* Left side - Icon, Name and Price */}
      <div className="flex items-center gap-3">
        <Icon
          className={`text-2xl ${iconColor}`}
          aria-hidden="true"
        />
        <div>
          <p className="text-base md:text-lg font-semibold text-gray-700">
            {name}
          </p>
          <p className="text-2xl md:text-3xl font-bold font-mono text-gray-900">
            {formatToman(value)}{' '}
            <span className="text-sm font-normal text-gray-600">تومان</span>
          </p>
        </div>
      </div>

      {/* Right side - Change badge */}
      <div
        className={`
          inline-flex items-center gap-1
          ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          rounded-full px-3 py-1 text-sm font-medium
        `}
        aria-label={isPositive ? 'افزایش قیمت' : 'کاهش قیمت'}
      >
        {isPositive ? (
          <FiArrowUp className="text-base" aria-hidden="true" />
        ) : (
          <FiArrowDown className="text-base" aria-hidden="true" />
        )}
        {formatChange(change)}
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
      prevProps.value === nextProps.value &&
      prevProps.change === nextProps.change &&
      prevProps.name === nextProps.name &&
      prevProps.iconColor === nextProps.iconColor &&
      prevProps.icon === nextProps.icon &&
      prevProps.accentColor === nextProps.accentColor
      // Note: onClick and role are intentionally excluded from comparison
    )
  }
)

ItemCard.displayName = 'ItemCard'
