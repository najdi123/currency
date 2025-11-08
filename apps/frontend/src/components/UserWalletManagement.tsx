'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { FiDollarSign, FiRefreshCw, FiEdit3 } from 'react-icons/fi'
import {
  useGetUserWalletQuery,
  useGetUserTransactionsQuery,
  type TransactionDirection,
} from '@/lib/store/services/walletApi'
import { TransactionHistory } from './TransactionHistory'
import { AdjustBalanceModal } from './AdjustBalanceModal'
import {
  formatCurrency,
  getCurrencyTypeBadgeColor,
  getCurrencyTypeLabel,
} from '@/lib/utils/walletFormatters'
import { formatDate } from '@/lib/utils/dateUtils'
import { Alert } from '@/components/ui/Alert'

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

interface UserWalletManagementProps {
  userId: string
  userEmail?: string
  userName?: string
}

export function UserWalletManagement({ userId, userEmail, userName }: UserWalletManagementProps) {
  const t = useTranslations('Wallet')
  const locale = useLocale()
  const tCommon = useTranslations('Common')
  const [transactionPage, setTransactionPage] = useState(1)
  const [transactionFilters, setTransactionFilters] = useState<{
    currencyCode?: string
    direction?: TransactionDirection
  }>({})
  const [showAdjustModal, setShowAdjustModal] = useState(false)

  // Fetch wallet data
  const {
    data: walletData,
    isLoading: isWalletLoading,
    isError: isWalletError,
    error: walletError,
    refetch: refetchWallet,
  } = useGetUserWalletQuery(userId)

  // Backend returns array directly, not wrapped in object
  const balances = Array.isArray(walletData) ? walletData : []

  // Fetch transactions
  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    isError: isTransactionsError,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useGetUserTransactionsQuery({
    userId,
    page: transactionPage,
    pageSize: 10,
    ...transactionFilters,
  })

  const handleRefresh = () => {
    refetchWallet()
    refetchTransactions()
  }

  const handlePageChange = (page: number) => {
    setTransactionPage(page)
  }

  const handleFilterChange = (currencyCode?: string, direction?: TransactionDirection) => {
    setTransactionFilters({ currencyCode, direction })
    setTransactionPage(1) // Reset to first page when filters change
  }

  const handleAdjustSuccess = () => {
    refetchWallet()
    refetchTransactions()
  }

  const displayName = userName || userEmail || `${t('user')} ${userId.substring(0, 8)}...`

  return (
    <div className="space-y-6" >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{t('userWallet')}</h2>
          <p className="text-sm text-text-tertiary mt-1">{displayName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FiEdit3 className="w-4 h-4" />
            <span>{t('adjustBalance')}</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isWalletLoading || isTransactionsLoading}
            className="p-2 rounded-lg bg-bg-elevated hover:bg-bg-secondary border border-border-light text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('refresh')}
          >
            <FiRefreshCw
              className={cn('w-5 h-5', (isWalletLoading || isTransactionsLoading) && 'animate-spin')}
            />
          </button>
        </div>
      </div>

      {/* Wallet Error */}
      {isWalletError && (
        <Alert variant="error" title={t('errorLoadingWallet')}>
          {(walletError as any)?.data?.message || t('errorOccurred')}
        </Alert>
      )}

      {/* Wallet Balances */}
      {isWalletLoading && !walletData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-bg-secondary rounded-xl h-32" />
            </div>
          ))}
        </div>
      )}

      {!isWalletLoading && balances.length === 0 && (
        <div className="text-center py-12 bg-bg-elevated rounded-xl border border-border-light">
          <FiDollarSign className="w-12 h-12 mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">{t('emptyUserWallet')}</p>
          <p className="text-sm text-text-tertiary mt-1">
            {t('emptyUserWalletDesc')}
          </p>
          <button
            onClick={() => setShowAdjustModal(true)}
            className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            {t('addInitialBalance')}
          </button>
        </div>
      )}

      {!isWalletLoading && balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((balance) => {
            const dateInfo = formatDate(balance.updatedAt, t, locale)
            return (
              <div
                key={balance.id}
                className="bg-gradient-to-br from-bg-elevated to-bg-secondary border border-border-light rounded-xl p-5 hover:shadow-lg transition-all"
              >
                {/* Currency Type Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium',
                      getCurrencyTypeBadgeColor(balance.currencyType)
                    )}
                  >
                    {getCurrencyTypeLabel(balance.currencyType, t)}
                  </span>
                  <span className="text-xs text-text-tertiary" title={dateInfo.absolute}>
                    {dateInfo.relative}
                  </span>
                </div>

                {/* Currency Code */}
                <div className="text-sm font-medium text-text-secondary mb-2">
                  {balance.currencyCode}
                </div>

                {/* Amount */}
                <div className="text-2xl font-bold text-text-primary mb-1">
                  {formatCurrency(balance.amount, balance.currencyCode, balance.currencyType)}
                </div>

                {/* Version and Created Date */}
                <div className="flex items-center justify-between text-xs text-text-tertiary mt-2">
                  <span>{t('version')}: {balance.version}</span>
                  <span title={formatDate(balance.createdAt, t, locale).absolute}>
                    {t('created')} {formatDate(balance.createdAt, t, locale).relative}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border-light" />

      {/* Transaction History */}
      {transactionsData && (
        <TransactionHistory
          transactions={transactionsData.transactions}
          pagination={transactionsData.pagination}
          isLoading={isTransactionsLoading}
          isError={isTransactionsError}
          error={transactionsError}
          onPageChange={handlePageChange}
          onFilterChange={handleFilterChange}
          currentFilters={transactionFilters}
        />
      )}

      {!transactionsData && !isTransactionsLoading && !isTransactionsError && (
        <div className="text-center py-8">
          <p className="text-text-tertiary">{t('loadingTransactions')}</p>
        </div>
      )}

      {/* Adjust Balance Modal */}
      <AdjustBalanceModal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        userId={userId}
        userEmail={userEmail}
        onSuccess={handleAdjustSuccess}
      />
    </div>
  )
}
