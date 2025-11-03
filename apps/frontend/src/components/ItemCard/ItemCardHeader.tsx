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
}

/**
 * ItemCardHeader - Displays the icon and name section of the ItemCard
 *
 * Layout:
 * - Icon on the left (with responsive sizing)
 * - Name on the right (RTL text, truncated if needed)
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
}) => {
  // If icon is invalid, render a placeholder circle
  if (!isValidIconComponent(Icon)) {
    return (
      <div className="flex justify-between items-start gap-2.5 mb-auto" dir="ltr">
        <div
          className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 bg-bg-tertiary rounded-full flex-shrink-0"
          aria-hidden="true"
        />
        <h3
          className={`${
            compact ? 'text-xs sm:text-xs md:text-sm' : 'text-sm sm:text-base'
          } font-semibold text-text-secondary truncate text-right flex-1`}
        >
          {name}
        </h3>
      </div>
    )
  }

  return (
    <div className="flex justify-between items-start gap-2.5 mb-auto" dir="ltr">
      <Icon
        className={`${
          compact
            ? 'text-xl sm:text-2xl md:text-3xl lg:text-4xl'
            : 'text-2xl sm:text-3xl lg:text-4xl xl:text-5xl'
        } flex-shrink-0 ${iconColor}`}
        aria-hidden="true"
      />
      <h3
        className={`${
          compact ? 'text-xs sm:text-xs md:text-sm' : 'text-sm sm:text-base'
        } font-semibold text-text-secondary truncate text-right flex-1`}
      >
        {name}
      </h3>
    </div>
  )
}
