'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { formatToman } from '@/lib/utils/formatters'
import { HiDocumentText, HiDownload, HiChevronDown } from 'react-icons/hi'

interface CalculatorBottomNavProps {
  totalValue: number
  itemCount: number
  onSeeDetails: () => void
  onSaveAsPDF: (language?: string) => void
  isGeneratingPDF?: boolean
}

export const CalculatorBottomNav: React.FC<CalculatorBottomNavProps> = ({
  totalValue,
  itemCount,
  onSeeDetails,
  onSaveAsPDF,
  isGeneratingPDF = false,
}) => {
  const t = useTranslations('Calculator')
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  ]

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false)
      }
    }

    if (showLangMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLangMenu])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showLangMenu) return

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          setShowLangMenu(false)
          buttonRef.current?.focus()
          break

        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % languages.length)
          break

        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + languages.length) % languages.length)
          break

        case 'Enter':
        case ' ':
          e.preventDefault()
          handlePDFDownload(languages[selectedIndex].code)
          break

        case 'Home':
          e.preventDefault()
          setSelectedIndex(0)
          break

        case 'End':
          e.preventDefault()
          setSelectedIndex(languages.length - 1)
          break
      }
    }

    if (showLangMenu) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLangMenu, selectedIndex, languages.length])

  const handlePDFDownload = (langCode?: string) => {
    onSaveAsPDF(langCode)
    setShowLangMenu(false)
    setSelectedIndex(0) // Reset selection
  }

  const toggleMenu = () => {
    setShowLangMenu((prev) => !prev)
    if (!showLangMenu) {
      setSelectedIndex(0) // Reset when opening
    }
  }

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

          {/* PDF Download with language selector */}
          <div className="relative flex-1 sm:flex-none" ref={menuRef}>
            <div className="flex gap-1">
              <Button
                variant="filled"
                size="md"
                onClick={() => handlePDFDownload()}
                className="flex-1 sm:flex-none rounded-r-none"
                disabled={itemCount === 0 || isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <HiDownload className="text-lg" />
                    {t('saveAsPDF')}
                  </>
                )}
              </Button>
              <Button
                ref={buttonRef}
                variant="filled"
                size="md"
                onClick={toggleMenu}
                className="px-2 rounded-l-none border-l border-white/20"
                disabled={itemCount === 0 || isGeneratingPDF}
                aria-label={t('selectLanguage') || 'Select language'}
                aria-expanded={showLangMenu}
                aria-haspopup="menu"
              >
                <HiChevronDown className="text-lg" />
              </Button>
            </div>

            {/* Language dropdown menu */}
            {showLangMenu && (
              <div
                className="absolute bottom-full right-0 mb-2 bg-surface border border-border-light rounded-lg shadow-xl overflow-hidden min-w-40 z-50"
                role="menu"
                aria-label="PDF language selection"
              >
                <div className="py-1">
                  {languages.map((lang, index) => (
                    <button
                      key={lang.code}
                      onClick={() => handlePDFDownload(lang.code)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                        index === selectedIndex
                          ? 'bg-surface-hover'
                          : 'hover:bg-surface-hover'
                      }`}
                      role="menuitem"
                      aria-label={`Download PDF in ${lang.label}`}
                      tabIndex={-1}
                    >
                      <span className="text-xl" aria-hidden="true">{lang.flag}</span>
                      <span className="text-sm text-text-primary">{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
