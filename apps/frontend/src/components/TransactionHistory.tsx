'use client'

import { useState, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { FiChevronLeft, FiChevronRight, FiArrowUp, FiArrowDown, FiFilter } from 'react-icons/fi'
import type {
  Transaction,
  TransactionDirection,
  TransactionsResponse,
} from '@/lib/store/services/walletApi'
import {
  formatCurrency,
  getTransactionReasonLabel,
  getTransactionDirectionLabel,
  getDirectionColor,
  getCurrencyTypeBadgeColor,
  getCurrencyTypeLabel,
} from '@/lib/utils/walletFormatters'
import { formatDate } from '@/lib/utils/dateUtils'
import { Alert } from '@/components/ui/Alert'

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

interface TransactionHistoryProps {
  transactions: Transaction[]
  pagination: TransactionsResponse['pagination']
  isLoading: boolean
  isError: boolean
  error?: any
  onPageChange: (page: number) => void
  onFilterChange: (currencyCode?: string, direction?: TransactionDirection) => void
  currentFilters: {
    currencyCode?: string
    direction?: TransactionDirection
  }
}

export function TransactionHistory({
  transactions,
  pagination,
  isLoading,
  isError,
  error,
  onPageChange,
  onFilterChange,
  currentFilters,
}: TransactionHistoryProps) {
  const t = useTranslations('Wallet')
  const locale = useLocale()
  const [showFilters, setShowFilters] = useState(false)
  const [filterCurrency, setFilterCurrency] = useState(currentFilters.currencyCode || '')
  const [filterDirection, setFilterDirection] = useState<string>(currentFilters.direction || '')

  // Extract unique currency codes from transactions
  const availableCurrencies = useMemo(() => {
    const codes = new Set(transactions.map((t) => t.currencyCode))
    return Array.from(codes).sort()
  }, [transactions])

  const handleApplyFilters = () => {
    onFilterChange(
      filterCurrency || undefined,
      (filterDirection as TransactionDirection) || undefined
    )
    setShowFilters(false)
  }

  const handleResetFilters = () => {
    setFilterCurrency('')
    setFilterDirection('')
    onFilterChange(undefined, undefined)
    setShowFilters(false)
  }

  if (isError) {
    return (
      <Alert variant="error" title={t('errorLoadingWallet')}>
        {error?.data?.message || t('errorOccurred')}
      </Alert>
    )
  }

  return (
    <div className="space-y-4" >
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">{t('transactions')}</h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            showFilters
              ? 'bg-accent text-white'
              : 'bg-bg-secondary hover:bg-bg-elevated text-text-secondary hover:text-text-primary'
          )}
        >
          <FiFilter className="w-4 h-4" />
          <span>{t('filter')}</span>
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-bg-elevated border border-border-light rounded-lg p-4 space-y-4 animate-slide-down-fade">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Currency Filter */}
            <div>
              <label htmlFor="filter-currency" className="block text-sm font-medium text-text-secondary mb-2">
                {t('currency')}
              </label>
              <select
                id="filter-currency"
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-bg-base border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">{t('allCurrencies')}</option>
                {availableCurrencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            {/* Direction Filter */}
            <div>
              <label htmlFor="filter-direction" className="block text-sm font-medium text-text-secondary mb-2">
                {t('transactionType')}
              </label>
              <select
                id="filter-direction"
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value)}
                className="w-full px-3 py-2 bg-bg-base border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">{t('allTransactions')}</option>
                <option value="credit">{t('credit')}</option>
                <option value="debit">{t('debit')}</option>
              </select>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
            >
              {t('applyFilter')}
            </button>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-bg-secondary hover:bg-bg-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors"
            >
              {t('clearFilter')}
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {(currentFilters.currencyCode || currentFilters.direction) && (
        <div className="flex flex-wrap gap-2">
          {currentFilters.currencyCode && (
            <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm">
              {t('currency')}: {currentFilters.currencyCode}
            </span>
          )}
          {currentFilters.direction && (
            <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm">
              {getTransactionDirectionLabel(currentFilters.direction, t)}
            </span>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-bg-secondary rounded-lg p-4 h-24" />
            </div>
          ))}
        </div>
      )}

      {/* Transactions List */}
      {!isLoading && transactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-tertiary">{t('noTransactionsFound')}</p>
        </div>
      )}

      {!isLoading && transactions.length > 0 && (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border-light">
          <div className="text-sm text-text-tertiary">
            {t('page')} {pagination.page} {t('of')} {pagination.totalPages} ({t('total')} {pagination.total} {pagination.total === 1 ? t('transaction') : t('transactions_plural')})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className={cn(
                'p-2 rounded-lg transition-colors',
                pagination.page === 1
                  ? 'text-text-tertiary cursor-not-allowed'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              )}
              aria-label={t('previousPage')}
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className={cn(
                'p-2 rounded-lg transition-colors',
                pagination.page === pagination.totalPages
                  ? 'text-text-tertiary cursor-not-allowed'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              )}
              aria-label={t('nextPage')}
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Transaction Item Component
function TransactionItem({ transaction }: { transaction: Transaction }) {
  const t = useTranslations('Wallet')
  const locale = useLocale()
  const dateInfo = formatDate(transaction.createdAt, t, locale)
  const DirectionIcon = transaction.direction === 'credit' ? FiArrowUp : FiArrowDown

  return (
    <div className="bg-bg-elevated border border-border-light rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Icon and Details */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              transaction.direction === 'credit'
                ? 'bg-success-bg text-success-text'
                : 'bg-error-bg text-error-text'
            )}
          >
            <DirectionIcon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Main Info */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary">
                {getTransactionReasonLabel(transaction.reason, t)}
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  getCurrencyTypeBadgeColor(transaction.currencyType)
                )}
              >
                {getCurrencyTypeLabel(transaction.currencyType, t)}
              </span>
            </div>

            {/* Currency and Date */}
            <div className="flex items-center gap-3 text-xs text-text-tertiary flex-wrap">
              <span>{transaction.currencyCode}</span>
              <span>•</span>
              <span title={dateInfo.absolute}>{dateInfo.relative}</span>
            </div>

            {/* Balance After */}
            <div className="text-xs text-text-secondary">
              {t('balanceAfterTransaction')}{' '}
              <span className="font-medium">
                {formatCurrency(transaction.balanceAfter, transaction.currencyCode, transaction.currencyType)}
              </span>
            </div>

            {/* Admin Meta (if available) */}
            {transaction.meta?.adminEmail && (
              <div className="text-xs text-text-tertiary">
                {t('by')} {transaction.meta.adminEmail}
              </div>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="text-left flex-shrink-0">
          <div
            className={cn(
              'text-lg font-semibold',
              getDirectionColor(transaction.direction)
            )}
          >
            {transaction.direction === 'credit' ? '+' : '-'}
            {formatCurrency(transaction.amount, transaction.currencyCode, transaction.currencyType)}
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            {getTransactionDirectionLabel(transaction.direction, t)}
          </div>
        </div>
      </div>
    </div>
  )
}
