'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { BsThreeDotsVertical } from 'react-icons/bs'
import { formatToman, formatChange } from '@/lib/utils/formatters'

export interface VariantData {
  code: string
  apiCode: string
  variantType: string
  value: string
  change: number
}

interface CurrencyVariantsDropdownProps {
  currencyCode: string
  variants: VariantData[]
}

/**
 * CurrencyVariantsDropdown - Displays a 3-dot menu button that opens a dropdown
 * showing all available price variants for a currency (buy/sell, harat, tomorrow, etc.)
 *
 * Features:
 * - 3-dot button (MoreVertical icon) to open dropdown
 * - Right-aligned for LTR, left-aligned for RTL
 * - Click outside to close
 * - Displays variant name, price, and change percentage
 * - Uses translations from Home.currencyVariants.*
 * - Mobile-friendly with proper touch targets
 * - Accessible with ARIA labels and keyboard support
 *
 * Design:
 * - Follows existing card styling patterns
 * - Uses Tailwind CSS
 * - Dropdown has shadow and border
 * - Hover states for variant items
 * - Green text for positive changes, red for negative
 */
export const CurrencyVariantsDropdown: React.FC<CurrencyVariantsDropdownProps> = ({
  currencyCode,
  variants,
}) => {
  const t = useTranslations('Home')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside as any)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside as any)
    }
  }, [isOpen])

  // Close dropdown when pressing Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    setIsOpen(!isOpen)
  }

  // Don't render if no variants
  if (!variants || variants.length === 0) {
    return null
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {/* 3-dot button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="p-2 rounded-lg hover:bg-background-hover dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary/40 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={t('ui.variants')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <BsThreeDotsVertical
          className="text-xl text-text-secondary hover:text-text-primary transition-colors"
          aria-hidden="true"
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-64 bg-surface rounded-lg shadow-xl border border-border-light dark:border-gray-700 overflow-hidden"
          style={{ insetInlineEnd: 0 }}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-light dark:border-gray-700 bg-background-hover dark:bg-gray-800/50">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('ui.variants')}
            </h3>
          </div>

          {/* Variant list */}
          <div className="max-h-80 overflow-y-auto">
            {variants.map((variant) => {
              const isPositive = variant.change >= 0
              const variantName = t(`currencyVariants.${variant.code}`)

              return (
                <div
                  key={variant.code}
                  className="px-4 py-3 hover:bg-background-hover dark:hover:bg-gray-700/50 transition-colors border-b border-border-light dark:border-gray-700 last:border-b-0"
                  role="menuitem"
                >
                  {/* Variant name */}
                  <div className="text-sm font-medium text-text-primary mb-1">
                    {variantName}
                  </div>

                  {/* Price and change */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Price */}
                    <div className="text-base font-semibold text-text-primary">
                      {formatToman(Number(variant.value))}
                    </div>

                    {/* Change badge */}
                    <div
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        isPositive
                          ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                          : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                      }`}
                    >
                      {formatChange(variant.change)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
