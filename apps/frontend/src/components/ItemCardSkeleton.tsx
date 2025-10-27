import React from 'react'

export interface ItemCardSkeletonProps {
  /**
   * Number of skeleton cards to display
   */
  count?: number
}

/**
 * ItemCardSkeleton - Loading skeleton for ItemCardGrid
 *
 * Features:
 * - Matches the ItemCard vertical layout structure
 * - Smooth shimmer animation with gradient effect
 * - Maintains consistent spacing and sizing with actual cards
 * - Fully responsive across all breakpoints (mobile to desktop)
 *
 * Layout Structure (matches ItemCard):
 * - Top row: Icon placeholder (left) and Name placeholder (right)
 * - Bottom section: Change badge (above) and Price (below), both left-aligned
 * - Vertical flex layout with mb-auto and mt-auto for proper spacing
 */
export const ItemCardSkeleton: React.FC<ItemCardSkeletonProps> = ({
  count = 4,
}) => {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5"
      aria-label="در حال بارگذاری..."
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col bg-surface rounded-lg shadow-sm border border-border p-3 sm:p-4 lg:p-5 xl:p-6 min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]"
        >
          {/* Top row: Icon placeholder (left) and Name placeholder (right) */}
          <div className="flex justify-between items-start gap-2 mb-auto">
            {/* Icon skeleton - circular shape matching icon size */}
            <div
              className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer flex-shrink-0"
              style={{ backgroundSize: '1000px 100%' }}
              aria-hidden="true"
            />

            {/* Name skeleton - rectangular bar on the right */}
            <div className="flex-1 flex justify-end">
              <div
                className="w-24 sm:w-32 h-4 sm:h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded animate-shimmer"
                style={{ backgroundSize: '1000px 100%' }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Bottom section: Change badge and Price (both left-aligned) */}
          <div className="flex flex-col items-start gap-1 sm:gap-2 mt-auto">
            {/* Change badge skeleton - small pill shape */}
            <div
              className="w-16 h-6 sm:h-7 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-full animate-shimmer"
              style={{ backgroundSize: '1000px 100%' }}
              aria-hidden="true"
            />

            {/* Price skeleton - large bar for price text */}
            <div
              className="w-32 sm:w-40 h-6 sm:h-8 md:h-10 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded animate-shimmer"
              style={{ backgroundSize: '1000px 100%' }}
              aria-hidden="true"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

ItemCardSkeleton.displayName = 'ItemCardSkeleton'
