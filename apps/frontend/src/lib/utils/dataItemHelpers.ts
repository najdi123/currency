import { FaDollarSign, FaEuroSign, FaPoundSign, FaBitcoin, FaEthereum } from 'react-icons/fa'
import { SiTether } from 'react-icons/si'
import { GiGoldBar, GiTwoCoins } from 'react-icons/gi'
import type { ItemType } from '@/types/chart'
import type { IconType } from 'react-icons'

export interface DataItem {
  key: string
  name: string
  icon: IconType
  color: string
}

// Currency items to display with brand-specific colors
export const currencyItems: DataItem[] = [
  { key: 'usd_sell', name: 'دلار آمریکا', icon: FaDollarSign, color: 'text-green-600' }, // Green for USD
  { key: 'eur', name: 'یورو', icon: FaEuroSign, color: 'text-blue-600' }, // Blue for EUR (EU flag color)
  { key: 'gbp', name: 'پوند انگلیس', icon: FaPoundSign, color: 'text-purple-600' }, // Purple for GBP (British royal purple)
  { key: 'cad', name: 'دلار کانادا', icon: FaDollarSign, color: 'text-red-600' }, // Red for CAD (Canadian flag)
  { key: 'aud', name: 'دلار استرالیا', icon: FaDollarSign, color: 'text-amber-600' }, // Gold/amber for AUD (Australian gold)
]

export const cryptoItems: DataItem[] = [
  { key: 'usdt', name: 'تتر', icon: SiTether, color: 'text-emerald-600' }, // Tether green brand color
  { key: 'btc', name: 'بیت کوین', icon: FaBitcoin, color: 'text-orange-500' }, // Bitcoin orange brand color
  { key: 'eth', name: 'اتریوم', icon: FaEthereum, color: 'text-indigo-600' }, // Ethereum purple/indigo brand color
]

export const goldItems: DataItem[] = [
  { key: 'sekkeh', name: 'سکه امامی', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'bahar', name: 'بهار آزادی', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'nim', name: 'نیم سکه', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'rob', name: 'ربع سکه', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'gerami', name: 'سکه گرمی', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: '18ayar', name: 'طلای 18 عیار', icon: GiGoldBar, color: 'text-amber-300' }, // Amber/gold for gold bars
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
 */
export const getItemName = (itemKey: string, itemType: ItemType): string => {
  const items = itemType === 'currency' ? currencyItems : itemType === 'crypto' ? cryptoItems : goldItems
  return items.find(item => item.key === itemKey)?.name || itemKey
}
