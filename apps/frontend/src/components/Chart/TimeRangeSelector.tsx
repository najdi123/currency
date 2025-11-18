import React from 'react'
import type { TimeRange, TimeRangeOption } from '@/types/chart'

interface TimeRangeSelectorProps {
  selectedRange: TimeRange
  onRangeChange: (range: TimeRange) => void
  disabled?: boolean
}

const TIME_RANGES: TimeRangeOption[] = [
  { value: '1d', label: '1D', labelFa: '۱ روز' },
  { value: '1w', label: '1W', labelFa: '۱ هفته' },
  { value: '1m', label: '1M', labelFa: '۱ ماه' },
  { value: '3m', label: '3M', labelFa: '۳ ماه' },
  { value: '1y', label: '1Y', labelFa: '۱ سال' },
  { value: 'all', label: 'ALL', labelFa: 'همه' },
]

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onRangeChange,
  disabled = false,
}) => {
  return (
    <div
      className="flex items-center justify-center gap-2 flex-wrap px-4 py-3 border-b border-border-light bg-bg-elevated"
      role="tablist"
      aria-label="انتخاب بازه زمانی نمودار"
    >
      {TIME_RANGES.map((range) => {
        const isActive = selectedRange === range.value

        return (
          <button
            key={range.value}
            onClick={() => onRangeChange(range.value)}
            disabled={disabled}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={range.labelFa}
            aria-controls="chart-panel"
            tabIndex={isActive ? 0 : -1}
            className={`
              px-4 py-2 rounded-xs text-sm font-medium transition-apple-fast active-scale-apple
              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900
              ${isActive
                ? 'bg-accent text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {range.label}
          </button>
        )
      })}
    </div>
  )
}
