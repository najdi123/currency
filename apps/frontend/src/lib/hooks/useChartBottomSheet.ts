'use client'

import { useState, useCallback } from 'react'
import type { SelectedChartItem } from '@/types/chart'

/**
 * Animation duration for the drawer close animation
 * This should match the duration used by the Vaul drawer component
 * Default Vaul animation is 300ms
 */
const DRAWER_CLOSE_ANIMATION_DURATION = 300

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
    // Duration matches the Vaul drawer's close animation
    setTimeout(() => setSelectedItem(null), DRAWER_CLOSE_ANIMATION_DURATION)
  }, [])

  return {
    isOpen,
    selectedItem,
    openChart,
    closeChart,
  }
}
