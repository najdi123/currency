'use client'

import { useEffect, useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '@/lib/hooks'
import {
  selectCalculatorMode,
  selectCalculatorItems,
  selectCalculatorDate,
  setCurrentDate,
  updateAllPrices,
  type CalculatorItem,
} from '@/lib/store/slices/calculatorSlice'

interface MarketDataState {
  currencies: Record<string, any> | undefined
  crypto: Record<string, any> | undefined
  gold: Record<string, any> | undefined
  currenciesLoading: boolean
  cryptoLoading: boolean
  goldLoading: boolean
}

interface UseCalculatorSyncOptions {
  marketData: MarketDataState
  formattedDate: string | null
}

interface UseCalculatorSyncReturn {
  isCalculatorMode: boolean
  calculatorItems: CalculatorItem[]
  calculatorDate: string | undefined
}

/**
 * Hook to synchronize calculator prices when the selected date changes.
 *
 * When the user navigates to a different historical date, this hook:
 * 1. Updates the calculator's current date
 * 2. Fetches new prices from market data for that date
 * 3. Updates all calculator item prices accordingly
 *
 * @param options - Market data and formatted date from historical navigation
 * @returns Calculator state values needed by components
 */
export function useCalculatorSync({
  marketData,
  formattedDate,
}: UseCalculatorSyncOptions): UseCalculatorSyncReturn {
  const dispatch = useAppDispatch()

  // Calculator state from Redux
  const isCalculatorMode = useAppSelector(selectCalculatorMode)
  const calculatorItems = useAppSelector(selectCalculatorItems)
  const calculatorDate = useAppSelector(selectCalculatorDate)

  /**
   * Helper function to get price for a calculator item from current market data
   */
  const getPriceForItem = useCallback(
    (item: CalculatorItem): number => {
      const { type, subType } = item

      if (!subType) return item.unitPrice

      const key = subType.toLowerCase()

      switch (type) {
        case 'currency': {
          return marketData.currencies?.[key]?.value ?? item.unitPrice
        }
        case 'gold': {
          return marketData.gold?.[key]?.value ?? item.unitPrice
        }
        case 'coin': {
          return marketData.crypto?.[key]?.value ?? item.unitPrice
        }
        default:
          return item.unitPrice
      }
    },
    [marketData.currencies, marketData.crypto, marketData.gold]
  )

  /**
   * Date synchronization effect:
   * Updates calculator prices when the selected date changes
   */
  useEffect(() => {
    // Skip if not in calculator mode or no items
    if (!isCalculatorMode || calculatorItems.length === 0) return

    // Skip if market data is still loading
    if (
      marketData.currenciesLoading ||
      marketData.cryptoLoading ||
      marketData.goldLoading
    )
      return

    // Skip if no market data available
    if (!marketData.currencies && !marketData.crypto && !marketData.gold) return

    const currentFormattedDate = formattedDate ?? undefined

    // Update calculator date if it changed
    if (calculatorDate !== currentFormattedDate) {
      dispatch(setCurrentDate(currentFormattedDate))
    }

    // Update all item prices based on current market data
    const priceUpdates = calculatorItems.map((item) => ({
      id: item.id,
      unitPrice: getPriceForItem(item),
    }))

    // Only dispatch if there are actual price changes
    const hasChanges = priceUpdates.some((update) => {
      const item = calculatorItems.find((i) => i.id === update.id)
      return item && item.unitPrice !== update.unitPrice
    })

    if (hasChanges) {
      dispatch(updateAllPrices(priceUpdates))
    }
  }, [
    formattedDate,
    isCalculatorMode,
    calculatorItems,
    calculatorDate,
    marketData.currencies,
    marketData.crypto,
    marketData.gold,
    marketData.currenciesLoading,
    marketData.cryptoLoading,
    marketData.goldLoading,
    dispatch,
    getPriceForItem,
  ])

  return {
    isCalculatorMode,
    calculatorItems,
    calculatorDate,
  }
}
