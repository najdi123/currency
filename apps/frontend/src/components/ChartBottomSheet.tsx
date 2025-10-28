'use client'

import React, { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import type { SelectedChartItem, TimeRange } from '@/types/chart'
import { ChartHeader } from './Chart/ChartHeader'
import { TimeRangeSelector } from './Chart/TimeRangeSelector'
import { PriceChart } from './Chart/PriceChart'
import { HiX } from 'react-icons/hi'

interface ChartBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  item: SelectedChartItem | null
}

export const ChartBottomSheet: React.FC<ChartBottomSheetProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1w')

  // Reset time range when opening with new item
  useEffect(() => {
    if (isOpen) {
      setSelectedTimeRange('1w')
    }
  }, [isOpen, item?.code])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!item) return null

  return (
    <Drawer.Root
      open={isOpen}
      onClose={onClose}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={onClose}
        />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 flex flex-col rounded-t-[24px] bg-surface border-t-4 border-blue-500 dark:border-blue-400 shadow-xl z-50 max-h-[95vh]"
          aria-label="نمودار قیمت"
        >
          {/* Drag Handle */}
          <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />

          {/* Accessible Title (required for screen readers) */}
          <Drawer.Title className="sr-only">
            نمودار قیمت {item.name}
          </Drawer.Title>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 z-10"
            aria-label="بستن نمودار"
          >
            <HiX className="text-xl text-text-primary" />
          </button>

          {/* Header */}
          <ChartHeader
            itemName={item.name}
            currentPrice={item.price}
            priceChange={item.change}
          />

          {/* Time Range Selector */}
          <TimeRangeSelector
            selectedRange={selectedTimeRange}
            onRangeChange={setSelectedTimeRange}
          />

          {/* Chart */}
          <div className="flex-1 overflow-auto px-4 pb-4 pt-4">
            <PriceChart
              itemCode={item.code}
              itemType={item.type}
              timeRange={selectedTimeRange}
              itemName={item.name}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
