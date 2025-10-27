'use client'

import { useState, useCallback } from 'react'
import type { SelectedChartItem } from '@/types/chart'

interface UseChartBottomSheetReturn {
  isOpen: boolean
  selectedItem: SelectedChartItem | null
  openChart: (item: SelectedChartItem) => void
  closeChart: () => void
}

/**
 * Custom hook for managing chart bottom sheet state
 * Default time range is set to '1w' (1 week) in ChartBottomSheet component
 */
export const useChartBottomSheet = (): UseChartBottomSheetReturn => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SelectedChartItem | null>(null)

  const openChart = useCallback((item: SelectedChartItem) => {
    setSelectedItem(item)
    setIsOpen(true)
  }, [])

  const closeChart = useCallback(() => {
    setIsOpen(false)
    // Delay clearing item to avoid visual flash during close animation
    setTimeout(() => setSelectedItem(null), 300)
  }, [])

  return {
    isOpen,
    selectedItem,
    openChart,
    closeChart,
  }
}
