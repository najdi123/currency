import React from 'react'
import { HiOutlineExclamationCircle } from 'react-icons/hi'

interface ChartErrorStateProps {
  message: string
  onRetry: () => void
}

export const ChartErrorState: React.FC<ChartErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div
      className="flex flex-col items-center justify-center h-[400px] gap-4 px-4"
      role="alert"
      aria-live="assertive"
    >
      <HiOutlineExclamationCircle className="text-6xl text-red-500 dark:text-red-400" />
      <p className="text-text-secondary text-center text-sm md:text-base">{message}</p>
      <button
        onClick={onRetry}
        className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500"
      >
        تلاش مجدد
      </button>
    </div>
  )
}
