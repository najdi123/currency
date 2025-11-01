import React from 'react'

export const ChartLoadingState = () => {
  return (
    <div
      className="h-[400px] w-full px-4 py-6 space-y-4 animate-fade-in"
      role="status"
      aria-live="polite"
      aria-label="در حال بارگذاری نمودار"
    >
      {/* Shimmer skeleton that matches chart layout */}
      <div className="flex items-center justify-center h-8 w-32 mx-auto bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      <div className="h-[320px] w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse relative overflow-hidden">
        {/* Shimmer effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{
          backgroundSize: '1000px 100%',
          backgroundPosition: '-1000px 0',
        }} />
      </div>
      <div className="flex gap-2 justify-center">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}
