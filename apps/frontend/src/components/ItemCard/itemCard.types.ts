import { IconType } from 'react-icons'
import type { ItemType } from '@/types/chart'

/**
 * Supported accent color variants - DEPRECATED
 * All variants now use unified blue accent (Apple-style)
 */
export type AccentColorVariant = 'blue' | 'purple' | 'gold'

/**
 * Currency variant data structure
 */
export interface VariantData {
  code: string
  apiCode: string
  variantType: string
  value: string
  change: number
}

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
   * Item type for fetching historical data
   */
  type: ItemType

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

  /**
   * Whether this currency has variants (buy/sell, harat, etc.)
   */
  hasVariants?: boolean

  /**
   * Array of variant data for this currency
   */
  variants?: VariantData[]
}
