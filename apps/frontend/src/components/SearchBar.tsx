'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { FiSearch, FiX } from 'react-icons/fi'
import { currencyItems, cryptoItems, goldItems,
  //  coinItems
   } from '@/lib/utils/dataItemHelpers'
import type { ItemType } from '@/types/chart'
import { formatToman, formatChange } from '@/lib/utils/formatters'
import { useDebounce } from '@/lib/hooks/useDebounce'

// ✅ FIX W1: Proper TypeScript types instead of 'any'
interface MarketDataItem {
  value: number
  change: number
  timestamp?: number
  date?: string
}

interface ApiResponseMetadata {
  isFresh?: boolean
  isStale?: boolean
  dataAge?: number
  lastUpdated?: string | Date
  source?: 'cache' | 'api' | 'fallback' | 'snapshot'
  warning?: string
  isHistorical?: boolean
  historicalDate?: Date | string
}

// Use Record<> with intersection to allow _metadata property
type MarketData = Record<string, MarketDataItem> & {
  _metadata?: ApiResponseMetadata
}

interface SearchResult {
  key: string
  type: ItemType
  icon: React.ComponentType<{ className?: string }>
  color: string
  name: string
  value?: number
  change?: number
}

interface SearchBarProps {
  currencies: MarketData | null
  crypto: MarketData | null
  gold: MarketData | null
  coins?: MarketData | null
  onItemClick: (itemKey: string, itemType: ItemType) => void
  maxResults?: number
}

// Constants for better maintainability (S4)
const ITEM_HEIGHT = 72 // px
const VISIBLE_ITEMS = 2.5
const DEFAULT_MAX_RESULTS = 10
const DEBOUNCE_DELAY = 300 // ms

