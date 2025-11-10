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
  { key: 'aed', icon: FaDollarSign, color: 'text-emerald-600' }, // Emerald for AED (UAE)
  { key: 'cny_hav', icon: FaDollarSign, color: 'text-red-500' }, // Red for CNY (China) - API: cny_hav
  { key: 'try_hav', icon: FaDollarSign, color: 'text-red-700' }, // Deep red for TRY (Turkey) - API: try_hav
  { key: 'chf', icon: FaDollarSign, color: 'text-slate-600' }, // Slate for CHF (Switzerland)
  { key: 'jpy_hav', icon: FaDollarSign, color: 'text-rose-600' }, // Rose for JPY (Japan) - API: jpy_hav
  { key: 'rub', icon: FaDollarSign, color: 'text-blue-500' }, // Blue for RUB (Russia)
  { key: 'inr', icon: FaDollarSign, color: 'text-orange-600' }, // Orange for INR (India)
  { key: 'pkr', icon: FaDollarSign, color: 'text-green-700' }, // Green for PKR (Pakistan)
  { key: 'iqd', icon: FaDollarSign, color: 'text-yellow-700' }, // Yellow for IQD (Iraq)
  { key: 'kwd', icon: FaDollarSign, color: 'text-teal-600' }, // Teal for KWD (Kuwait)
  { key: 'sar', icon: FaDollarSign, color: 'text-green-800' }, // Dark green for SAR (Saudi)
  { key: 'qar', icon: FaDollarSign, color: 'text-purple-500' }, // Purple for QAR (Qatar)
  { key: 'omr', icon: FaDollarSign, color: 'text-red-800' }, // Dark red for OMR (Oman)
  { key: 'bhd', icon: FaDollarSign, color: 'text-red-600' }, // Red for BHD (Bahrain)
]

export const cryptoItems: DataItem[] = [
  { key: 'usdt', icon: SiTether, color: 'text-emerald-600' }, // Tether green brand color
  { key: 'btc', icon: FaBitcoin, color: 'text-orange-500' }, // Bitcoin orange brand color
  { key: 'eth', icon: FaEthereum, color: 'text-indigo-600' }, // Ethereum purple/indigo brand color
  { key: 'bnb', icon: FaBitcoin, color: 'text-yellow-500' }, // BNB yellow
  { key: 'xrp', icon: FaBitcoin, color: 'text-blue-400' }, // XRP blue
  { key: 'ada', icon: FaBitcoin, color: 'text-blue-600' }, // Cardano blue
  { key: 'doge', icon: FaBitcoin, color: 'text-yellow-600' }, // Dogecoin yellow
  { key: 'sol', icon: FaBitcoin, color: 'text-purple-500' }, // Solana purple
  { key: 'matic', icon: FaBitcoin, color: 'text-purple-600' }, // Polygon purple
  { key: 'dot', icon: FaBitcoin, color: 'text-pink-500' }, // Polkadot pink
  { key: 'ltc', icon: FaBitcoin, color: 'text-gray-500' }, // Litecoin gray
]

