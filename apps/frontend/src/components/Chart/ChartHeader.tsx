import React from 'react'
import { formatToman, formatChange } from '@/lib/utils/formatters'
import { FiArrowUp, FiArrowDown } from 'react-icons/fi'

interface ChartHeaderProps {
  itemName: string
  currentPrice: number
  priceChange: number
}

export const ChartHeader: React.FC<ChartHeaderProps> = ({
  itemName,
  currentPrice,
  priceChange,
}) => {
  const isPositive = priceChange >= 0

  return (
    <div className="border-b border-border px-6 py-4 bg-surface" dir="rtl">
      <h2 className="text-2xl md:text-3xl font-bold text-text-primary text-right mb-2">
        {itemName}
      </h2>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xl md:text-2xl font-mono font-bold text-text-primary">
            {formatToman(currentPrice)}{' '}
            <span className="text-sm font-normal text-text-tertiary">تومان</span>
          </p>
          <div
            className={`
              inline-flex items-center gap-1
              ${isPositive
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }
              rounded-full px-3 py-1
              text-sm font-medium
            `}
            dir="ltr"
          >
            {isPositive ? (
              <FiArrowUp className="text-sm" aria-hidden="true" />
            ) : (
              <FiArrowDown className="text-sm" aria-hidden="true" />
            )}
            {formatChange(priceChange)}
          </div>
        </div>
      </div>
    </div>
  )
}
