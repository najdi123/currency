import { renderHook, waitFor, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { ReactNode } from 'react'

// Mock the store imports
const mockDispatch = jest.fn()
const mockUseAppDispatch = jest.fn(() => mockDispatch)
const mockUseAppSelector = jest.fn()

jest.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockUseAppDispatch(),
  useAppSelector: (selector: (state: unknown) => unknown) => mockUseAppSelector(selector),
}))

// Import after mocking
import { useCalculatorSync } from '../useCalculatorSync'

describe('useCalculatorSync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDispatch.mockClear()
  })

  const mockMarketData = {
    currencies: {
      usd: { value: 50000 },
      eur: { value: 55000 },
    },
    crypto: {
      btc: { value: 2500000000 },
    },
    gold: {
      gold18k: { value: 3000000 },
    },
    currenciesLoading: false,
    cryptoLoading: false,
    goldLoading: false,
  }

  const mockCalculatorItem = {
    id: '1',
    type: 'currency' as const,
    subType: 'USD',
    unitPrice: 48000,
    quantity: 1,
    name: 'US Dollar',
    totalValue: 48000,
  }

  describe('Initial State', () => {
    it('should return calculator mode state from Redux', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [],
            currentDate: undefined,
          },
        }
        return selector(mockState)
      })

      const { result } = renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      expect(result.current.isCalculatorMode).toBe(true)
      expect(result.current.calculatorItems).toEqual([])
      expect(result.current.calculatorDate).toBeUndefined()
    })

    it('should return calculator items from Redux', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [mockCalculatorItem],
            currentDate: '2025-01-15',
          },
        }
        return selector(mockState)
      })

      const { result } = renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      expect(result.current.calculatorItems).toHaveLength(1)
      expect(result.current.calculatorItems[0]).toEqual(mockCalculatorItem)
    })
  })

  describe('Date Synchronization', () => {
    it('should not dispatch when calculator mode is off', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: false,
            items: [mockCalculatorItem],
            currentDate: '2025-01-14',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Should not dispatch when calculator mode is off
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should not dispatch when there are no calculator items', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [],
            currentDate: '2025-01-14',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Should not dispatch when no items
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should not dispatch when market data is loading', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [mockCalculatorItem],
            currentDate: '2025-01-14',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: {
            ...mockMarketData,
            currenciesLoading: true,
          },
          formattedDate: '2025-01-15',
        })
      )

      // Should not dispatch when loading
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should not dispatch when no market data is available', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [mockCalculatorItem],
            currentDate: '2025-01-14',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: {
            currencies: undefined,
            crypto: undefined,
            gold: undefined,
            currenciesLoading: false,
            cryptoLoading: false,
            goldLoading: false,
          },
          formattedDate: '2025-01-15',
        })
      )

      // Should not dispatch when no data
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should dispatch setCurrentDate when date changes', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [mockCalculatorItem],
            currentDate: '2025-01-14',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Should dispatch setCurrentDate action
      expect(mockDispatch).toHaveBeenCalled()
    })

    it('should dispatch updateAllPrices when prices have changed', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [
              {
                ...mockCalculatorItem,
                unitPrice: 48000, // Old price, different from market data (50000)
              },
            ],
            currentDate: '2025-01-15',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Should dispatch updateAllPrices due to price difference
      expect(mockDispatch).toHaveBeenCalled()
    })

    it('should not dispatch updateAllPrices when prices are the same', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [
              {
                ...mockCalculatorItem,
                unitPrice: 50000, // Same as market data
              },
            ],
            currentDate: '2025-01-15', // Same date
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Should not dispatch when prices match and date is same
      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe('Price Resolution', () => {
    it('should get price for currency items', () => {
      const currencyItem = {
        id: '1',
        type: 'currency' as const,
        subType: 'USD',
        unitPrice: 48000,
        quantity: 1,
        name: 'US Dollar',
        totalValue: 48000,
      }

      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [currencyItem],
            currentDate: '2025-01-14',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Price should be resolved from currencies.usd.value (50000)
      expect(mockDispatch).toHaveBeenCalled()
    })

    it('should get price for gold items', () => {
      const goldItem = {
        id: '2',
        type: 'gold' as const,
        subType: 'GOLD18K',
        unitPrice: 2900000,
        quantity: 1,
        name: '18K Gold',
        totalValue: 2900000,
      }

      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [goldItem],
            currentDate: '2025-01-14',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Price should be resolved from gold.gold18k.value (3000000)
      expect(mockDispatch).toHaveBeenCalled()
    })

    it('should get price for crypto items', () => {
      const cryptoItem = {
        id: '3',
        type: 'coin' as const,
        subType: 'BTC',
        unitPrice: 2400000000,
        quantity: 1,
        name: 'Bitcoin',
        totalValue: 2400000000,
      }

      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [cryptoItem],
            currentDate: '2025-01-14',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Price should be resolved from crypto.btc.value (2500000000)
      expect(mockDispatch).toHaveBeenCalled()
    })

    it('should fallback to item unitPrice when market data is missing', () => {
      const currencyItem = {
        id: '1',
        type: 'currency' as const,
        subType: 'GBP', // Not in mock market data
        unitPrice: 60000,
        quantity: 1,
        name: 'British Pound',
        totalValue: 60000,
      }

      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [currencyItem],
            currentDate: '2025-01-15', // Same date so no date update
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Should not dispatch since price falls back to original (no change)
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('should fallback to unitPrice when item has no subType', () => {
      const itemWithoutSubType = {
        id: '1',
        type: 'currency' as const,
        subType: undefined,
        unitPrice: 45000,
        quantity: 1,
        name: 'Custom Item',
        totalValue: 45000,
      }

      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [itemWithoutSubType],
            currentDate: '2025-01-15',
          },
        }
        return selector(mockState)
      })

      renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      // Should not dispatch since no subType means original price is used
      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })

  describe('Return Values', () => {
    it('should return correct structure', () => {
      mockUseAppSelector.mockImplementation((selector) => {
        const mockState = {
          calculator: {
            isCalculatorMode: true,
            items: [mockCalculatorItem],
            currentDate: '2025-01-15',
          },
        }
        return selector(mockState)
      })

      const { result } = renderHook(() =>
        useCalculatorSync({
          marketData: mockMarketData,
          formattedDate: '2025-01-15',
        })
      )

      expect(result.current).toHaveProperty('isCalculatorMode')
      expect(result.current).toHaveProperty('calculatorItems')
      expect(result.current).toHaveProperty('calculatorDate')
    })
  })
})
