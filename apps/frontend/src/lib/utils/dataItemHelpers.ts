import { FaDollarSign, FaEuroSign, FaPoundSign, FaBitcoin, FaEthereum } from 'react-icons/fa'
import { SiTether } from 'react-icons/si'
import { GiGoldBar, GiTwoCoins } from 'react-icons/gi'
import type { ItemType } from '@/types/chart'
import type { IconType } from 'react-icons'

export interface DataItem {
  key: string
  icon: IconType
  color: string
}

// Currency items to display with brand-specific colors
export const currencyItems: DataItem[] = [
  { key: 'usd_sell', icon: FaDollarSign, color: 'text-green-600' }, // Green for USD
  { key: 'eur', icon: FaEuroSign, color: 'text-blue-600' }, // Blue for EUR (EU flag color)
  { key: 'gbp', icon: FaPoundSign, color: 'text-purple-600' }, // Purple for GBP (British royal purple)
  { key: 'cad', icon: FaDollarSign, color: 'text-red-600' }, // Red for CAD (Canadian flag)
  { key: 'aud', icon: FaDollarSign, color: 'text-amber-600' }, // Gold/amber for AUD (Australian gold)
]

export const cryptoItems: DataItem[] = [
  { key: 'usdt', icon: SiTether, color: 'text-emerald-600' }, // Tether green brand color
  { key: 'btc', icon: FaBitcoin, color: 'text-orange-500' }, // Bitcoin orange brand color
  { key: 'eth', icon: FaEthereum, color: 'text-indigo-600' }, // Ethereum purple/indigo brand color
]

export const goldItems: DataItem[] = [
  { key: 'sekkeh', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'bahar', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'nim', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'rob', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'gerami', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: '18ayar', icon: GiGoldBar, color: 'text-amber-300' }, // Amber/gold for gold bars
]

/**
 * Get item data from the appropriate data source based on item type
 */
export const getItemData = (
  itemKey: string,
  itemType: ItemType,
  currencies: any,
  crypto: any,
  gold: any
) => {
  switch (itemType) {
    case 'currency':
      return currencies?.[itemKey]
    case 'crypto':
      return crypto?.[itemKey]
    case 'gold':
      return gold?.[itemKey]
    default:
      return null
  }
}

/**
 * Get the display name for an item based on its key and type
 * @param itemKey - The key of the item
 * @param itemType - The type of the item (currency, crypto, or gold)
 * @param t - Translation function from useTranslations('Home')
 */
export const getItemName = (
  itemKey: string,
  itemType: ItemType,
  t?: (key: string) => string
): string => {
  // If translation function is provided, use it
  if (t) {
    return t(`items.${itemKey}`)
  }
  // Fallback to the key itself if no translation provided
  return itemKey
}
