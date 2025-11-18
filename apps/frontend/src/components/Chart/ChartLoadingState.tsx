import React from 'react'

export const ChartLoadingState = () => {
  return (
    <div
      className="w-full space-y-4 animate-fade-in"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="در حال بارگذاری نمودار"
    >
      {/* Shimmer skeleton that matches chart layout */}
      <div className="flex items-center justify-center h-8 w-32 mx-auto rounded-lg shimmer-bg" />
      <div className="h-[320px] sm:h-[360px] w-full rounded-lg shimmer-bg relative overflow-hidden" />
      <div className="flex gap-2 justify-center">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 w-12 rounded-lg shimmer-bg" />
        ))}
      </div>
    </div>
  )
}
