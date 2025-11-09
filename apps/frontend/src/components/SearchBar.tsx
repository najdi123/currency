'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FiSearch, FiX } from 'react-icons/fi'
import { currencyItems, cryptoItems, goldItems } from '@/lib/utils/dataItemHelpers'
import type { ItemType } from '@/types/chart'
import { formatToman, formatChange } from '@/lib/utils/formatters'

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
  currencies: any
  crypto: any
  gold: any
  onItemClick: (itemKey: string, itemType: ItemType) => void
}

export function SearchBar({ currencies, crypto, gold, onItemClick }: SearchBarProps) {
  const t = useTranslations('Home')
  const tSearch = useTranslations('Search')
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search across all items
  const searchResults = useMemo(() => {
    if (!query.trim()) return []

    const normalizedQuery = query.toLowerCase().trim()
    const results: SearchResult[] = []

    // Helper to check if item matches query
    const matchesQuery = (itemKey: string, type: ItemType): boolean => {
      const itemName = t(`items.${itemKey}`).toLowerCase()

      // Check if query matches the translated name
      return itemName.includes(normalizedQuery)
    }

    // Helper to add result
    const addResult = (item: any, type: ItemType, data: any) => {
      const itemData = data?.[item.key]
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

    // Search currencies
    currencyItems.forEach(item => {
      if (matchesQuery(item.key, 'currency')) {
        addResult(item, 'currency', currencies)
      }
    })

    // Search crypto
    cryptoItems.forEach(item => {
      if (matchesQuery(item.key, 'crypto')) {
        addResult(item, 'crypto', crypto)
      }
    })

    // Search gold
    goldItems.forEach(item => {
      if (matchesQuery(item.key, 'gold')) {
        addResult(item, 'gold', gold)
      }
    })

    return results.slice(0, 10) // Limit to 10 results
  }, [query, t, currencies, crypto, gold])

  const handleClear = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  const handleItemClick = (result: SearchResult) => {
    onItemClick(result.key, result.type)
    setQuery('')
    setIsFocused(false)
  }

  const showResults = isFocused && query.trim() && searchResults.length > 0

  return (
    <div className="relative w-full max-w-2xl mx-auto px-3 sm:px-6 lg:px-8 mb-6">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <FiSearch className="w-5 h-5 text-text-secondary" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={tSearch('placeholder')}
          className="
            w-full pl-12 pr-12 py-3
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
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-text-secondary hover:text-text-primary transition-colors"
            aria-label={tSearch('clear')}
          >
            <FiX className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {showResults && (
        <div
          ref={resultsRef}
          className="
            absolute z-50 w-full mt-2
            bg-surface border border-border-light
            rounded-xl shadow-xl
            overflow-hidden
          "
          style={{
            maxHeight: 'calc(2.5 * 72px)', // 2.5 items (each item ~72px)
          }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(2.5 * 72px)' }}>
            {searchResults.map((result, index) => (
              <button
                key={`${result.type}-${result.key}`}
                onClick={() => handleItemClick(result)}
                className={`
                  w-full px-4 py-4 flex items-center gap-3
                  hover:bg-background-hover transition-colors
                  border-b border-border-light last:border-b-0
                  text-left
                `}
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  <result.icon className={`w-6 h-6 ${result.color}`} />
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {result.name}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {result.type === 'currency' && tSearch('typeCurrency')}
                    {result.type === 'crypto' && tSearch('typeCrypto')}
                    {result.type === 'gold' && tSearch('typeGold')}
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

          {/* No Results Message */}
          {searchResults.length === 0 && query.trim() && (
            <div className="px-4 py-8 text-center text-text-secondary">
              <FiSearch className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{tSearch('noResults')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
