import React, { useMemo } from 'react'
import { IconType } from 'react-icons'
import { ItemCard, AccentColorVariant } from './ItemCard'

export interface ItemCardGridProps {
  /**
   * Array of items to display
   */
  items: Array<{
    key: string
    name: string
    icon: IconType
    color: string
  }>

  /**
   * Data object containing values for each item
   */
  data: {
    [key: string]: {
      value: number
      change: number
    }
  } | null

  /**
   * Accent color variant for hover effect
   */
  accentColor?: AccentColorVariant

  /**
   * Optional click handler for items
   */
  onItemClick?: (itemKey: string) => void
}

/**
 * ItemCardGrid - A responsive grid layout for displaying currency/gold cards
 *
 * Responsive breakpoints:
 * - Extra Small (< 640px): 1 card per row
 * - Small (640px - 768px): 2 cards per row
 * - Medium (768px - 1024px): 2 cards per row
 * - Large (1024px - 1280px): 3 cards per row
 * - Extra Large (1280px - 1536px): 4 cards per row
 * - 2XL (1536px+): 5 cards per row
 *
 * Features:
 * - Automatic grid layout with consistent spacing
 * - Filters out items with no data
 * - Passes through all ItemCard features
 * - Fully accessible with ARIA list/listitem relationships
 * - Optimized with useCallback to prevent unnecessary re-renders
 * - Memoized component to prevent re-renders when props haven't changed
 * - Responsive gap spacing that scales with screen size
 * - Mobile-first design with 1 column on mobile, expanding to more columns on larger screens
 *
 * Performance Optimizations:
 * - Wrapped with React.memo for shallow prop comparison
 * - Custom comparison function checks all props for changes
 * - Prevents unnecessary re-renders of child ItemCard components
 * - Particularly beneficial during polling updates (every 5 minutes)
 * - Uses reference equality for objects and arrays
 *
 * Memoization Strategy:
 * - items: Array reference comparison (stable module-level constants)
 * - data: Object reference comparison (RTK Query provides stable refs)
 * - accentColor: Primitive string comparison
 * - onItemClick: Function reference comparison (typically stable or undefined)
 *
 * Performance Impact:
 * - Skips re-rendering when parent updates but ItemCardGrid props are unchanged
 * - Reduces React reconciliation work during unrelated state updates
 * - Improves overall application performance, especially with multiple grid instances
 */
const ItemCardGridComponent: React.FC<ItemCardGridProps> = ({
  items,
  data,
  accentColor = 'blue',
  onItemClick,
}) => {
  if (!data) {
    return null
  }

  // Memoize click handlers to prevent creating new functions on every render
  // Creates a stable object mapping item keys to their click handlers
  const clickHandlers = useMemo(() => {
    if (!onItemClick) return {}

    return items.reduce((acc, item) => {
      acc[item.key] = () => onItemClick(item.key)
      return acc
    }, {} as Record<string, () => void>)
  }, [items, onItemClick])

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5"
      role="list"
      aria-label="لیست آیتم‌های قیمت"
    >
      {items.map((item) => {
        const itemData = data[item.key]
        if (!itemData) return null

        return (
          <ItemCard
            key={item.key}
            id={item.key}
            name={item.name}
            icon={item.icon}
            iconColor={item.color}
            value={itemData.value}
            change={itemData.change}
            accentColor={accentColor}
            onClick={clickHandlers[item.key]}
            role="listitem"
          />
        )
      })}
    </div>
  )
}

/**
 * Memoized ItemCardGrid component with custom comparison function
 *
 * The custom comparison function returns true if props are equal (skip re-render)
 * and false if props are different (perform re-render).
 *
 * Comparison logic:
 * - All props must be equal for the component to skip re-rendering
 * - Uses reference equality (===) for all props
 * - This is sufficient because:
 *   1. items arrays are stable module-level constants
 *   2. data objects have stable references from RTK Query
 *   3. accentColor is a primitive string
 *   4. onItemClick is either undefined or a stable callback
 */
export const ItemCardGrid = React.memo<ItemCardGridProps>(
  ItemCardGridComponent,
  (prevProps, nextProps) => {
    // Development-only logging to track re-render behavior
    if (process.env.NODE_ENV === 'development') {
      const changedProps: string[] = []
      if (prevProps.accentColor !== nextProps.accentColor) changedProps.push('accentColor')
      if (prevProps.data !== nextProps.data) changedProps.push('data')
      if (prevProps.items !== nextProps.items) changedProps.push('items')
      if (prevProps.onItemClick !== nextProps.onItemClick) changedProps.push('onItemClick')

      if (changedProps.length > 0) {
        console.log('[ItemCardGrid] Re-rendering due to changed props:', changedProps)
      }

      return changedProps.length === 0 // true if no changes, false if changes
    }

    // Production: optimized comparison with early returns
    // Return false immediately if any prop changed (perform re-render)
    if (prevProps.accentColor !== nextProps.accentColor) return false
    if (prevProps.data !== nextProps.data) return false
    if (prevProps.items !== nextProps.items) return false
    if (prevProps.onItemClick !== nextProps.onItemClick) return false

    // All props are equal, skip re-render
    return true
  }
)

ItemCardGrid.displayName = 'ItemCardGrid'
