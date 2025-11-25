import React, { useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { IconType } from 'react-icons'
import { ItemCard, AccentColorVariant } from './ItemCard'
import { hasVariants, getVariantsForCurrency, getVariantData } from '@/lib/utils/dataItemHelpers'
import { useGetAllTodayOhlcQuery } from '@/lib/store/services/api'
import type { OhlcResponse } from '@/lib/store/services/api'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import {
  selectCalculatorMode,
  selectCalculatorItems,
  addItem,
  updateItemQuantity,
  removeItem,
  type ItemType as CalculatorItemType,
} from '@/lib/store/slices/calculatorSlice'
import type { ItemType } from '@/types/chart'

/**
 * Map display item types to calculator item types
 * - 'crypto' and 'coins' both map to 'coin' in calculator
 * - 'currency' and 'gold' stay the same
 */
const mapToCalculatorItemType = (displayType: string): CalculatorItemType => {
  if (displayType === 'crypto' || displayType === 'coins') {
    return 'coin'
  }
  if (displayType === 'currency' || displayType === 'gold') {
    return displayType as CalculatorItemType
  }
  return 'custom'
}

export interface ItemCardGridProps {
  /**
   * Array of items to display
   */
  items: Array<{
    key: string
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
   * Item type for fetching historical data (can be chart type or calculator type)
   */
  itemType: string

  /**
   * Accent color variant for hover effect
   */
  accentColor?: AccentColorVariant

  /**
   * View mode for mobile layout
   * - 'single': One column on mobile (default)
   * - 'dual': Two columns on mobile with compact cards
   */
  viewMode?: 'single' | 'dual'

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
  itemType,
  accentColor = 'blue',
  viewMode = 'single',
  onItemClick,
}) => {
  const t = useTranslations('Home')
  const dispatch = useAppDispatch()

  // Get calculator state from Redux
  const isCalculatorMode = useAppSelector(selectCalculatorMode)
  const calculatorItems = useAppSelector(selectCalculatorItems)

  // Fetch OHLC data for all items
  const { data: ohlcData } = useGetAllTodayOhlcQuery()

  // Create a lookup map for OHLC data by itemCode
  const ohlcMap = useMemo(() => {
    if (!ohlcData?.data) return {}
    return ohlcData.data.reduce((acc, item) => {
      acc[item.itemCode] = item
      return acc
    }, {} as Record<string, OhlcResponse>)
  }, [ohlcData])

  // Create a lookup map for calculator items by item key
  const calculatorItemsMap = useMemo(() => {
    return calculatorItems.reduce((acc, item) => {
      // Map calculator item to the item key (e.g., subType 'USD' -> 'usd_sell')
      const itemKey = item.subType?.toLowerCase() || item.id
      acc[itemKey] = item
      return acc
    }, {} as Record<string, typeof calculatorItems[0]>)
  }, [calculatorItems])

  // Handler for quantity changes in calculator mode
  const handleQuantityChange = useCallback((itemKey: string, itemName: string, unitPrice: number, quantity: number) => {
    const existingItem = calculatorItemsMap[itemKey]

    if (existingItem) {
      if (quantity === 0) {
        // Remove item if quantity is 0
        dispatch(removeItem(existingItem.id))
      } else {
        // Update existing item quantity
        dispatch(updateItemQuantity({ id: existingItem.id, quantity }))
      }
    } else if (quantity > 0) {
      // Add new item to calculator
      dispatch(addItem({
        type: mapToCalculatorItemType(itemType),
        subType: itemKey.toUpperCase() as any,
        name: itemName,
        quantity,
        unitPrice,
      }))
    }
  }, [calculatorItemsMap, dispatch, itemType])

  // Memoize click handlers to prevent creating new functions on every render
  // Creates a stable object mapping item keys to their click handlers
  const clickHandlers = useMemo(() => {
    if (!onItemClick) return {}

    return items.reduce((acc, item) => {
      acc[item.key] = () => onItemClick(item.key)
      return acc
    }, {} as Record<string, () => void>)
  }, [items, onItemClick])

  if (!data) {
    return null
  }

  return (
    <div
      className={`grid ${
        viewMode === 'dual'
          ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      } ${
        viewMode === 'dual' ? 'gap-2 sm:gap-4 lg:gap-6 xl:gap-8' : 'gap-4 sm:gap-6 lg:gap-8'
      } w-full`}
      role="list"
      aria-label="لیست آیتم‌های قیمت"
    >
      {items.map((item) => {
        const itemData = data[item.key]
        if (!itemData) return null

        // Check if this currency has variants and extract variant data
        const itemHasVariants = itemType === 'currency' && hasVariants(item.key)
        const variantDefinitions = itemHasVariants ? getVariantsForCurrency(item.key) : []
        const variants = itemHasVariants
          ? variantDefinitions
              .map((v) => getVariantData(v, data))
              .filter((v): v is NonNullable<typeof v> => v !== null)
          : []

        // Debug logging for variants
        if (itemHasVariants) {
          if (item.key === 'usd_sell') {
            const allUSDVariants = variantDefinitions.map(v => ({
              code: v.code,
              apiCode: v.apiCode,
              hasData: !!data[v.apiCode],
              type: v.variantType,
            }))
            const foundVariantCodes = variants.map(v => v.apiCode)
            console.log(`[ItemCardGrid] USD Variants Summary:`, {
              total: variantDefinitions.length,
              found: variants.length,
              missing: variantDefinitions.filter(v => !data[v.apiCode]).map(v => v.apiCode),
              specificVariants: {
                soleimanie: !!data['dolar_soleimanie_sell'],
                kordestan: !!data['dolar_kordestan_sell'],
                mashad: !!data['dolar_mashad_sell'],
                harat: !!data['dolar_harat_sell'],
                haratCash: !!data['harat_naghdi_sell'],
              },
              allVariants: allUSDVariants,
            })
          }
          if (item.key === 'aed') {
            const allAEDVariants = variantDefinitions.map(v => ({
              code: v.code,
              apiCode: v.apiCode,
              hasData: !!data[v.apiCode],
              type: v.variantType,
            }))
            console.log(`[ItemCardGrid] AED Variants Summary:`, {
              total: variantDefinitions.length,
              found: variants.length,
              missing: variantDefinitions.filter(v => !data[v.apiCode]).map(v => v.apiCode),
              specificVariants: {
                dubai: !!data['dirham_dubai'],
                tehran: !!data['aed_sell'],
              },
              allVariants: allAEDVariants,
            })
          }
        }

        // Get OHLC data for this item if available
        const ohlcItem = ohlcMap[item.key]
        const ohlcData = ohlcItem ? {
          // Ensure change is a number (backend may return string from toFixed)
          dailyChangePercent: typeof ohlcItem.change === 'string'
            ? parseFloat(ohlcItem.change)
            : ohlcItem.change,
          dataPoints: ohlcItem.dataPoints
        } : undefined

        // Get calculator data for this item
        const calculatorItem = calculatorItemsMap[item.key]
        const quantity = calculatorItem?.quantity || 0

        return (
          <ItemCard
            key={item.key}
            id={item.key}
            code={item.key}
            name={t(`items.${item.key}`)}
            icon={item.icon}
            iconColor={item.color}
            value={itemData.value}
            change={itemData.change}
            type={itemType as ItemType}
            compact={viewMode === 'dual'}
            accentColor={accentColor}
            onClick={isCalculatorMode ? undefined : clickHandlers[item.key]}
            role="listitem"
            hasVariants={itemHasVariants}
            variants={variants}
            ohlc={ohlcData}
            calculatorMode={isCalculatorMode}
            quantity={quantity}
            onQuantityChange={(qty) => handleQuantityChange(item.key, t(`items.${item.key}`), itemData.value, qty)}
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
      if (prevProps.itemType !== nextProps.itemType) changedProps.push('itemType')
      if (prevProps.onItemClick !== nextProps.onItemClick) changedProps.push('onItemClick')
      if (prevProps.viewMode !== nextProps.viewMode) changedProps.push('viewMode')

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
    if (prevProps.itemType !== nextProps.itemType) return false
    if (prevProps.onItemClick !== nextProps.onItemClick) return false
    if (prevProps.viewMode !== nextProps.viewMode) return false

    // All props are equal, skip re-render
    return true
  }
)

ItemCardGrid.displayName = 'ItemCardGrid'
