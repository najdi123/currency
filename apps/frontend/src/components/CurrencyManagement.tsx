'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  FiSearch,
  FiRefreshCw,
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiDollarSign,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi'
import {
  useGetManagedItemsQuery,
  useSetOverrideMutation,
  useClearOverrideMutation,
  useUpdateManagedItemMutation,
  type ManagedItem,
  type ItemCategory,
} from '@/lib/store/services/adminApi'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

// Format number with Persian locale
const formatPrice = (price: number | undefined, locale: string): string => {
  if (price === undefined) return '-'
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale === 'ar' ? 'ar-SA' : 'en-US').format(price)
}

// Badge component for source/status
const Badge: React.FC<{
  variant: 'api' | 'manual' | 'override' | 'inactive'
  children: React.ReactNode
}> = ({ variant, children }) => {
  const styles = {
    api: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    manual: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    override: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    inactive: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  }

  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', styles[variant])}>
      {children}
    </span>
  )
}

// Override modal component
const OverrideModal: React.FC<{
  item: ManagedItem
  onClose: () => void
  onSubmit: (price: number, change?: number) => void
  isLoading: boolean
}> = ({ item, onClose, onSubmit, isLoading }) => {
  const t = useTranslations('Admin')
  const locale = useLocale()
  const [price, setPrice] = useState(item.overridePrice?.toString() || '')
  const [change, setChange] = useState(item.overrideChange?.toString() || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const priceNum = parseFloat(price)
    const changeNum = change ? parseFloat(change) : undefined
    if (!isNaN(priceNum)) {
      onSubmit(priceNum, changeNum)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-elevated rounded-2xl border border-border-light p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {t('setOverride')} - {item.name[locale as 'fa' | 'en' | 'ar'] || item.name.en}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('overridePrice')}
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            required
            dir="ltr"
            icon={<FiDollarSign className="w-5 h-5" />}
          />

          <Input
            label={`${t('changePercent')} (${t('optional')})`}
            type="number"
            step="0.01"
            value={change}
            onChange={(e) => setChange(e.target.value)}
            placeholder="0.00"
            dir="ltr"
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="gray"
              onClick={onClose}
              disabled={isLoading}
              fullWidth
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="filled"
              disabled={isLoading || !price}
              fullWidth
            >
              {isLoading ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Category filter tabs
const CategoryTabs: React.FC<{
  selected: ItemCategory | 'all'
  onChange: (category: ItemCategory | 'all') => void
}> = ({ selected, onChange }) => {
  const t = useTranslations('Admin')
  const categories: (ItemCategory | 'all')[] = ['all', 'currencies', 'crypto', 'gold', 'coins']

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
            selected === cat
              ? 'bg-accent text-white'
              : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          )}
        >
          {t(`category_${cat}`)}
        </button>
      ))}
    </div>
  )
}

