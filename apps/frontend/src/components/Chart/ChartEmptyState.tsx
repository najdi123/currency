import React from 'react'
import { HiOutlineInformationCircle } from 'react-icons/hi'

export const ChartEmptyState = () => {
  return (
    <div
      className="flex flex-col items-center justify-center h-[400px] gap-3"
      role="status"
    >
      <HiOutlineInformationCircle className="text-5xl text-gray-400 dark:text-gray-500" />
      <p className="text-text-secondary text-center">داده‌ای برای این بازه زمانی موجود نیست</p>
    </div>
  )
}