export function SearchBar({
  currencies,
  crypto,
  gold,
  coins,
  onItemClick,
  maxResults = DEFAULT_MAX_RESULTS
}: SearchBarProps) {
  const t = useTranslations('Home')
  const tSearch = useTranslations('Search')
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1) // ✅ FIX W2: Keyboard navigation
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // ✅ FIX S1: Debounced search
  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY)

  // ✅ FIX W3: Unicode normalization for better search
  const normalizeText = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD') // Normalize Unicode (handles Arabic/Persian diacritics)
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
  }, [])

  // ✅ FIX S3: Helper to highlight matched text
  const highlightMatch = useCallback((text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text

    try {
      const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'))
      return parts.map((part, i) =>
        part.toLowerCase() === searchQuery.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-text-primary">
            {part}
          </mark>
        ) : part
      )
    } catch {
      // If regex fails, return original text
      return text
    }
  }, [])

  // ✅ FIX W4: Optimized click outside handler - only active when focused
  useEffect(() => {
    if (!isFocused) return // Only add listener when needed

    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFocused])

  // ✅ FIX W2: Keyboard navigation (Arrow keys, Enter, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocused || !debouncedQuery.trim()) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => {
            const newIndex = Math.min(prev + 1, searchResults.length - 1)
            scrollToResult(newIndex)
            return newIndex
          })
          break

        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => {
            const newIndex = Math.max(prev - 1, -1)
            if (newIndex >= 0) scrollToResult(newIndex)
            return newIndex
          })
          break

        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0 && searchResults[selectedIndex]) {
            handleItemClick(searchResults[selectedIndex])
          }
          break

        case 'Escape':
          e.preventDefault()
          setIsFocused(false)
          setQuery('')
          setSelectedIndex(-1)
          inputRef.current?.blur()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFocused, debouncedQuery, selectedIndex])

  // Helper to scroll result into view
  const scrollToResult = (index: number) => {
    if (!resultsRef.current) return
    const resultElement = resultsRef.current.querySelector(`#search-result-${index}`)
    resultElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  // Search across all items
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []

    const normalizedQuery = normalizeText(debouncedQuery)
    const results: SearchResult[] = []

    // Helper to check if item matches query (with normalization)
    const matchesQuery = (itemKey: string, type: ItemType): boolean => {
      const itemName = normalizeText(t(`items.${itemKey}`))
      return itemName.includes(normalizedQuery)
    }

    // Helper to add result
    const addResult = (item: any, type: ItemType, data: MarketData | null) => {
      const itemData = data?.[item.key]
      if (matchesQuery(item.key, type)) {
        results.push({
          key: item.key,
          type,
          icon: item.icon,
          color: item.color,
          name: t(`items.${item.key}`),
          value: itemData?.value,
          change: itemData?.change,
        })
      }
    }

    // Search currencies
    currencyItems.forEach(item => addResult(item, 'currency', currencies))

    // Search crypto
    cryptoItems.forEach(item => addResult(item, 'crypto', crypto))

    // Search gold
    goldItems.forEach(item => addResult(item, 'gold', gold))

    // Search coins
    // coinItems.forEach(item => addResult(item, 'coins', coins || null))

    return results.slice(0, maxResults)
  }, [debouncedQuery, t, currencies, crypto, gold, coins, maxResults, normalizeText])

  const handleClear = () => {
    setQuery('')
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const handleItemClick = (result: SearchResult) => {
    // ✅ FIX S6: Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'search_result_click', {
        search_term: query,
        result_type: result.type,
        result_key: result.key,
      })
    }

    onItemClick(result.key, result.type)
    setQuery('')
    setIsFocused(false)
    setSelectedIndex(-1)
  }

  const showResults = Boolean(isFocused && debouncedQuery.trim() && searchResults.length > 0)

  return (
    <div className="relative w-full max-w-2xl mx-auto px-3 sm:px-6 lg:px-8 mb-6">
      {/* Screen reader announcement for search results */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isFocused && debouncedQuery.trim() && searchResults.length > 0 &&
          `${searchResults.length} ${tSearch('resultsFound') || 'results found'}`}
        {isFocused && debouncedQuery.trim() && searchResults.length === 0 &&
          tSearch('noResults')}
      </div>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 ltr:left-0 rtl:right-0 flex items-center ltr:pl-4 rtl:pr-4 pointer-events-none">
          <FiSearch className="w-5 h-5 text-text-secondary" aria-hidden="true" />
        </div>

        {/* ✅ FIX W6: Proper ARIA attributes for combobox pattern */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(-1) // Reset selection when typing
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={tSearch('placeholder')}
          role="combobox"
          aria-expanded={showResults}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-activedescendant={
            selectedIndex >= 0
              ? `search-result-${selectedIndex}`
              : undefined
          }
          className="
            w-full ltr:pl-12 rtl:pr-12 ltr:pr-12 rtl:pl-12 py-3
            bg-surface border border-border-light
            rounded-xl
            text-text-primary placeholder-text-secondary
            focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
            transition-all duration-200
            text-base
          "
          aria-label={tSearch('placeholder')}
        />

        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 ltr:right-0 rtl:left-0 flex items-center ltr:pr-4 rtl:pl-4 text-text-secondary hover:text-text-primary transition-colors"
            aria-label={tSearch('clear')}
            type="button"
          >
            <FiX className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {showResults && (
        <div
          ref={resultsRef}
          id="search-results"
          role="listbox"
          aria-label={tSearch('results') || 'Search Results'}
          className="
            absolute z-50 w-full mt-2
            bg-surface border border-border-light
            rounded-xl shadow-xl
            overflow-hidden
          "
          style={{
            maxHeight: `${ITEM_HEIGHT * VISIBLE_ITEMS}px`,
          }}
        >
          <div
            className="overflow-y-auto"
            style={{ maxHeight: `${ITEM_HEIGHT * VISIBLE_ITEMS}px` }}
          >
            {searchResults.map((result, index) => (
              <button
                key={`${result.type}-${result.key}`}
                id={`search-result-${index}`}
                onClick={() => handleItemClick(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                aria-selected={selectedIndex === index}
                type="button"
                className={`
                  w-full px-4 py-4 flex items-center gap-3
                  transition-colors
                  border-b border-border-light last:border-b-0
                  text-left
                  ${selectedIndex === index
                    ? 'bg-background-hover ring-2 ring-inset ring-accent/30'
                    : 'hover:bg-background-hover'
                  }
                `}
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  <result.icon className={`w-6 h-6 ${result.color}`} />
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {highlightMatch(result.name, query)}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {result.type === 'currency' && tSearch('typeCurrency')}
                    {result.type === 'crypto' && tSearch('typeCrypto')}
                    {result.type === 'gold' && tSearch('typeGold')}
                    {result.type === 'coins' && tSearch('typeCoins')}
                  </div>
                </div>

                {/* Price & Change */}
                {result.value !== undefined && (
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-semibold text-text-primary">
                      {formatToman(result.value)}
                    </div>
                    {result.change !== undefined && (
                      <div
                        className={`text-xs font-medium ${
                          result.change >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatChange(result.change)}
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ✅ FIX W5: No Results Message - Fixed conditional logic */}
      {isFocused && debouncedQuery.trim() && searchResults.length === 0 && (
        <div
          className="
            absolute z-50 w-full mt-2
            bg-surface border border-border-light
            rounded-xl shadow-xl
            px-4 py-8 text-center
          "
        >
          <FiSearch className="w-8 h-8 mx-auto mb-2 text-text-secondary opacity-40" />
          <p className="text-sm text-text-secondary">{tSearch('noResults')}</p>
          <p className="text-xs text-text-tertiary mt-1">
            {tSearch('searching')} &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  )
}
