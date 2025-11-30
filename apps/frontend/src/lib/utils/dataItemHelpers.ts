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
// Only includes MAIN items - variants (official, sana, nima) are shown in dropdown
// Keys must match API response keys exactly (usd, eur, gbp, aed, rub)
export const currencyItems: DataItem[] = [
  { key: 'usd', icon: FaDollarSign, color: 'text-green-600' }, // USD (free market)
  { key: 'eur', icon: FaEuroSign, color: 'text-blue-600' }, // EUR (free market)
  { key: 'gbp', icon: FaPoundSign, color: 'text-purple-600' }, // GBP (free market)
  { key: 'aed', icon: FaDollarSign, color: 'text-emerald-600' }, // AED (free market)
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
 * Defines additional variants for currencies (official, sana, nima rates)
 * These match the actual API response keys
 */
export type VariantType = 'free_market' | 'official' | 'sana_buy' | 'sana_sell' | 'nima' | 'regional_buy' | 'regional_sell'
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
// Matches actual API response keys: usd, usd_official, usd_sana_buy, usd_sana_sell, usd_nima
export const currencyVariants: CurrencyVariant[] = [
  // ==================== USD Variants ====================
  {
    code: 'usd',
    apiCode: 'usd',
    parentCode: 'usd',
    variantType: 'free_market',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'usd_official',
    apiCode: 'usd_official',
    parentCode: 'usd',
    variantType: 'official',
    region: 'iran',
    displayOrder: 1,
  },
  {
    code: 'usd_sana_buy',
    apiCode: 'usd_sana_buy',
    parentCode: 'usd',
    variantType: 'sana_buy',
    region: 'iran',
    displayOrder: 2,
  },
  {
    code: 'usd_sana_sell',
    apiCode: 'usd_sana_sell',
    parentCode: 'usd',
    variantType: 'sana_sell',
    region: 'iran',
    displayOrder: 3,
  },
  {
    code: 'usd_nima',
    apiCode: 'usd_nima',
    parentCode: 'usd',
    variantType: 'nima',
    region: 'iran',
    displayOrder: 4,
  },

  // ==================== EUR Variants ====================
  {
    code: 'eur',
    apiCode: 'eur',
    parentCode: 'eur',
    variantType: 'free_market',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'eur_official',
    apiCode: 'eur_official',
    parentCode: 'eur',
    variantType: 'official',
    region: 'iran',
    displayOrder: 1,
  },
  {
    code: 'eur_sana_buy',
    apiCode: 'eur_sana_buy',
    parentCode: 'eur',
    variantType: 'sana_buy',
    region: 'iran',
    displayOrder: 2,
  },
  {
    code: 'eur_sana_sell',
    apiCode: 'eur_sana_sell',
    parentCode: 'eur',
    variantType: 'sana_sell',
    region: 'iran',
    displayOrder: 3,
  },
  {
    code: 'eur_nima',
    apiCode: 'eur_nima',
    parentCode: 'eur',
    variantType: 'nima',
    region: 'iran',
    displayOrder: 4,
  },

  // ==================== GBP Variants ====================
  {
    code: 'gbp',
    apiCode: 'gbp',
    parentCode: 'gbp',
    variantType: 'free_market',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'gbp_official',
    apiCode: 'gbp_official',
    parentCode: 'gbp',
    variantType: 'official',
    region: 'iran',
    displayOrder: 1,
  },
  {
    code: 'gbp_sana_buy',
    apiCode: 'gbp_sana_buy',
    parentCode: 'gbp',
    variantType: 'sana_buy',
    region: 'iran',
    displayOrder: 2,
  },
  {
    code: 'gbp_sana_sell',
    apiCode: 'gbp_sana_sell',
    parentCode: 'gbp',
    variantType: 'sana_sell',
    region: 'iran',
    displayOrder: 3,
  },
  {
    code: 'gbp_nima',
    apiCode: 'gbp_nima',
    parentCode: 'gbp',
    variantType: 'nima',
    region: 'iran',
    displayOrder: 4,
  },

  // ==================== AED Variants ====================
  {
    code: 'aed',
    apiCode: 'aed',
    parentCode: 'aed',
    variantType: 'free_market',
    region: 'iran',
    displayOrder: 0,
  },
  {
    code: 'aed_official',
    apiCode: 'aed_official',
    parentCode: 'aed',
    variantType: 'official',
    region: 'iran',
    displayOrder: 1,
  },
  {
    code: 'aed_sana_buy',
    apiCode: 'aed_sana_buy',
    parentCode: 'aed',
    variantType: 'sana_buy',
    region: 'iran',
    displayOrder: 2,
  },
  {
    code: 'aed_sana_sell',
    apiCode: 'aed_sana_sell',
    parentCode: 'aed',
    variantType: 'sana_sell',
    region: 'iran',
    displayOrder: 3,
  },
  {
    code: 'aed_nima',
    apiCode: 'aed_nima',
    parentCode: 'aed',
    variantType: 'nima',
    region: 'iran',
    displayOrder: 4,
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
// Variants (official, sana, nima) are shown in dropdown, not as separate cards
export const mainCurrencies = [
  'usd', 'eur', 'gbp', 'aed', 'rub'
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

/**
 * Regional Variant from API
 * Structure returned by /market-data/variants/:parentCode endpoint
 */
export interface RegionalVariantFromApi {
  code: string
  price: number
  change: number
  region?: string
  variant?: string // 'buy' | 'sell'
  name: string
  nameFa?: string
  nameAr?: string
}

/**
 * Convert a regional variant from API to CurrencyVariant format
 * This allows dynamic variants to be used alongside static ones
 */
export function convertRegionalVariant(
  apiVariant: RegionalVariantFromApi,
  parentCode: string,
  displayOrder: number
): CurrencyVariant {
  // Determine variant type based on variant field
  let variantType: VariantType = 'regional_buy'
  if (apiVariant.variant === 'sell') {
    variantType = 'regional_sell'
  } else if (apiVariant.variant === 'buy') {
    variantType = 'regional_buy'
  }

  // Map region string to RegionType
  let region: RegionType = 'iran'
  if (apiVariant.region === 'dubai') {
    region = 'dubai'
  } else if (apiVariant.region === 'turkey') {
    region = 'turkey'
  } else if (apiVariant.region === 'herat') {
    region = 'herat'
  }

  return {
    code: apiVariant.code,
    apiCode: apiVariant.code,
    parentCode: parentCode.toLowerCase(),
    variantType,
    region,
    displayOrder,
  }
}

/**
 * Get all variants for a currency - static + dynamic from API
 * @param currencyCode - The parent currency code (e.g., 'usd')
 * @param dynamicVariants - Optional array of regional variants from API
 */
export function getAllVariantsForCurrency(
  currencyCode: string,
  dynamicVariants?: RegionalVariantFromApi[]
): CurrencyVariant[] {
  // Get static variants
  const staticVariants = getVariantsForCurrency(currencyCode)

  // If no dynamic variants, just return static
  if (!dynamicVariants || dynamicVariants.length === 0) {
    return staticVariants
  }

  // Convert and merge dynamic variants
  const startOrder = staticVariants.length > 0
    ? Math.max(...staticVariants.map(v => v.displayOrder)) + 1
    : 0

  const convertedDynamic = dynamicVariants.map((v, index) =>
    convertRegionalVariant(v, currencyCode, startOrder + index)
  )

  return [...staticVariants, ...convertedDynamic]
}

/**
 * Get variant data for a dynamic variant from API
 * Used when the variant price comes from the API response directly
 */
export function getDynamicVariantData(
  variant: CurrencyVariant,
  apiVariant: RegionalVariantFromApi
) {
  return {
    code: variant.code,
    apiCode: variant.apiCode,
    variantType: variant.variantType,
    region: variant.region,
    value: String(apiVariant.price),
    change: apiVariant.change,
  }
}

/**
 * Regional variant patterns for detecting admin-added variants in API data
 * These patterns match keys like: usd_dubai_buy, usd_turkey_sell, eur_herat_buy
 */
const REGIONAL_PATTERNS = [
  { pattern: /_dubai_buy$/, region: 'dubai' as RegionType, variant: 'regional_buy' as VariantType },
  { pattern: /_dubai_sell$/, region: 'dubai' as RegionType, variant: 'regional_sell' as VariantType },
  { pattern: /_turkey_buy$/, region: 'turkey' as RegionType, variant: 'regional_buy' as VariantType },
  { pattern: /_turkey_sell$/, region: 'turkey' as RegionType, variant: 'regional_sell' as VariantType },
  { pattern: /_herat_buy$/, region: 'herat' as RegionType, variant: 'regional_buy' as VariantType },
  { pattern: /_herat_sell$/, region: 'herat' as RegionType, variant: 'regional_sell' as VariantType },
]

/**
 * Scan API data for dynamic regional variants that belong to a parent currency
 * This detects admin-added variants by pattern matching (e.g., usd_dubai_buy, usd_turkey_sell)
 * @param parentCode - The parent currency code (e.g., 'usd')
 * @param apiData - The API response data containing all currency values
 */
export function findDynamicVariantsInData(
  parentCode: string,
  apiData: Record<string, any>
): CurrencyVariant[] {
  const normalizedParent = parentCode.toLowerCase()
  const dynamicVariants: CurrencyVariant[] = []
  let displayOrder = 100 // Start after static variants

  // Check each API data key for regional patterns
  for (const key of Object.keys(apiData)) {
    // Skip if not starting with parent code
    if (!key.toLowerCase().startsWith(normalizedParent + '_')) continue

    // Skip if it's a known static variant (official, sana, nima)
    if (key.includes('_official') || key.includes('_sana') || key.includes('_nima')) continue

    // Check against regional patterns
    for (const { pattern, region, variant } of REGIONAL_PATTERNS) {
      if (pattern.test(key)) {
        dynamicVariants.push({
          code: key,
          apiCode: key,
          parentCode: normalizedParent,
          variantType: variant,
          region: region,
          displayOrder: displayOrder++,
        })
        break
      }
    }
  }

  return dynamicVariants
}

/**
 * Get all variants for a currency including both static and dynamic (from API data)
 * This combines hardcoded variants with admin-added regional variants found in data
 * @param currencyCode - The parent currency code (e.g., 'usd')
 * @param apiData - The API response data to scan for dynamic variants
 */
export function getCompleteVariantsForCurrency(
  currencyCode: string,
  apiData: Record<string, any>
): CurrencyVariant[] {
  // Get static variants (official, sana, nima)
  const staticVariants = getVariantsForCurrency(currencyCode)

  // Find dynamic regional variants in the API data
  const dynamicVariants = findDynamicVariantsInData(currencyCode, apiData)

  // Combine both
  return [...staticVariants, ...dynamicVariants]
}
