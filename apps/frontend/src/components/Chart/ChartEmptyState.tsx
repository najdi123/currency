import React from 'react'
import { useTranslations } from 'next-intl'
import { HiOutlineInformationCircle } from 'react-icons/hi'

export const ChartEmptyState = () => {
  const t = useTranslations('Chart')

  return (
    <div
      className="flex flex-col items-center justify-center h-[400px] gap-3 animate-fade-in"
      role="status"
      aria-label={t('noData')}
    >
      <HiOutlineInformationCircle className="text-5xl text-text-tertiary opacity-40" aria-hidden="true" />
      <p className="text-apple-body text-text-secondary text-center">{t('noDataForTimeRange')}</p>
    </div>
  )
}
