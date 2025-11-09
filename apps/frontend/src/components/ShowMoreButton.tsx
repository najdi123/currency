'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

interface ShowMoreButtonProps {
  isExpanded: boolean
  onToggle: () => void
  itemCount: number
}

/**
 * ShowMoreButton - Simple button component for expanding/collapsing additional items
 *
 * Features:
 * - Show "Show More" when collapsed, "Show Less" when expanded
 * - Display count of additional items: "Show {{count}} more"
 * - ChevronDown/ChevronUp icons
 * - Uses translations from Home.ui.showMore, Home.ui.showLess, Home.ui.showMoreItems
 * - Accessible with proper ARIA labels
 * - Mobile-friendly with proper touch targets
 *
 * Design:
 * - Follows existing button styling patterns
 * - Uses Tailwind CSS
 * - Hover and focus states
 * - Smooth icon rotation transition
 */
export const ShowMoreButton: React.FC<ShowMoreButtonProps> = ({
  isExpanded,
  onToggle,
  itemCount,
}) => {
  const t = useTranslations('Home')

  // Don't render if no items to show
  if (itemCount === 0) {
    return null
  }

  const buttonText = isExpanded
    ? t('ui.showLess')
    : t('ui.showMoreItems', { count: itemCount })

  const ariaLabel = isExpanded
    ? t('ui.showLess')
    : t('ui.showMoreItems', { count: itemCount })

  return (
    <div className="flex justify-center mt-6">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-background-hover dark:bg-gray-800/50 hover:bg-accent-primary/10 dark:hover:bg-accent-primary/20 text-text-primary font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:ring-offset-2 touch-manipulation min-h-[44px] group"
        aria-label={ariaLabel}
        aria-expanded={isExpanded}
      >
        <span className="text-sm sm:text-base">{buttonText}</span>
        {isExpanded ? (
          <FiChevronUp
            className="text-lg transition-transform duration-200 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        ) : (
          <FiChevronDown
            className="text-lg transition-transform duration-200 group-hover:translate-y-0.5"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  )
}
