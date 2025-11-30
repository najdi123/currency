'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { BsThreeDotsVertical, BsCheck2 } from 'react-icons/bs'
import { formatToman, formatChange } from '@/lib/utils/formatters'
import type { RegionType, VariantType } from '@/lib/utils/dataItemHelpers'

export interface VariantData {
  code: string
  apiCode: string
  variantType: VariantType
  region?: RegionType
  value: string
  change: number
}

interface CurrencyVariantsDropdownProps {
  currencyCode: string
  variants: VariantData[]
  /** Currently selected variant code (for calculator mode) */
  selectedVariant?: string
  /** Callback when user selects a variant */
  onSelectVariant?: (variant: VariantData) => void
  /** Whether selection is enabled (calculator mode) */
  selectable?: boolean
}

/**
 * CurrencyVariantsDropdown - Displays a 3-dot menu button that opens a dropdown
 * showing all available price variants for a currency (buy/sell, regional variants)
 *
 * Features:
 * - 3-dot button (MoreVertical icon) to open dropdown
 * - Right-aligned for LTR, left-aligned for RTL
 * - Click outside to close
 * - Displays variant name, price, change, and region badge
 * - Supports variant selection for calculator mode
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
 * - Region badges (Iran, Dubai, Turkey, Herat)
 */
export const CurrencyVariantsDropdown: React.FC<CurrencyVariantsDropdownProps> = ({
  currencyCode,
  variants,
  selectedVariant,
  onSelectVariant,
  selectable = false,
}) => {
  const t = useTranslations('Home')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

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

  const handleSelectVariant = (variant: VariantData, e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectable && onSelectVariant) {
      onSelectVariant(variant)
      setIsOpen(false)
    }
  }

  // Get region badge styling for regional variants (Dubai, Turkey, Herat)
  const getRegionBadge = (region?: RegionType): { label: string; bg: string; text: string } | null => {
    if (!region || region === 'iran') return null

    const regionStyles: Record<string, { label: string; bg: string; text: string }> = {
      dubai: {
        label: t('regions.dubai'),
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-400'
      },
      turkey: {
        label: t('regions.turkey'),
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-400'
      },
      herat: {
        label: t('regions.herat'),
        bg: 'bg-cyan-100 dark:bg-cyan-900/30',
        text: 'text-cyan-700 dark:text-cyan-400'
      },
    }

    return regionStyles[region] || null
  }

  // Get variant type label and styling
  const getVariantTypeLabel = (variantType: VariantType): { label: string; bg: string; text: string } | null => {
    const styles: Record<VariantType, { label: string; bg: string; text: string }> = {
      free_market: {
        label: t('variantTypes.freeMarket'),
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400'
      },
      official: {
        label: t('variantTypes.official'),
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-400'
      },
      sana_buy: {
        label: t('variantTypes.sanaBuy'),
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-400'
      },
      sana_sell: {
        label: t('variantTypes.sanaSell'),
        bg: 'bg-indigo-100 dark:bg-indigo-900/30',
        text: 'text-indigo-700 dark:text-indigo-400'
      },
      nima: {
        label: t('variantTypes.nima'),
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-400'
      },
      regional_buy: {
        label: t('variantTypes.regionalBuy'),
        bg: 'bg-teal-100 dark:bg-teal-900/30',
        text: 'text-teal-700 dark:text-teal-400'
      },
      regional_sell: {
        label: t('variantTypes.regionalSell'),
        bg: 'bg-pink-100 dark:bg-pink-900/30',
        text: 'text-pink-700 dark:text-pink-400'
      },
    }
    return styles[variantType] || null
  }

  // Don't render if no variants
  if (!variants || variants.length === 0) {
    return null
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {/* 3-dot button - Using div instead of button to avoid nesting inside ItemCard's button */}
      <div
        ref={buttonRef}
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            setIsOpen(!isOpen)
          }
        }}
        className="p-2 rounded-lg hover:bg-background-hover dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary/40 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
        aria-label={t('ui.variants')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <BsThreeDotsVertical
          className="text-xl text-text-secondary hover:text-text-primary transition-colors"
          aria-hidden="true"
        />
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-72 bg-surface rounded-lg shadow-xl border border-border-light dark:border-gray-700 overflow-hidden"
          style={{ insetInlineEnd: 0 }}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-light dark:border-gray-700 bg-background-hover dark:bg-gray-800/50">
            <h3 className="text-sm font-semibold text-text-primary">
              {selectable ? t('ui.selectVariant') : t('ui.variants')}
            </h3>
          </div>

          {/* Variant list */}
          <div className="max-h-80 overflow-y-auto">
            {variants.map((variant) => {
              const isPositive = variant.change >= 0
              const isSelected = selectedVariant === variant.code
              const variantName = t(`currencyVariants.${variant.code}`)
              const typeLabel = getVariantTypeLabel(variant.variantType)
              const regionBadge = getRegionBadge(variant.region)

              return (
                <div
                  key={variant.code}
                  onClick={(e) => handleSelectVariant(variant, e)}
                  className={`px-4 py-3 transition-colors border-b border-border-light dark:border-gray-700 last:border-b-0 ${
                    selectable
                      ? 'cursor-pointer hover:bg-accent-primary/10 dark:hover:bg-accent-primary/20'
                      : 'hover:bg-background-hover dark:hover:bg-gray-700/50'
                  } ${isSelected ? 'bg-accent-primary/10 dark:bg-accent-primary/20' : ''}`}
                  role="menuitem"
                  tabIndex={selectable ? 0 : -1}
                  onKeyDown={(e) => {
                    if (selectable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      handleSelectVariant(variant, e as any)
                    }
                  }}
                >
                  {/* Top row: Variant name + badges */}
                  <div className="flex items-center gap-2 mb-1.5">
                    {/* Selection indicator */}
                    {selectable && isSelected && (
                      <BsCheck2 className="text-accent-primary flex-shrink-0" />
                    )}

                    {/* Variant name */}
                    <span className="text-sm font-medium text-text-primary flex-1">
                      {variantName}
                    </span>

                    {/* Type badge (free_market, official, sana, nima) */}
                    {typeLabel && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${typeLabel.bg} ${typeLabel.text}`}>
                        {typeLabel.label}
                      </span>
                    )}

                    {/* Region badge (Dubai, Turkey, Herat) */}
                    {regionBadge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${regionBadge.bg} ${regionBadge.text}`}>
                        {regionBadge.label}
                      </span>
                    )}
                  </div>

                  {/* Bottom row: Price and change */}
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
