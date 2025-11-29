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
// Only includes MAIN items - variants (buy, regional) are shown in dropdown
export const currencyItems: DataItem[] = [
  { key: 'usd_sell', icon: FaDollarSign, color: 'text-green-600' }, // USD Sell (main)
  { key: 'eur', icon: FaEuroSign, color: 'text-blue-600' }, // EUR (main)
  { key: 'gbp', icon: FaPoundSign, color: 'text-purple-600' }, // GBP (main)
  { key: 'aed', icon: FaDollarSign, color: 'text-emerald-600' }, // AED (main)
  { key: 'try', icon: FaDollarSign, color: 'text-red-600' }, // TRY (Turkish Lira)
  { key: 'rub', icon: FaDollarSign, color: 'text-blue-500' }, // RUB (Russia)
]

// Crypto items - only includes items that exist in the API response
export const cryptoItems: DataItem[] = [
  { key: 'btc', icon: FaBitcoin, color: 'text-orange-500' }, // Bitcoin
  { key: 'eth', icon: FaEthereum, color: 'text-indigo-600' }, // Ethereum
  { key: 'usdt', icon: SiTether, color: 'text-emerald-600' }, // Tether
  { key: 'usdc', icon: FaDollarSign, color: 'text-blue-500' }, // USD Coin
  { key: 'bnb', icon: FaBitcoin, color: 'text-yellow-500' }, // BNB
  { key: 'xrp', icon: FaBitcoin, color: 'text-blue-400' }, // XRP
  { key: 'sol', icon: FaBitcoin, color: 'text-purple-500' }, // Solana
  { key: 'ada', icon: FaBitcoin, color: 'text-blue-600' }, // Cardano
  { key: 'doge', icon: FaBitcoin, color: 'text-yellow-600' }, // Dogecoin
  { key: 'trx', icon: FaBitcoin, color: 'text-red-500' }, // Tron
]

// Gold items - only includes items that exist in the API response
export const goldItems: DataItem[] = [
  { key: '18ayar', icon: GiGoldBar, color: 'text-amber-400' }, // 18k Gold
  { key: '24ayar', icon: GiGoldBar, color: 'text-yellow-400' }, // 24k Gold
  { key: 'sekkeh', icon: GiTwoCoins, color: 'text-yellow-500' }, // Emami Coin
  { key: 'bahar', icon: GiTwoCoins, color: 'text-yellow-500' }, // Bahar Azadi Coin
  { key: 'nim', icon: GiTwoCoins, color: 'text-yellow-400' }, // Half Coin
  { key: 'rob', icon: GiTwoCoins, color: 'text-yellow-400' }, // Quarter Coin
  { key: 'gerami', icon: GiTwoCoins, color: 'text-amber-500' }, // Gerami
  { key: 'abshodeh', icon: GiGoldBar, color: 'text-amber-300' }, // Melted Gold
]

/**
 * Currency Variant Structure
 * Defines additional variants for currencies (buy/sell, regional, etc.)
 */
export type VariantType = 'sell' | 'buy' | 'sell_dubai' | 'buy_dubai' | 'sell_turkey' | 'buy_turkey' | 'sell_herat' | 'buy_herat'
export type RegionType = 'iran' | 'dubai' | 'turkey' | 'herat'

export interface CurrencyVariant {
  code: string
  apiCode: string
  parentCode: string
  variantType: VariantType
  region?: RegionType
  displayOrder: number
}

