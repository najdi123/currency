import React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { formatToman } from '@/lib/utils/formatters'

interface ItemCardPriceProps {
  /**
   * Price value in Toman
   */
  value: number

  /**
   * Compact mode flag
   */
  compact?: boolean
}

/**
 * ItemCardPrice - Displays the formatted price with "Toman" suffix
 *
 * Features:
 * - Large, bold price display with monospace font
 * - Formatted with comma separators
 * - Localized "Toman" suffix in smaller text
 * - Responsive sizing for compact mode
 * - Persian/Farsi digits when locale is 'fa'
 *
 * Accessibility:
 * - Uses semantic paragraph element
 * - Proper text sizing hierarchy (price larger than suffix)
 * - Text truncation to prevent overflow
 */
export const ItemCardPrice: React.FC<ItemCardPriceProps> = ({
  value,
  compact = false,
}) => {
  const t = useTranslations('Chart')
  const locale = useLocale()

  return (
    <p
      className={`${
        compact ? 'text-lg sm:text-xl' : 'text-[1.6rem] sm:text-[1.75rem]'
      } leading-tight font-bold font-mono text-text-primary truncate max-w-full`}
    >
      {formatToman(value, locale)}{' '}
      <span
        className={`${
          compact ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
        } font-normal text-text-tertiary`}
      >
        {t('toman')}
      </span>
    </p>
  )
}
