import React from 'react'
import { HiOutlineInformationCircle } from 'react-icons/hi'

export const ChartEmptyState = () => {
  return (
    <div
      className="flex flex-col items-center justify-center h-[400px] gap-3 animate-fade-in"
      role="status"
      aria-label="داده‌ای برای نمایش وجود ندارد"
    >
      <HiOutlineInformationCircle className="text-5xl text-text-tertiary opacity-40" aria-hidden="true" />
      <p className="text-apple-body text-text-secondary text-center">داده‌ای برای این بازه زمانی موجود نیست</p>
    </div>
  )
}
