import React from 'react'
import { IconType } from 'react-icons'
import { isValidIconComponent } from './itemCard.utils'

interface ItemCardHeaderProps {
  /**
   * Icon component from react-icons
   */
  icon: IconType

  /**
   * Display name of the item
   */
  name: string

  /**
   * Item ID for error logging
   */
  id: string

  /**
   * Color class for the icon
   */
  iconColor?: string

  /**
   * Compact mode flag
   */
  compact?: boolean

  /**
   * Optional variants dropdown to display (shown at the end)
   */
  variantsDropdown?: React.ReactNode

  /**
   * Selected variant name to display instead of the base name
   * e.g., "دلار سنا (خرید)" for "Turkey Dollar (Buy)"
   */
  selectedVariantName?: string
}

/**
 * ItemCardHeader - Displays the icon and name section of the ItemCard
 *
 * Layout:
 * - Icon on the left (with responsive sizing)
 * - Name in the middle (RTL text, truncated if needed)
 * - Optional variants dropdown on the right
 * - Horizontal flex layout with gap
 *
 * Accessibility:
 * - Icon marked as decorative (aria-hidden)
 * - Name uses semantic h3 heading
 * - Proper text truncation for long names
 */
export const ItemCardHeader: React.FC<ItemCardHeaderProps> = ({
  icon: Icon,
  name,
  id,
  iconColor = 'text-accent',
  compact = false,
  variantsDropdown,
  selectedVariantName,
}) => {
  // Use selected variant name if provided, otherwise fall back to base name
  const displayName = selectedVariantName || name
  // If icon is invalid, render a placeholder circle
  if (!isValidIconComponent(Icon)) {
    return (
      <div className="flex justify-between items-start gap-2 mb-auto">
        <div
          className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 bg-bg-tertiary rounded-full flex-shrink-0"
          aria-hidden="true"
          dir="ltr"
        />
        <h3
          className={`${
            compact ? 'text-xs sm:text-xs md:text-sm' : 'text-sm sm:text-base'
          } font-semibold text-text-secondary truncate text-right [dir=ltr]:text-left flex-1`}
        >
          {displayName}
        </h3>
        {variantsDropdown && <div className="flex-shrink-0">{variantsDropdown}</div>}
      </div>
    )
  }

  return (
    <div className="flex justify-between items-start gap-2 mb-auto">
      {/* Icon - force LTR to prevent flipping */}
      <div dir="ltr" className="flex-shrink-0">
        <Icon
          className={`${
            compact
              ? 'text-xl sm:text-2xl md:text-3xl lg:text-4xl'
              : 'text-2xl sm:text-3xl lg:text-4xl xl:text-5xl'
          } ${iconColor}`}
          aria-hidden="true"
        />
      </div>

      {/* Name - respect document direction */}
      <h3
        className={`${
          compact ? 'text-xs sm:text-xs md:text-sm' : 'text-sm sm:text-base'
        } font-semibold text-text-secondary truncate flex-1 min-w-0 text-right [dir=ltr]:text-left`}
      >
        {displayName}
      </h3>

      {variantsDropdown && <div className="flex-shrink-0">{variantsDropdown}</div>}
    </div>
  )
}