// Currency variants - shown in the 3-dot dropdown menu
// Includes buy/sell variants and regional variants (Dubai, Turkey, Herat)
export const currencyVariants: CurrencyVariant[] = [
  // ==================== USD Variants ====================
  // Iran (default)
  {
    code: 'usd_sell',
    apiCode: 'usd_sell',
    parentCode: 'usd_sell',
    variantType: 'sell',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'usd_buy',
    apiCode: 'usd_buy',
    parentCode: 'usd_sell',
    variantType: 'buy',
    region: 'iran',
    displayOrder: 1,
  },
  // Dubai
  {
    code: 'usd_sell_dubai',
    apiCode: 'dirham_dubai',
    parentCode: 'usd_sell',
    variantType: 'sell_dubai',
    region: 'dubai',
    displayOrder: 2,
  },
  // Turkey (Istanbul)
  {
    code: 'usd_sell_turkey',
    apiCode: 'dolar_istanbul_sell',
    parentCode: 'usd_sell',
    variantType: 'sell_turkey',
    region: 'turkey',
    displayOrder: 3,
  },
  // Herat
  {
    code: 'usd_sell_herat',
    apiCode: 'dolar_harat_sell',
    parentCode: 'usd_sell',
    variantType: 'sell_herat',
    region: 'herat',
    displayOrder: 4,
  },

  // ==================== EUR Variants ====================
  {
    code: 'eur_sell',
    apiCode: 'eur',
    parentCode: 'eur',
    variantType: 'sell',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'eur_buy',
    apiCode: 'eur_buy',
    parentCode: 'eur',
    variantType: 'buy',
    region: 'iran',
    displayOrder: 1,
  },

  // ==================== GBP Variants ====================
  {
    code: 'gbp_sell',
    apiCode: 'gbp',
    parentCode: 'gbp',
    variantType: 'sell',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'gbp_buy',
    apiCode: 'gbp_buy',
    parentCode: 'gbp',
    variantType: 'buy',
    region: 'iran',
    displayOrder: 1,
  },

  // ==================== AED Variants ====================
  {
    code: 'aed_sell',
    apiCode: 'aed',
    parentCode: 'aed',
    variantType: 'sell',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'aed_buy',
    apiCode: 'aed_buy',
    parentCode: 'aed',
    variantType: 'buy',
    region: 'iran',
    displayOrder: 1,
  },
  // Dubai
  {
    code: 'aed_sell_dubai',
    apiCode: 'dirham_dubai',
    parentCode: 'aed',
    variantType: 'sell_dubai',
    region: 'dubai',
    displayOrder: 2,
  },

  // ==================== TRY (Turkish Lira) Variants ====================
  {
    code: 'try_sell',
    apiCode: 'try',
    parentCode: 'try',
    variantType: 'sell',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'try_buy',
    apiCode: 'try_buy',
    parentCode: 'try',
    variantType: 'buy',
    region: 'iran',
    displayOrder: 1,
  },
  // Turkey (Istanbul)
  {
    code: 'try_sell_turkey',
    apiCode: 'lira_istanbul_sell',
    parentCode: 'try',
    variantType: 'sell_turkey',
    region: 'turkey',
    displayOrder: 2,
  },
]

/**
 * Helper Functions for Currency Variants
 */

/**
 * Get all variants for a given currency code
 */
export function getVariantsForCurrency(currencyCode: string): CurrencyVariant[] {
  return currencyVariants
    .filter(variant => variant.parentCode === currencyCode)
    .sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * Check if a currency has variants
 */
export function hasVariants(currencyCode: string): boolean {
  return currencyVariants.some(variant => variant.parentCode === currencyCode)
}

/**
 * Get variant display data from API data
 */
export function getVariantData(
  variant: CurrencyVariant,
  apiData: Record<string, any>
) {
  const data = apiData[variant.apiCode]
  if (!data) return null

  return {
    code: variant.code,
    apiCode: variant.apiCode,
    variantType: variant.variantType,
    region: variant.region,
    value: data.value,
    change: data.change,
  }
}

/**
 * Show More Configuration
 * Define which items are shown by default vs in "show more"
 */

// Main currencies shown by default (most important ones)
// Variants (buy, regional) are shown in dropdown, not as separate cards
export const mainCurrencies = [
  'usd_sell', 'eur', 'gbp', 'aed', 'try', 'rub'
]

// Additional currencies shown when "show more" is clicked
// Note: Buy variants are now in the dropdown, not as separate cards
export const additionalCurrencies: string[] = []

// Main crypto shown by default
export const mainCrypto = ['btc', 'eth', 'usdt']

// Additional crypto shown when "show more" is clicked
export const additionalCrypto = [
  'usdc', 'bnb', 'xrp', 'sol', 'ada', 'doge', 'trx'
]

// Main gold items shown by default
export const mainGold = ['18ayar', '24ayar', 'sekkeh', 'bahar']

// Additional gold items shown when "show more" is clicked
export const additionalGold = ['nim', 'rob', 'gerami', 'abshodeh']

/**
 * Split items into main and additional for a category
 */
export function splitItemsByVisibility(
  category: 'currencies' | 'crypto' | 'gold',
  allItems: DataItem[]
) {
  const mainList = category === 'currencies' ? mainCurrencies :
                   category === 'crypto' ? mainCrypto : mainGold

  const additionalList = category === 'currencies' ? additionalCurrencies :
                         category === 'crypto' ? additionalCrypto : additionalGold

  const main = allItems.filter(item => mainList.includes(item.key))
  const additional = allItems.filter(item => additionalList.includes(item.key))

  return { main, additional }
}

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
