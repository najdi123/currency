'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
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
  FiCheckCircle,
  FiXCircle,
} from 'react-icons/fi'
import {
  useGetManagedItemsQuery,
  useSetOverrideMutation,
  useClearOverrideMutation,
  useUpdateManagedItemMutation,
  useCreateManagedItemMutation,
  useDeleteManagedItemMutation,
  type ManagedItem,
  type ItemCategory,
  type ItemRegion,
  type ItemVariant,
  type CreateManagedItemRequest,
} from '@/lib/store/services/adminApi'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

// Toast notification types
type ToastType = 'success' | 'error' | 'info'

interface ToastMessage {
  id: number
  type: ToastType
  title: string
  message?: string
}

// Toast Notification Component
const Toast: React.FC<{
  toast: ToastMessage
  onDismiss: (id: number) => void
}> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, 5000) // Auto dismiss after 5 seconds

    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const styles = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  }

  const iconStyles = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
  }

  const Icon = toast.type === 'success' ? FiCheckCircle : toast.type === 'error' ? FiXCircle : FiAlertCircle

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${styles[toast.type]} animate-slide-in`}
      role="alert"
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconStyles[toast.type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-text-secondary mt-1 break-words">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-tertiary"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  )
}

// Toast Container Component
const ToastContainer: React.FC<{
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

// Helper to extract error message from API error
const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const err = error as any
    // RTK Query error format
    if (err.data?.message) {
      return Array.isArray(err.data.message) ? err.data.message.join(', ') : err.data.message
    }
    if (err.data?.error) {
      return err.data.error
    }
    // Standard error
    if (err.message) {
      return err.message
    }
    // Status code
    if (err.status) {
      return `Error ${err.status}`
    }
  }
  return 'An unexpected error occurred'
}

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

// Format number with Persian locale
const formatPrice = (price: number | undefined, locale: string): string => {
  if (price === undefined) return '-'
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : locale === 'ar' ? 'ar-SA' : 'en-US').format(price)
}

// Format remaining time until override expires
const formatRemainingTime = (expiresAt: string, locale: string): { text: string; isExpired: boolean; isExpiringSoon: boolean } | null => {
  const now = new Date()
  const expiresDate = new Date(expiresAt)
  const diffMs = expiresDate.getTime() - now.getTime()

  // If expired
  if (diffMs <= 0) {
    return { text: '', isExpired: true, isExpiringSoon: false }
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Is expiring soon (less than 15 minutes)
  const isExpiringSoon = diffMinutes < 15

  let text = ''
  if (diffDays > 0) {
    const remainingHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (locale === 'fa') {
      text = `${diffDays}d ${remainingHours}h`
    } else if (locale === 'ar') {
      text = `${diffDays}d ${remainingHours}h`
    } else {
      text = `${diffDays}d ${remainingHours}h`
    }
  } else if (diffHours > 0) {
    const remainingMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    if (locale === 'fa') {
      text = `${diffHours}h ${remainingMinutes}m`
    } else if (locale === 'ar') {
      text = `${diffHours}h ${remainingMinutes}m`
    } else {
      text = `${diffHours}h ${remainingMinutes}m`
    }
  } else {
    if (locale === 'fa') {
      text = `${diffMinutes}m`
    } else if (locale === 'ar') {
      text = `${diffMinutes}m`
    } else {
      text = `${diffMinutes}m`
    }
  }

  return { text, isExpired: false, isExpiringSoon }
}

// Helper to get localized name from ManagedItem
const getLocalizedName = (item: ManagedItem, locale: string): string => {
  if (locale === 'fa' && item.nameFa) return item.nameFa
  if (locale === 'ar' && item.nameAr) return item.nameAr
  return item.name // English is the default
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

// Searchable Select component
interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  noResultsText?: string
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  label,
  disabled = false,
  noResultsText = 'No results found',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const query = searchQuery.toLowerCase()
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query)
    )
  }, [options, searchQuery])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchQuery('')
    } else if (e.key === 'Enter' && filteredOptions.length > 0) {
      handleSelect(filteredOptions[0].value)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-2">
          {label}
        </label>
      )}

      {/* Selected value / trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full px-4 py-3 bg-bg-base border border-border-light rounded-lg text-text-primary text-right',
          'flex items-center justify-between gap-2',
          'focus:outline-none focus:ring-2 focus:ring-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isOpen && 'ring-2 ring-accent border-transparent'
        )}
      >
        <span className={selectedOption ? 'text-text-primary' : 'text-text-tertiary'}>
          {selectedOption?.label || placeholder}
        </span>
        <FiChevronDown
          className={cn(
            'w-5 h-5 text-text-tertiary transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-bg-elevated border border-border-light rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border-light">
            <div className="relative">
              <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full pr-9 pl-3 py-2 bg-bg-base border border-border-light rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-text-tertiary text-center">
                {noResultsText}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full px-4 py-2.5 text-right text-sm transition-colors',
                    'hover:bg-bg-secondary',
                    option.value === value
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-text-primary'
                  )}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Duration options for override
interface DurationOption {
  value: number | null
  labelKey: string
}

const DURATION_OPTIONS: DurationOption[] = [
  { value: 1, labelKey: 'duration_1' },
  { value: 15, labelKey: 'duration_15' },
  { value: 30, labelKey: 'duration_30' },
  { value: 60, labelKey: 'duration_60' },
  { value: 120, labelKey: 'duration_120' },
  { value: 300, labelKey: 'duration_300' },
  { value: 720, labelKey: 'duration_720' },
  { value: 1440, labelKey: 'duration_1440' },
  { value: null, labelKey: 'duration_indefinite' },
]

// Override modal component
const OverrideModal: React.FC<{
  item: ManagedItem
  onClose: () => void
  onSubmit: (price: number, change?: number, duration?: number, isIndefinite?: boolean) => void
  isLoading: boolean
}> = ({ item, onClose, onSubmit, isLoading }) => {
  const t = useTranslations('Admin')
  const locale = useLocale()

  // Initialize with override price if exists, otherwise use current API price
  const initialPrice = item.overridePrice ?? item.currentPrice
  const initialChange = item.overrideChange ?? item.currentChange

  const [price, setPrice] = useState(initialPrice?.toString() || '')
  const [change, setChange] = useState(initialChange?.toString() || '')
  // Default to 1 hour (60 minutes)
  const [selectedDuration, setSelectedDuration] = useState<string>('60')

  const durationOptions = DURATION_OPTIONS.map((opt) => ({
    value: opt.value === null ? 'indefinite' : opt.value.toString(),
    label: t(opt.labelKey),
  }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const priceNum = parseFloat(price)
    const changeNum = change ? parseFloat(change) : undefined

    if (!isNaN(priceNum)) {
      if (selectedDuration === 'indefinite') {
        onSubmit(priceNum, changeNum, undefined, true)
      } else {
        const durationNum = parseInt(selectedDuration, 10)
        onSubmit(priceNum, changeNum, durationNum, false)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-elevated rounded-2xl border border-border-light p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {t('setOverride')} - {getLocalizedName(item, locale)}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Show current API price info */}
        {item.currentPrice !== undefined && !item.isOverridden && (
          <div className="mb-4 p-3 bg-bg-secondary rounded-lg">
            <p className="text-xs text-text-tertiary mb-1">{t('currentApiPrice')}</p>
            <p className="text-base font-semibold text-text-primary">
              {formatPrice(item.currentPrice, locale)}
            </p>
            {item.currentChange !== undefined && item.currentChange !== 0 && (
              <p className={cn(
                'text-sm',
                item.currentChange >= 0 ? 'text-success-text' : 'text-error-text'
              )}>
                {item.currentChange >= 0 ? '+' : ''}{item.currentChange.toFixed(2)}%
              </p>
            )}
          </div>
        )}

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

          <SearchableSelect
            label={t('overrideDuration')}
            value={selectedDuration}
            onChange={(value) => setSelectedDuration(value)}
            options={durationOptions}
            placeholder={t('selectDuration')}
            noResultsText={t('noResultsFound')}
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

// Create Manual Currency modal component
const CreateCurrencyModal: React.FC<{
  onClose: () => void
  onSubmit: (data: CreateManagedItemRequest) => void
  isLoading: boolean
}> = ({ onClose, onSubmit, isLoading }) => {
  const t = useTranslations('Admin')
  const [code, setCode] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nameFa, setNameFa] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [category, setCategory] = useState<ItemCategory>('currencies')
  const [price, setPrice] = useState('')
  const [icon, setIcon] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const data: CreateManagedItemRequest = {
      code: code.toLowerCase().replace(/\s+/g, '_'),
      name: nameEn,
      nameFa: nameFa,
      nameAr: nameAr || undefined,
      category,
      source: 'manual',
      icon: icon || undefined,
    }

    // If price is provided, we'll need to set an override after creation
    onSubmit(data)
  }

  const categories: ItemCategory[] = ['currencies', 'crypto', 'gold']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-elevated rounded-2xl border border-border-light p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {t('createManualCurrency')}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code */}
          <Input
            label={t('currencyCode')}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="dollar_turkey"
            required
            dir="ltr"
            hint={t('currencyCodeHint')}
          />

          {/* Category */}
          <SearchableSelect
            label={t('category')}
            value={category}
            onChange={(value) => setCategory(value as ItemCategory)}
            options={categories.map((cat) => ({
              value: cat,
              label: t(`category_${cat}`),
            }))}
            placeholder={t('searchCategory')}
            noResultsText={t('noResultsFound')}
          />

          {/* Name English */}
          <Input
            label={t('nameEnglish')}
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Turkish Dollar"
            required
            dir="ltr"
          />

          {/* Name Farsi */}
          <Input
            label={t('nameFarsi')}
            type="text"
            value={nameFa}
            onChange={(e) => setNameFa(e.target.value)}
            placeholder="دلار ترکیه"
            required
            dir="rtl"
          />

          {/* Name Arabic */}
          <Input
            label={`${t('nameArabic')} (${t('optional')})`}
            type="text"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder="الدولار التركي"
            dir="rtl"
          />

          {/* Icon/Emoji */}
          <Input
            label={`${t('icon')} (${t('optional')})`}
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🇹🇷"
            dir="ltr"
            hint={t('iconHint')}
          />

          {/* Initial Price */}
          <Input
            label={`${t('initialPrice')} (${t('optional')})`}
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            dir="ltr"
            icon={<FiDollarSign className="w-5 h-5" />}
            hint={t('initialPriceHint')}
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
              disabled={isLoading || !code || !nameEn || !nameFa}
              fullWidth
            >
              {isLoading ? t('creating') : t('create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Add Regional Variant modal component
const AddRegionalVariantModal: React.FC<{
  parentItem: ManagedItem
  onClose: () => void
  onSubmit: (data: CreateManagedItemRequest) => void
  isLoading: boolean
}> = ({ parentItem, onClose, onSubmit, isLoading }) => {
  const t = useTranslations('Admin')
  const locale = useLocale()
  const [region, setRegion] = useState<ItemRegion>('turkey')
  const [variant, setVariant] = useState<ItemVariant>('sell')
  const [price, setPrice] = useState('')

  const regions: ItemRegion[] = ['turkey', 'dubai', 'herat']
  const variants: ItemVariant[] = ['sell', 'buy']

  // Generate code based on parent + region + variant
  // e.g., usd_turkey_sell, aed_dubai_buy, try_turkey_sell
  const generatedCode = `${parentItem.code}_${region}_${variant}`

  // Generate names based on parent + region + variant
  const getRegionName = (reg: ItemRegion, lang: 'en' | 'fa' | 'ar') => {
    const regionNames = {
      turkey: { en: 'Turkey', fa: 'ترکیه', ar: 'تركيا' },
      dubai: { en: 'Dubai', fa: 'دبی', ar: 'دبي' },
      herat: { en: 'Herat', fa: 'هرات', ar: 'هرات' },
    }
    return regionNames[reg][lang]
  }

  const getVariantName = (v: ItemVariant, lang: 'en' | 'fa' | 'ar') => {
    const variantNames = {
      sell: { en: 'Sell', fa: 'فروش', ar: 'بيع' },
      buy: { en: 'Buy', fa: 'خرید', ar: 'شراء' },
    }
    return variantNames[v][lang]
  }

  const parentName = getLocalizedName(parentItem, locale)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const priceNum = price ? parseFloat(price) : undefined

    const data: CreateManagedItemRequest = {
      code: generatedCode,
      parentCode: parentItem.code,
      name: `${parentItem.name} ${getRegionName(region, 'en')} (${getVariantName(variant, 'en')})`,
      nameFa: `${parentItem.nameFa || parentItem.name} ${getRegionName(region, 'fa')} (${getVariantName(variant, 'fa')})`,
      nameAr: parentItem.nameAr ? `${parentItem.nameAr} ${getRegionName(region, 'ar')} (${getVariantName(variant, 'ar')})` : undefined,
      variant,
      region,
      category: parentItem.category,
      source: 'manual',
      icon: parentItem.icon,
      overridePrice: priceNum,
    }

    onSubmit(data)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-elevated rounded-2xl border border-border-light p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {t('addRegionalVariant')}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Parent info */}
        <div className="mb-4 p-3 bg-bg-secondary rounded-lg">
          <p className="text-sm text-text-tertiary">{t('baseCurrency')}</p>
          <p className="text-base font-semibold text-text-primary">{parentName}</p>
          <p className="text-sm text-text-tertiary">{parentItem.code}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Region */}
          <SearchableSelect
            label={t('region')}
            value={region}
            onChange={(value) => setRegion(value as ItemRegion)}
            options={regions.map((reg) => ({
              value: reg,
              label: t(`region_${reg}`),
            }))}
            placeholder={t('selectRegion')}
            noResultsText={t('noResultsFound')}
          />

          {/* Variant (Buy/Sell) */}
          <SearchableSelect
            label={t('variantType')}
            value={variant}
            onChange={(value) => setVariant(value as ItemVariant)}
            options={variants.map((v) => ({
              value: v,
              label: t(`variant_${v}`),
            }))}
            placeholder={t('selectVariant')}
            noResultsText={t('noResultsFound')}
          />

          {/* Generated code preview */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t('generatedCode')}
            </label>
            <div className="px-4 py-3 bg-bg-base border border-border-light rounded-lg text-text-tertiary font-mono text-sm">
              {generatedCode}
            </div>
          </div>

          {/* Price */}
          <Input
            label={t('price')}
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            required
            dir="ltr"
            icon={<FiDollarSign className="w-5 h-5" />}
            hint={t('regionalPriceHint')}
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
              {isLoading ? t('creating') : t('addVariant')}
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
  const categories: (ItemCategory | 'all')[] = ['all', 'currencies', 'crypto', 'gold']

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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [variantParent, setVariantParent] = useState<ManagedItem | null>(null)

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const toastIdRef = useRef(0)

  // Add toast helper
  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, type, title, message }])
  }, [])

  // Remove toast helper
  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

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
  const [createItem, { isLoading: isCreating }] = useCreateManagedItemMutation()
  const [deleteItem, { isLoading: isDeleting }] = useDeleteManagedItemMutation()

  // Category sort order: currencies first, then gold, crypto
  const categoryOrder: Record<ItemCategory, number> = {
    currencies: 0,
    gold: 1,
    crypto: 2,
  }

  // Sort function: by category first, then by displayOrder
  const sortByCategory = (a: ManagedItem, b: ManagedItem) => {
    const catA = categoryOrder[a.category] ?? 99
    const catB = categoryOrder[b.category] ?? 99
    if (catA !== catB) return catA - catB
    return a.displayOrder - b.displayOrder
  }

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
            (item.nameFa && item.nameFa.includes(query)) ||
            item.name.toLowerCase().includes(query) ||
            (item.nameAr && item.nameAr.includes(query))
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

    // Sort by category first, then by displayOrder within each category
    parents.sort((a, b) => sortByCategory(a.parent, b.parent))
    orphans.sort(sortByCategory)

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
  const handleSetOverride = async (price: number, change?: number, duration?: number, isIndefinite?: boolean) => {
    if (!overrideItem) return
    const itemName = getLocalizedName(overrideItem, locale)
    try {
      await setOverride({
        code: overrideItem.code,
        price,
        change,
        duration,
        isIndefinite,
      }).unwrap()
      setOverrideItem(null)
      addToast('success', t('toastOverrideSuccess'), `${itemName}: ${formatPrice(price, locale)}`)
    } catch (err) {
      console.error('Failed to set override:', err)
      addToast('error', t('toastOverrideError'), getErrorMessage(err))
    }
  }

  // Handle clear override
  const handleClearOverride = async (code: string) => {
    try {
      await clearOverride(code).unwrap()
      addToast('success', t('toastClearOverrideSuccess'))
    } catch (err) {
      console.error('Failed to clear override:', err)
      addToast('error', t('toastClearOverrideError'), getErrorMessage(err))
    }
  }

  // Handle toggle active
  const handleToggleActive = async (item: ManagedItem) => {
    const itemName = getLocalizedName(item, locale)
    try {
      await updateItem({
        code: item.code,
        isActive: !item.isActive,
      }).unwrap()
      addToast(
        'success',
        item.isActive ? t('toastDeactivateSuccess') : t('toastActivateSuccess'),
        itemName
      )
    } catch (err) {
      console.error('Failed to toggle active:', err)
      addToast('error', t('toastToggleActiveError'), getErrorMessage(err))
    }
  }

  // Handle create new currency
  const handleCreateCurrency = async (data: CreateManagedItemRequest) => {
    try {
      const result = await createItem(data).unwrap()
      setShowCreateModal(false)
      addToast('success', t('toastCreateCurrencySuccess'), result.name)
    } catch (err) {
      console.error('Failed to create currency:', err)
      addToast('error', t('toastCreateCurrencyError'), getErrorMessage(err))
    }
  }

  // Handle delete currency
  const handleDeleteCurrency = async (code: string) => {
    if (!confirm(t('confirmDelete'))) return
    try {
      await deleteItem(code).unwrap()
      addToast('success', t('toastDeleteSuccess'), code)
    } catch (err) {
      console.error('Failed to delete currency:', err)
      addToast('error', t('toastDeleteError'), getErrorMessage(err))
    }
  }

  // Handle create regional variant
  const handleCreateVariant = async (data: CreateManagedItemRequest) => {
    try {
      const result = await createItem(data).unwrap()
      setVariantParent(null)
      addToast('success', t('toastVariantSuccess'), result.name)
    } catch (err) {
      console.error('Failed to create variant:', err)
      addToast('error', t('toastVariantError'), getErrorMessage(err))
    }
  }

  // Check if item can have regional variants (USD, AED, TRY/Lira)
  // These are currencies that have regional pricing (Turkey, Dubai, Herat)
  const canAddRegionalVariant = (item: ManagedItem) => {
    const allowedCodes = [
      // USD variants
      'usd', 'usd_official', 'usd_sana_buy', 'usd_sana_sell', 'usd_nima',
      // AED/Dirham variants
      'aed', 'aed_official', 'aed_sana_buy', 'aed_sana_sell', 'aed_nima',
      // Turkish Lira
      'try',
    ]
    return item.source === 'api' && allowedCodes.includes(item.code.toLowerCase())
  }

  // Render item row
  const renderItemRow = (item: ManagedItem, isVariant = false) => {
    const name = getLocalizedName(item, locale)

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
            {item.region && (
              <Badge variant="manual">{t(`region_${item.region}`)}</Badge>
            )}
            {item.isOverridden && (
              <Badge variant="override">{t('overridden')}</Badge>
            )}
            {item.isOverridden && item.overrideExpiresAt && (() => {
              const timeInfo = formatRemainingTime(item.overrideExpiresAt, locale)
              if (timeInfo) {
                if (timeInfo.isExpired) {
                  return (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      {t('expired')}
                    </span>
                  )
                }
                return (
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    timeInfo.isExpiringSoon
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  )}>
                    {t('expiresIn', { time: timeInfo.text })}
                  </span>
                )
              }
              return null
            })()}
            {item.isOverridden && !item.overrideExpiresAt && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                {t('indefinite')}
              </span>
            )}
            {!item.isActive && (
              <Badge variant="inactive">{t('inactive')}</Badge>
            )}
          </div>
          <p className="text-sm text-text-tertiary">{item.code}</p>
        </div>

        {/* Price - Show override if set, otherwise show current API price */}
        <div className="text-left min-w-[140px]">
          {item.isOverridden && item.overridePrice ? (
            <div>
              <p className="text-xs text-warning-text mb-0.5">{t('overridden')}</p>
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
          ) : item.currentPrice !== undefined ? (
            <div>
              <p className="text-xs text-text-tertiary mb-0.5">{t('apiPrice')}</p>
              <p className="text-base font-semibold text-text-primary">
                {formatPrice(item.currentPrice, locale)}
              </p>
              {item.currentChange !== undefined && item.currentChange !== 0 && (
                <p
                  className={cn(
                    'text-sm',
                    item.currentChange >= 0 ? 'text-success-text' : 'text-error-text'
                  )}
                >
                  {item.currentChange >= 0 ? '+' : ''}
                  {item.currentChange.toFixed(2)}%
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">{t('noPrice')}</p>
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

          {/* Add Regional Variant button - only for allowed currencies */}
          {canAddRegionalVariant(item) && (
            <button
              onClick={() => setVariantParent(item)}
              className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-accent transition-colors"
              title={t('addRegionalVariant')}
            >
              <FiPlus className="w-4 h-4" />
            </button>
          )}

          {/* Delete button - only for manual items */}
          {item.source === 'manual' && (
            <button
              onClick={() => handleDeleteCurrency(item.code)}
              disabled={isDeleting}
              className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-error-text transition-colors disabled:opacity-50"
              title={t('delete')}
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // Render parent with variants
  const renderParentGroup = (parent: ManagedItem, variants: ManagedItem[]) => {
    const isExpanded = expandedParents.has(parent.code)
    const name = getLocalizedName(parent, locale)

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
          <Button variant="filled" size="md" onClick={() => setShowCreateModal(true)}>
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

      {/* Create Currency Modal */}
      {showCreateModal && (
        <CreateCurrencyModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateCurrency}
          isLoading={isCreating}
        />
      )}

      {/* Add Regional Variant Modal */}
      {variantParent && (
        <AddRegionalVariantModal
          parentItem={variantParent}
          onClose={() => setVariantParent(null)}
          onSubmit={handleCreateVariant}
          isLoading={isCreating}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
