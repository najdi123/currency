import React from 'react'

export interface ItemCardSkeletonProps {
  /**
   * Number of skeleton cards to display
   */
  count?: number
}

/**
 * ItemCardSkeleton - Loading skeleton for ItemCardGrid
 * Apple-inspired design with new design tokens
 *
 * Features:
 * - Matches the ItemCard vertical layout structure with Apple-style aesthetics
 * - Smooth shimmer animation with gradient effect
 * - Uses new design tokens via Tailwind classes
 * - Maintains consistent spacing and sizing with actual cards
 * - Fully responsive across all breakpoints (mobile to desktop)
 * - Larger border radius (16px) matching new card design
 * - More generous padding matching new card spacing
 * - Uses ONLY Tailwind CSS classes (no inline styles)
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
          className="bg-bg-elevated border border-border-light rounded-[1rem] shadow-[var(--shadow-sm)] p-4 flex flex-col min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]"
        >
          {/* Top row: Icon placeholder (left) and Name placeholder (right) */}
          <div className="flex justify-between items-start gap-2 mb-auto">
            {/* Icon skeleton - circular shape matching icon size */}
            <div
              className="w-9 h-9 mb-1 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full shimmer-bg flex-shrink-0"
              aria-hidden="true"
            />

            {/* Name skeleton - rectangular bar on the right */}
            <div className="flex-1 flex justify-end">
              <div
                className="w-32 h-5 rounded-md shimmer-bg"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Bottom section: Change badge and Price (both left-aligned) */}
          <div className="flex flex-col items-start gap-2 mt-auto">
            {/* Change badge skeleton - small rounded rectangle */}
            <div
              className="w-16 h-6 rounded-md shimmer-bg"
              aria-hidden="true"
            />

            {/* Price skeleton - large bar for price text */}
            <div
              className="w-40 h-8 rounded-md shimmer-bg"
              aria-hidden="true"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

ItemCardSkeleton.displayName = 'ItemCardSkeleton'
