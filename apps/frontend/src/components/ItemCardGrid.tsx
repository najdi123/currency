import React, { useMemo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { IconType } from 'react-icons'
import { ItemCard, AccentColorVariant } from './ItemCard'
import { hasVariants, getVariantData, getCompleteVariantsForCurrency } from '@/lib/utils/dataItemHelpers'
import { useGetAllTodayOhlcQuery } from '@/lib/store/services/api'
import type { OhlcResponse } from '@/lib/store/services/api'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import {
  selectCalculatorMode,
  selectCalculatorItems,
  addItem,
  updateItemQuantity,
  updateItemVariant,
  removeItem,
  type ItemType as CalculatorItemType,
} from '@/lib/store/slices/calculatorSlice'
import type { ItemType } from '@/types/chart'
import type { VariantData } from './ItemCard/itemCard.types'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Threshold to determine if API change is percentage vs absolute value */
const PERCENTAGE_THRESHOLD = 1

// =============================================================================
// TYPES
// =============================================================================

interface ItemData {
  value: number
  change: number
}

interface ChangeData {
  dailyChangePercent: number
  absoluteChange: number
}

interface GridItemConfig {
  key: string
  icon: IconType
  color: string
}

// =============================================================================
// UTILITY FUNCTIONS (extracted for testability)
// =============================================================================

/**
 * Map display item types to calculator item types
 * - 'crypto' and 'coins' both map to 'coin' in calculator
 * - 'currency' and 'gold' stay the same
 */
export const mapToCalculatorItemType = (displayType: string): CalculatorItemType => {
  if (displayType === 'crypto' || displayType === 'coins') {
    return 'coin'
  }
  if (displayType === 'currency' || displayType === 'gold') {
    return displayType as CalculatorItemType
  }
  return 'custom'
}

/**
 * Calculate change data from OHLC or API data
 * Extracted for testability and reuse
 */
export const calculateChangeData = (
  ohlcItem: OhlcResponse | undefined,
  itemData: ItemData
): ChangeData => {
  // Priority: Use OHLC if available and non-zero
  if (ohlcItem && (ohlcItem.change !== 0 || ohlcItem.absoluteChange !== 0)) {
    return {
      dailyChangePercent: typeof ohlcItem.change === 'string'
        ? parseFloat(ohlcItem.change)
        : ohlcItem.change,
      absoluteChange: ohlcItem.absoluteChange || 0,
    }
  }

  // Fallback: compute from API change data
  const apiChange = itemData.change

  // Values < PERCENTAGE_THRESHOLD are percentages (e.g., 0.035 for 3.5%)
  // Values >= PERCENTAGE_THRESHOLD are absolute Toman (e.g., 26 for gold)
  if (Math.abs(apiChange) < PERCENTAGE_THRESHOLD) {
    return {
      dailyChangePercent: apiChange,
      absoluteChange: itemData.value * apiChange,
    }
  }

  return {
    absoluteChange: apiChange,
    dailyChangePercent: itemData.value !== 0 ? apiChange / itemData.value : 0,
  }
}

/**
 * Get grid CSS classes based on view mode
 */
const getGridClasses = (viewMode: 'single' | 'dual'): string => {
  const colClasses = viewMode === 'dual'
    ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  const gapClasses = viewMode === 'dual'
    ? 'gap-2 sm:gap-4 lg:gap-6 xl:gap-8'
    : 'gap-4 sm:gap-6 lg:gap-8'

  return `grid ${colClasses} ${gapClasses} w-full`
}

// =============================================================================
// PROPS INTERFACE
// =============================================================================

export interface ItemCardGridProps {
  /**
   * Array of items to display
   */
  items: Array<GridItemConfig>

  /**
   * Data object containing values for each item
   */
  data: Record<string, ItemData> | null

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

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * ItemCardGrid - A responsive grid layout for displaying currency/gold cards
 *
 * Features:
 * - Automatic grid layout with consistent spacing
 * - Filters out items with no data
 * - Calculator mode with variant selection
 * - OHLC data integration
 * - Fully accessible with ARIA list/listitem relationships
 * - Performance optimized with memoization
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

  // Track selected variants for each currency item
  const [selectedVariants, setSelectedVariants] = useState<Record<string, { code: string; value: number }>>({})

  // ==========================================================================
  // MEMOIZED LOOKUPS
  // ==========================================================================

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
      const itemKey = item.subType?.toLowerCase() || item.id
      acc[itemKey] = item
      return acc
    }, {} as Record<string, typeof calculatorItems[0]>)
  }, [calculatorItems])

  // Pre-compute variants for all items (moved out of render loop)
  const variantsMap = useMemo(() => {
    if (!data || itemType !== 'currency') return {}

    return items.reduce((acc, item) => {
      if (hasVariants(item.key)) {
        const variantDefinitions = getCompleteVariantsForCurrency(item.key, data)
        acc[item.key] = variantDefinitions
          .map((v) => getVariantData(v, data))
          .filter((v): v is NonNullable<typeof v> => v !== null)
      }
      return acc
    }, {} as Record<string, VariantData[]>)
  }, [items, data, itemType])

  // Pre-compute OHLC data for all items (moved out of render loop)
  const ohlcDataMap = useMemo(() => {
    if (!data) return {}

    return items.reduce((acc, item) => {
      const itemData = data[item.key]
      if (itemData) {
        const ohlcItem = ohlcMap[item.key]
        const changeData = calculateChangeData(ohlcItem, itemData)
        acc[item.key] = {
          ...changeData,
          dataPoints: ohlcItem?.dataPoints || []
        }
      }
      return acc
    }, {} as Record<string, ChangeData & { dataPoints: Array<{ time: string; price: number }> }>)
  }, [items, data, ohlcMap])

  // ==========================================================================
  // MEMOIZED HANDLERS (fixes inline arrow functions)
  // ==========================================================================

  // Handler for variant selection
  const handleSelectVariant = useCallback((itemKey: string, variant: VariantData) => {
    const variantValue = Number(variant.value)

    // Validate variant value
    if (isNaN(variantValue)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[ItemCardGrid] Invalid variant value for ${variant.code}:`, variant.value)
      }
      return
    }

    setSelectedVariants(prev => ({
      ...prev,
      [itemKey]: {
        code: variant.code,
        value: variantValue,
      }
    }))

    // Update calculator item if already added
    const existingItem = calculatorItemsMap[itemKey]
    if (existingItem) {
      const variantName = t(`currencyVariants.${variant.code}`)
      dispatch(updateItemVariant({
        id: existingItem.id,
        unitPrice: variantValue,
        variantCode: variant.code,
        variantName,
      }))
    }
  }, [calculatorItemsMap, dispatch, t])

  // Handler for quantity changes in calculator mode
  const handleQuantityChange = useCallback((
    itemKey: string,
    itemName: string,
    unitPrice: number,
    quantity: number,
    variantCode?: string,
    variantName?: string
  ) => {
    const existingItem = calculatorItemsMap[itemKey]

    if (existingItem) {
      if (quantity === 0) {
        dispatch(removeItem(existingItem.id))
      } else {
        dispatch(updateItemQuantity({ id: existingItem.id, quantity }))
      }
    } else if (quantity > 0) {
      dispatch(addItem({
        type: mapToCalculatorItemType(itemType),
        subType: itemKey.toUpperCase() as any,
        name: itemName,
        quantity,
        unitPrice,
        variantCode,
        variantName,
      }))
    }
  }, [calculatorItemsMap, dispatch, itemType])

  // Memoize click handlers
  const clickHandlers = useMemo(() => {
    if (!onItemClick) return {}

    return items.reduce((acc, item) => {
      acc[item.key] = () => onItemClick(item.key)
      return acc
    }, {} as Record<string, () => void>)
  }, [items, onItemClick])

  // Memoize quantity change handlers (fixes inline arrow function in render)
  const quantityHandlers = useMemo(() => {
    if (!data) return {}

    return items.reduce((acc, item) => {
      const itemData = data[item.key]
      if (itemData) {
        // ✅ Handler reads current value at invocation time (fixes stale closure bug)
        acc[item.key] = (qty: number) => {
          const currentSelectedVariant = selectedVariants[item.key]
          const currentDisplayValue = currentSelectedVariant?.value ?? itemData.value
          const itemName = t(`items.${item.key}`)

          // Get variant metadata
          const variantCode = currentSelectedVariant?.code
          const variantName = variantCode ? t(`currencyVariants.${variantCode}`) : undefined

          // Validation
          if (isNaN(currentDisplayValue) || currentDisplayValue <= 0) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `[ItemCardGrid] Invalid display value for ${item.key}:`,
                currentDisplayValue,
                'selectedVariant:', currentSelectedVariant
              )
            }
            return
          }

          handleQuantityChange(item.key, itemName, currentDisplayValue, qty, variantCode, variantName)
        }
      }
      return acc
    }, {} as Record<string, (qty: number) => void>)
  }, [items, data, selectedVariants, handleQuantityChange, t])

  // Memoize variant select handlers (fixes inline arrow function in render)
  const variantSelectHandlers = useMemo(() => {
    return items.reduce((acc, item) => {
      acc[item.key] = (variant: VariantData) => handleSelectVariant(item.key, variant)
      return acc
    }, {} as Record<string, (variant: VariantData) => void>)
  }, [items, handleSelectVariant])

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // Handle missing data with explicit empty state
  if (!data) {
    return null
  }

  return (
    <div
      className={getGridClasses(viewMode)}
      role="list"
      aria-label={t('accessibility.priceItemsList') || 'Price items list'}
    >
      {items.map((item) => {
        const itemData = data[item.key]
        if (!itemData) return null

        const itemHasVariants = itemType === 'currency' && hasVariants(item.key)
        const variants = variantsMap[item.key] || []
        const ohlcItemData = ohlcDataMap[item.key]

        const calculatorItem = calculatorItemsMap[item.key]
        const quantity = calculatorItem?.quantity || 0

        const selectedVariantInfo = selectedVariants[item.key]
        const displayValue = selectedVariantInfo?.value ?? itemData.value
        const selectedVariantCode = selectedVariantInfo?.code

        return (
          <ItemCard
            key={item.key}
            id={item.key}
            code={item.key}
            name={t(`items.${item.key}`)}
            icon={item.icon}
            iconColor={item.color}
            value={displayValue}
            change={itemData.change}
            type={itemType as ItemType}
            compact={viewMode === 'dual'}
            accentColor={accentColor}
            onClick={isCalculatorMode ? undefined : clickHandlers[item.key]}
            role="listitem"
            hasVariants={itemHasVariants}
            variants={variants}
            ohlc={ohlcItemData}
            calculatorMode={isCalculatorMode}
            quantity={quantity}
            onQuantityChange={quantityHandlers[item.key]}
            selectedVariant={selectedVariantCode}
            onSelectVariant={variantSelectHandlers[item.key]}
          />
        )
      })}
    </div>
  )
}

// =============================================================================
// MEMOIZED EXPORT
// =============================================================================

/**
 * Memoized ItemCardGrid component with custom comparison function
 */
export const ItemCardGrid = React.memo<ItemCardGridProps>(
  ItemCardGridComponent,
  (prevProps, nextProps) => {
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
