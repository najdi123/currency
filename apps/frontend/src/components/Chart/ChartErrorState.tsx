import React from 'react'
import { HiOutlineExclamationCircle } from 'react-icons/hi'

interface ChartErrorStateProps {
  message: string
  onRetry: () => void
}

export const ChartErrorState: React.FC<ChartErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div
      className="flex flex-col items-center justify-center h-[400px] gap-4 px-6 animate-fade-in"
      role="alert"
      aria-live="assertive"
    >
      <HiOutlineExclamationCircle className="text-6xl text-accent opacity-60" aria-hidden="true" />
      <div className="space-y-2 text-center max-w-md">
        <h3 className="text-apple-body font-semibold text-text-primary">خطا در بارگذاری نمودار</h3>
        <p className="text-apple-caption text-text-secondary leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="btn-apple-tinted active-scale-apple focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-label="تلاش مجدد برای بارگذاری نمودار"
      >
        تلاش مجدد
      </button>
    </div>
  )
}
