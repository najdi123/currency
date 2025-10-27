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
      className="flex items-center justify-center gap-2 flex-wrap px-4 py-3 border-b border-border"
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
            role="tab"
            aria-selected={isActive}
            aria-label={range.labelFa}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500
              ${isActive
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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