export const goldItems: DataItem[] = [
  { key: 'sekkeh', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'bahar', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'nim', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'rob', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: 'gerami', icon: GiTwoCoins, color: 'text-yellow-300' }, // Gold color for coins
  { key: '18ayar', icon: GiGoldBar, color: 'text-amber-300' }, // Amber/gold for gold bars
  { key: 'abshodeh', icon: GiGoldBar, color: 'text-yellow-400' }, // Gold for melted gold
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

export const currencyVariants: CurrencyVariant[] = [
  // USD variants (parentCode must match the key in currencyItems: 'usd_sell')
  {
    code: 'usd_buy',
    apiCode: 'usd_buy',
    parentCode: 'usd_sell',
    variantType: 'buy',
    displayOrder: 1,
  },
  {
    code: 'usd_harat_sell',
    apiCode: 'dolar_harat_sell',
    parentCode: 'usd_sell',
    variantType: 'harat',
    displayOrder: 2,
  },
  {
    code: 'usd_harat_cash_sell',
    apiCode: 'harat_naghdi_sell',
    parentCode: 'usd_sell',
    variantType: 'harat',
    displayOrder: 3,
  },
  {
    code: 'usd_harat_cash_buy',
    apiCode: 'harat_naghdi_buy',
    parentCode: 'usd_sell',
    variantType: 'harat',
    displayOrder: 4,
  },
  {
    code: 'usd_tomorrow_sell',
    apiCode: 'usd_farda_sell',
    parentCode: 'usd_sell',
    variantType: 'tomorrow',
    displayOrder: 5,
  },
  {
    code: 'usd_tomorrow_buy',
    apiCode: 'usd_farda_buy',
    parentCode: 'usd_sell',
    variantType: 'tomorrow',
    displayOrder: 6,
  },
  {
    code: 'usd_personal',
    apiCode: 'usd_shakhs',
    parentCode: 'usd_sell',
    variantType: 'special',
    displayOrder: 7,
  },
  {
    code: 'usd_company',
    apiCode: 'usd_sherkat',
    parentCode: 'usd_sell',
    variantType: 'special',
    displayOrder: 8,
  },
  {
    code: 'usd_paypal',
    apiCode: 'usd_pp',
    parentCode: 'usd_sell',
    variantType: 'special',
    displayOrder: 9,
  },
  {
    code: 'usd_mashad_sell',
    apiCode: 'dolar_mashad_sell',
    parentCode: 'usd_sell',
    variantType: 'special',
    displayOrder: 10,
  },
  {
    code: 'usd_kordestan_sell',
    apiCode: 'dolar_kordestan_sell',
    parentCode: 'usd_sell',
    variantType: 'special',
    displayOrder: 11,
  },
  {
    code: 'usd_soleimanie_sell',
    apiCode: 'dolar_soleimanie_sell',
    parentCode: 'usd_sell',
    variantType: 'special',
    displayOrder: 12,
  },
  // AED variants
  {
    code: 'aed_sell',
    apiCode: 'aed_sell',
    parentCode: 'aed',
    variantType: 'sell',
    displayOrder: 1,
  },
  {
    code: 'dirham_dubai',
    apiCode: 'dirham_dubai',
    parentCode: 'aed',
    variantType: 'special',
    displayOrder: 2,
  },
  // EUR variants
  {
    code: 'eur_hawala',
    apiCode: 'eur_hav',
    parentCode: 'eur',
    variantType: 'hawala',
    displayOrder: 1,
  },
  // GBP variants
  {
    code: 'gbp_hawala',
    apiCode: 'gbp_hav',
    parentCode: 'gbp',
    variantType: 'hawala',
    displayOrder: 1,
  },
  {
    code: 'gbp_wholesale',
    apiCode: 'gbp_wht',
    parentCode: 'gbp',
    variantType: 'special',
    displayOrder: 2,
  },
  // CAD variants
  {
    code: 'cad_hawala',
    apiCode: 'cad_hav',
    parentCode: 'cad',
    variantType: 'hawala',
    displayOrder: 1,
  },
  {
    code: 'cad_cash',
    apiCode: 'cad_cash',
    parentCode: 'cad',
    variantType: 'special',
    displayOrder: 2,
  },
  // AUD variants
  {
    code: 'aud_hawala',
    apiCode: 'aud_hav',
    parentCode: 'aud',
    variantType: 'hawala',
    displayOrder: 1,
  },
  {
    code: 'aud_wholesale',
    apiCode: 'aud_wht',
    parentCode: 'aud',
    variantType: 'special',
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
    value: data.value,
    change: data.change,
  }
}

/**
 * Show More Configuration
 * Define which items are shown by default vs in "show more"
 */

export const mainCurrencies = [
  'usd_sell', 'eur', 'gbp', 'cad', 'aud', 'aed', 'cny_hav', 'try_hav'
]

export const additionalCurrencies = [
  'chf', 'jpy_hav', 'rub', 'inr', 'pkr', 'iqd', 'kwd', 'sar', 'qar', 'omr', 'bhd'
]

export const mainCrypto = ['usdt', 'btc', 'eth']

export const additionalCrypto = [
  'bnb', 'xrp', 'ada', 'doge', 'sol', 'matic', 'dot', 'ltc'
]

export const mainGold = ['sekkeh', 'bahar', 'nim', 'rob', 'gerami', '18ayar']

export const additionalGold = ['abshodeh']

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
