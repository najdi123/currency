import React from 'react'

export const ChartLoadingState = () => {
  return (
    <div
      className="flex items-center justify-center h-[400px]"
      role="status"
      aria-live="polite"
      aria-label="در حال بارگذاری نمودار"
    >
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
    </div>
  )
}
