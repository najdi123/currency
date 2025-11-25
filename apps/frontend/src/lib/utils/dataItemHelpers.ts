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
// Only includes items that exist in the API response
export const currencyItems: DataItem[] = [
  { key: 'usd_sell', icon: FaDollarSign, color: 'text-green-600' }, // USD Sell
  { key: 'usd_buy', icon: FaDollarSign, color: 'text-green-500' }, // USD Buy
  { key: 'eur', icon: FaEuroSign, color: 'text-blue-600' }, // EUR
  { key: 'eur_buy', icon: FaEuroSign, color: 'text-blue-500' }, // EUR Buy
  { key: 'gbp', icon: FaPoundSign, color: 'text-purple-600' }, // GBP
  { key: 'gbp_buy', icon: FaPoundSign, color: 'text-purple-500' }, // GBP Buy
  { key: 'aed', icon: FaDollarSign, color: 'text-emerald-600' }, // AED
  { key: 'aed_buy', icon: FaDollarSign, color: 'text-emerald-500' }, // AED Buy
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
 * Defines additional variants for currencies (buy/sell, harat, hawala, etc.)
 */
export interface CurrencyVariant {
  code: string
  apiCode: string
  parentCode: string
  variantType: 'buy' | 'sell' | 'harat' | 'tomorrow' | 'special' | 'hawala'
  displayOrder: number
}

// Currency variants - only for currencies that exist in the API
// Note: Buy variants are now in the main currencyItems list
export const currencyVariants: CurrencyVariant[] = [
  // USD variants (parentCode must match the key in currencyItems: 'usd_sell')
  {
    code: 'usd_buy',
    apiCode: 'usd_buy',
    parentCode: 'usd_sell',
    variantType: 'buy',
    displayOrder: 1,
  },
  // EUR variants
  {
    code: 'eur_buy',
    apiCode: 'eur_buy',
    parentCode: 'eur',
    variantType: 'buy',
    displayOrder: 1,
  },
  // GBP variants
  {
    code: 'gbp_buy',
    apiCode: 'gbp_buy',
    parentCode: 'gbp',
    variantType: 'buy',
    displayOrder: 1,
  },
  // AED variants
  {
    code: 'aed_buy',
    apiCode: 'aed_buy',
    parentCode: 'aed',
    variantType: 'buy',
    displayOrder: 1,
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
    value: data.value,
    change: data.change,
  }
}

/**
 * Show More Configuration
 * Define which items are shown by default vs in "show more"
 */

// Main currencies shown by default (most important ones)
export const mainCurrencies = [
  'usd_sell', 'eur', 'gbp', 'aed', 'rub'
]

// Additional currencies shown when "show more" is clicked
export const additionalCurrencies = [
  'usd_buy', 'eur_buy', 'gbp_buy', 'aed_buy'
]

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
