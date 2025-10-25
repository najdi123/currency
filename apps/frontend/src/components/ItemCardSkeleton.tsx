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
 * - Matches the responsive grid layout (2 cols mobile, 4 cols desktop)
 * - Smooth shimmer animation
 * - Maintains consistent spacing with actual cards
 */
export const ItemCardSkeleton: React.FC<ItemCardSkeletonProps> = ({
  count = 4,
}) => {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      aria-label="در حال بارگذاری..."
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-surface rounded-lg shadow-sm border border-border p-4"
        >
          <div className="flex justify-between items-center">
            {/* Left side - Icon and text */}
            <div className="flex items-center gap-3 flex-1">
              {/* Icon skeleton */}
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer"
                style={{ backgroundSize: '1000px 100%' }}
              />

              {/* Text content */}
              <div className="flex-1">
                {/* Name skeleton */}
                <div
                  className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-3/4 mb-2 animate-shimmer"
                  style={{ backgroundSize: '1000px 100%' }}
                />
                {/* Price skeleton */}
                <div
                  className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded w-full animate-shimmer"
                  style={{ backgroundSize: '1000px 100%' }}
                />
              </div>
            </div>

            {/* Right side - Change badge skeleton */}
            <div
              className="h-8 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-full animate-shimmer ml-2"
              style={{ backgroundSize: '1000px 100%' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

ItemCardSkeleton.displayName = 'ItemCardSkeleton'
