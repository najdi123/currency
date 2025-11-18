'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('Chart')
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1w')
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Reset time range when item changes
  useEffect(() => {
    setSelectedTimeRange('1w')
  }, [item?.code])

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement

      // Focus the close button after a short delay to ensure the sheet is rendered
      setTimeout(() => {
        closeButtonRef.current?.focus()
      }, 100)
    } else if (previousFocusRef.current) {
      // Restore focus when closing
      previousFocusRef.current.focus()
    }
  }, [isOpen])

  // Handle Escape key - memoized to prevent recreation
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, handleEscape])

  if (!item) return null

  return (
    <Drawer.Root
      open={isOpen}
      onClose={onClose}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 flex flex-col  bg-bg-elevated border-t border-border-light shadow-xl z-50 max-h-[95vh] animate-slide-up"
          aria-label={t('priceChart')}
        >
          {/* Drag Handle */}
          <div
            className="mx-auto mt-3 mb-2 h-[5px] w-9 bg-text-tertiary/60 animate-pulse-once"
            aria-hidden="true"
          />

          {/* Accessible Title (required for screen readers) */}
          <Drawer.Title className="sr-only">
            {t('priceChart')} {item.name}
          </Drawer.Title>

          {/* Close Button */}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-accent-primary-subtle text-accent transition-apple-fast active-scale-apple focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900 z-10"
            aria-label={t('closeChart')}
            type="button"
          >
            <HiX className="text-xl" aria-hidden="true" />
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
          <div
            id="chart-panel"
            role="tabpanel"
            aria-label={t('priceChart')}
            className="flex-1 overflow-auto px-4 pb-4 pt-4"
          >
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
