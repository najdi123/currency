import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

export type ItemType = 'currency' | 'gold' | 'coin' | 'custom'
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'AED' | 'CNY' | 'TRY'
export type GoldType = '18ayar'
export type CoinType = 'sekkeh' | 'bahar' | 'nim' | 'rob' | 'gerami'

export interface CalculatorItem {
  id: string
  type: ItemType
  subType?: CurrencyCode | GoldType | CoinType
  name: string
  quantity: number
  unitPrice: number // Price in Toman
  totalValue: number // quantity * unitPrice
  date?: string // For historical calculations
  variantCode?: string // e.g., "usd_turkey_sell"
  variantName?: string // e.g., "US Dollar Turkey (Sell)"
}

export interface CalculationHistory {
  id: string
  items: CalculatorItem[]
  totalValue: number
  date: string
  createdAt: string
  description?: string
}

export interface CalculatorState {
  items: CalculatorItem[]
  totalValue: number
  history: CalculationHistory[]
  currentDate?: string // Date for which rates are being used
  isCalculatorMode: boolean // Whether calculator mode is active
}

// Load history from localStorage
const loadHistoryFromStorage = (): CalculationHistory[] => {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem('calculatorHistory')
    if (stored) {
      const history = JSON.parse(stored) as CalculationHistory[]
      // Keep only last 10 calculations
      return history.slice(-10)
    }
  } catch (error) {
    console.error('Error loading calculator history:', error)
  }

  return []
}

// Save history to localStorage
const saveHistoryToStorage = (history: CalculationHistory[]) => {
  if (typeof window === 'undefined') return

  try {
    // Keep only last 10 calculations
    const toSave = history.slice(-10)
    localStorage.setItem('calculatorHistory', JSON.stringify(toSave))
  } catch (error) {
    console.error('Error saving calculator history:', error)
  }
}

const initialState: CalculatorState = {
  items: [],
  totalValue: 0,
  history: loadHistoryFromStorage(),
  currentDate: undefined,
  isCalculatorMode: false,
}

const calculatorSlice = createSlice({
  name: 'calculator',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<Omit<CalculatorItem, 'id' | 'totalValue'>>) => {
      const newItem: CalculatorItem = {
        ...action.payload,
        id: `${Date.now()}-${Math.random()}`,
        totalValue: action.payload.quantity * action.payload.unitPrice,
      }
      state.items.push(newItem)
      state.totalValue = state.items.reduce((sum, item) => sum + item.totalValue, 0)
    },

    updateItemQuantity: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
      const item = state.items.find(i => i.id === action.payload.id)
      if (item) {
        item.quantity = action.payload.quantity
        item.totalValue = item.quantity * item.unitPrice
        state.totalValue = state.items.reduce((sum, item) => sum + item.totalValue, 0)
      }
    },

    updateItemVariant: (state, action: PayloadAction<{
      id: string
      unitPrice: number
      variantCode?: string
      variantName?: string
    }>) => {
      const item = state.items.find(i => i.id === action.payload.id)
      if (item) {
        item.unitPrice = action.payload.unitPrice
        item.variantCode = action.payload.variantCode
        item.variantName = action.payload.variantName
        item.totalValue = item.quantity * item.unitPrice
        state.totalValue = state.items.reduce((sum, item) => sum + item.totalValue, 0)
      }
    },

    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload)
      state.totalValue = state.items.reduce((sum, item) => sum + item.totalValue, 0)
    },

    clearAllItems: (state) => {
      state.items = []
      state.totalValue = 0
    },

    setCurrentDate: (state, action: PayloadAction<string | undefined>) => {
      state.currentDate = action.payload
    },

    setCalculatorMode: (state, action: PayloadAction<boolean>) => {
      state.isCalculatorMode = action.payload
    },

    toggleCalculatorMode: (state) => {
      state.isCalculatorMode = !state.isCalculatorMode
    },

    saveToHistory: (state, action: PayloadAction<{ description?: string }>) => {
      if (state.items.length === 0) return

      const historyEntry: CalculationHistory = {
        id: `history-${Date.now()}`,
        items: [...state.items],
        totalValue: state.totalValue,
        date: state.currentDate || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        description: action.payload.description,
      }

      state.history.push(historyEntry)
      // Keep only last 10 entries
      if (state.history.length > 10) {
        state.history = state.history.slice(-10)
      }

      saveHistoryToStorage(state.history)
    },

    loadFromHistory: (state, action: PayloadAction<string>) => {
      const historyEntry = state.history.find(h => h.id === action.payload)
      if (historyEntry) {
        state.items = [...historyEntry.items]
        state.totalValue = historyEntry.totalValue
        state.currentDate = historyEntry.date
      }
    },

    clearHistory: (state) => {
      state.history = []
      saveHistoryToStorage([])
    },

    removeFromHistory: (state, action: PayloadAction<string>) => {
      state.history = state.history.filter(h => h.id !== action.payload)
      saveHistoryToStorage(state.history)
    },

    // Batch update all item prices (useful when date changes)
    updateAllPrices: (state, action: PayloadAction<{ id: string; unitPrice: number }[]>) => {
      action.payload.forEach(update => {
        const item = state.items.find(i => i.id === update.id)
        if (item) {
          item.unitPrice = update.unitPrice
          item.totalValue = item.quantity * item.unitPrice
        }
      })
      state.totalValue = state.items.reduce((sum, item) => sum + item.totalValue, 0)
    },
  },
})

export const {
  addItem,
  updateItemQuantity,
  updateItemVariant,
  removeItem,
  clearAllItems,
  setCurrentDate,
  setCalculatorMode,
  toggleCalculatorMode,
  saveToHistory,
  loadFromHistory,
  clearHistory,
  removeFromHistory,
  updateAllPrices,
} = calculatorSlice.actions

// Selectors
export const selectCalculatorItems = (state: RootState) => state.calculator.items
export const selectCalculatorTotal = (state: RootState) => state.calculator.totalValue
export const selectCalculatorHistory = (state: RootState) => state.calculator.history
export const selectCalculatorDate = (state: RootState) => state.calculator.currentDate
export const selectCalculatorMode = (state: RootState) => state.calculator.isCalculatorMode
export const selectCalculatorState = (state: RootState) => state.calculator

export default calculatorSlice.reducer