// Main component
export function CurrencyManagement() {
  const t = useTranslations('Admin')
  const locale = useLocale()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all')
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [overrideItem, setOverrideItem] = useState<ManagedItem | null>(null)

  // API queries and mutations
  const {
    data: itemsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetManagedItemsQuery(
    selectedCategory === 'all' ? undefined : { category: selectedCategory }
  )

  const [setOverride, { isLoading: isSettingOverride }] = useSetOverrideMutation()
  const [clearOverride, { isLoading: isClearingOverride }] = useClearOverrideMutation()
  const [updateItem] = useUpdateManagedItemMutation()

  // Group items by parent
  const groupedItems = useMemo(() => {
    if (!itemsData?.items) return { parents: [], orphans: [] }

    const items = itemsData.items
    const query = searchQuery.toLowerCase().trim()

    // Filter by search
    const filtered = query
      ? items.filter(
          (item) =>
            item.code.toLowerCase().includes(query) ||
            item.name.fa.includes(query) ||
            item.name.en.toLowerCase().includes(query) ||
            (item.name.ar && item.name.ar.includes(query))
        )
      : items

    // Group by parentCode
    const parentMap = new Map<string, ManagedItem[]>()
    const orphans: ManagedItem[] = []

    for (const item of filtered) {
      if (item.parentCode) {
        const existing = parentMap.get(item.parentCode) || []
        existing.push(item)
        parentMap.set(item.parentCode, existing)
      } else {
        orphans.push(item)
      }
    }

    // Find parent items for each group
    const parents: { parent: ManagedItem; variants: ManagedItem[] }[] = []
    for (const [parentCode, variants] of parentMap.entries()) {
      const parent = items.find((i) => i.code === parentCode)
      if (parent) {
        parents.push({ parent, variants })
      } else {
        // Parent not found, treat variants as orphans
        orphans.push(...variants)
      }
    }

    // Sort parents by displayOrder
    parents.sort((a, b) => a.parent.displayOrder - b.parent.displayOrder)
    orphans.sort((a, b) => a.displayOrder - b.displayOrder)

    return { parents, orphans }
  }, [itemsData?.items, searchQuery])

  // Toggle parent expansion
  const toggleParent = useCallback((parentCode: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev)
      if (next.has(parentCode)) {
        next.delete(parentCode)
      } else {
        next.add(parentCode)
      }
      return next
    })
  }, [])

  // Handle override
  const handleSetOverride = async (price: number, change?: number) => {
    if (!overrideItem) return
    try {
      await setOverride({
        code: overrideItem.code,
        price,
        change,
      }).unwrap()
      setOverrideItem(null)
    } catch (err) {
      console.error('Failed to set override:', err)
    }
  }

  // Handle clear override
  const handleClearOverride = async (code: string) => {
    try {
      await clearOverride(code).unwrap()
    } catch (err) {
      console.error('Failed to clear override:', err)
    }
  }

  // Handle toggle active
  const handleToggleActive = async (item: ManagedItem) => {
    try {
      await updateItem({
        code: item.code,
        isActive: !item.isActive,
      }).unwrap()
    } catch (err) {
      console.error('Failed to toggle active:', err)
    }
  }

  // Render item row
  const renderItemRow = (item: ManagedItem, isVariant = false) => {
    const name = item.name[locale as 'fa' | 'en' | 'ar'] || item.name.en

    return (
      <div
        key={item.code}
        className={cn(
          'flex items-center gap-4 p-4 border-b border-border-light last:border-b-0',
          isVariant && 'bg-bg-secondary/50 pr-8',
          !item.isActive && 'opacity-50'
        )}
      >
        {/* Icon/Code */}
        <div className="w-12 h-12 rounded-lg bg-bg-secondary flex items-center justify-center flex-shrink-0">
          {item.icon ? (
            <span className="text-2xl">{item.icon}</span>
          ) : (
            <span className="text-sm font-bold text-text-tertiary">
              {item.code.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Name & Code */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-semibold text-text-primary truncate">
              {name}
            </h4>
            <Badge variant={item.source === 'api' ? 'api' : 'manual'}>
              {item.source === 'api' ? t('sourceApi') : t('sourceManual')}
            </Badge>
            {item.isOverridden && (
              <Badge variant="override">{t('overridden')}</Badge>
            )}
            {!item.isActive && (
              <Badge variant="inactive">{t('inactive')}</Badge>
            )}
          </div>
          <p className="text-sm text-text-tertiary">{item.code}</p>
        </div>

        {/* Price */}
        <div className="text-left min-w-[120px]">
          {item.isOverridden && item.overridePrice ? (
            <div>
              <p className="text-base font-semibold text-warning-text">
                {formatPrice(item.overridePrice, locale)}
              </p>
              {item.overrideChange !== undefined && (
                <p
                  className={cn(
                    'text-sm',
                    item.overrideChange >= 0 ? 'text-success-text' : 'text-error-text'
                  )}
                >
                  {item.overrideChange >= 0 ? '+' : ''}
                  {item.overrideChange.toFixed(2)}%
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">{t('noOverride')}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOverrideItem(item)}
            className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-accent transition-colors"
            title={t('setOverride')}
          >
            <FiEdit2 className="w-4 h-4" />
          </button>

          {item.isOverridden && (
            <button
              onClick={() => handleClearOverride(item.code)}
              disabled={isClearingOverride}
              className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-error-text transition-colors disabled:opacity-50"
              title={t('clearOverride')}
            >
              <FiX className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => handleToggleActive(item)}
            className={cn(
              'p-2 rounded-lg hover:bg-bg-secondary transition-colors',
              item.isActive
                ? 'text-success-text hover:text-error-text'
                : 'text-error-text hover:text-success-text'
            )}
            title={item.isActive ? t('deactivate') : t('activate')}
          >
            {item.isActive ? (
              <FiCheck className="w-4 h-4" />
            ) : (
              <FiAlertCircle className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    )
  }

  // Render parent with variants
  const renderParentGroup = (parent: ManagedItem, variants: ManagedItem[]) => {
    const isExpanded = expandedParents.has(parent.code)
    const name = parent.name[locale as 'fa' | 'en' | 'ar'] || parent.name.en

    return (
      <div key={parent.code} className="border-b border-border-light">
        {/* Parent row */}
        <div
          className="flex items-center gap-4 p-4 cursor-pointer hover:bg-bg-secondary/30"
          onClick={() => toggleParent(parent.code)}
        >
          {/* Expand icon */}
          <button className="p-1 rounded hover:bg-bg-secondary text-text-tertiary">
            {isExpanded ? (
              <FiChevronUp className="w-5 h-5" />
            ) : (
              <FiChevronDown className="w-5 h-5" />
            )}
          </button>

          {/* Icon/Code */}
          <div className="w-12 h-12 rounded-lg bg-bg-secondary flex items-center justify-center flex-shrink-0">
            {parent.icon ? (
              <span className="text-2xl">{parent.icon}</span>
            ) : (
              <span className="text-sm font-bold text-text-tertiary">
                {parent.code.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          {/* Name & variants count */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-semibold text-text-primary truncate">
                {name}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-secondary">
                {variants.length} {t('variants')}
              </span>
            </div>
            <p className="text-sm text-text-tertiary">{parent.code}</p>
          </div>

          {/* Parent actions */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOverrideItem(parent)}
              className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-accent transition-colors"
              title={t('setOverride')}
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Variants */}
        {isExpanded && (
          <div className="border-t border-border-light">
            {variants.map((variant) => renderItemRow(variant, true))}
          </div>
        )}
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="error" title={t('errorLoadingItems')}>
        {(error as any)?.data?.message || t('errorOccurred')}
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('manageCurrencies')}</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {t('manageCurrenciesDescription')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-2 rounded-lg bg-bg-elevated hover:bg-bg-secondary border border-border-light text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            aria-label={t('refresh')}
          >
            <FiRefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
          </button>
          <Button variant="filled" size="md">
            <FiPlus className="w-4 h-4" />
            {t('addCurrency')}
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <CategoryTabs selected={selectedCategory} onChange={setSelectedCategory} />

      {/* Search Bar */}
      <div className="relative">
        <FiSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary w-5 h-5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchCurrencies')}
          className="w-full pr-10 pl-4 py-3 bg-bg-elevated border border-border-light rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-bg-secondary rounded-lg p-4 h-20" />
            </div>
          ))}
        </div>
      )}

      {/* Items List */}
      {!isLoading && (
        <div className="bg-bg-elevated rounded-xl border border-border-light overflow-hidden">
          {groupedItems.parents.length === 0 && groupedItems.orphans.length === 0 ? (
            <div className="text-center py-12">
              <FiDollarSign className="w-12 h-12 mx-auto text-text-tertiary mb-3" />
              <p className="text-text-secondary font-medium">
                {searchQuery ? t('noItemsFound') : t('noItems')}
              </p>
            </div>
          ) : (
            <>
              {/* Parent groups */}
              {groupedItems.parents.map(({ parent, variants }) =>
                renderParentGroup(parent, variants)
              )}

              {/* Orphan items (no parent) */}
              {groupedItems.orphans.map((item) => renderItemRow(item))}
            </>
          )}
        </div>
      )}

      {/* Stats */}
      {itemsData && (
        <div className="text-sm text-text-tertiary text-center">
          {itemsData.total} {t('totalItems')}
        </div>
      )}

      {/* Override Modal */}
      {overrideItem && (
        <OverrideModal
          item={overrideItem}
          onClose={() => setOverrideItem(null)}
          onSubmit={handleSetOverride}
          isLoading={isSettingOverride}
        />
      )}
    </div>
  )
}
