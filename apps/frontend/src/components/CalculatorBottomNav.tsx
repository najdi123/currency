'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { formatToman } from '@/lib/utils/formatters'
import { HiDocumentText, HiDownload } from 'react-icons/hi'

interface CalculatorBottomNavProps {
  totalValue: number
  itemCount: number
  onSeeDetails: () => void
  onSaveAsPDF: () => void
}

export const CalculatorBottomNav: React.FC<CalculatorBottomNavProps> = ({
  totalValue,
  itemCount,
  onSeeDetails,
  onSaveAsPDF,
}) => {
  const t = useTranslations('Calculator')

  return (
    <div className="flex-shrink-0 bg-surface border-t border-border-light shadow-lg px-4 py-3 relative z-50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left side: Total value */}
        <div className="flex flex-col items-center sm:items-start">
          <p className="text-xs text-text-secondary">{t('total')}</p>
          <p className="text-lg sm:text-xl font-bold text-text-primary">
            {formatToman(totalValue)} {t('toman')}
          </p>
          {itemCount > 0 && (
            <p className="text-xs text-text-tertiary">
              {itemCount} {itemCount === 1 ? t('item') : t('items')}
            </p>
          )}
        </div>

        {/* Right side: Action buttons */}
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="tinted"
            size="md"
            onClick={onSeeDetails}
            className="flex-1 sm:flex-none"
            disabled={itemCount === 0}
          >
            <HiDocumentText className="text-lg" />
            {t('seeDetails')}
          </Button>
          <Button
            variant="filled"
            size="md"
            onClick={onSaveAsPDF}
            className="flex-1 sm:flex-none"
            disabled={itemCount === 0}
          >
            <HiDownload className="text-lg" />
            {t('saveAsPDF')}
          </Button>
        </div>
      </div>
    </div>
  )
}
