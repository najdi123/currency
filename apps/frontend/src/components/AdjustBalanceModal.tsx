'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FiX, FiAlertCircle } from 'react-icons/fi'
import {
  useAdjustBalanceMutation,
  type CurrencyType,
  type TransactionDirection,
  type TransactionReason,
} from '@/lib/store/services/walletApi'
import {
  validateAmount,
  validateCurrencyCode,
  generateIdempotencyKey,
  getCurrencyTypeLabel,
  getTransactionReasonLabel,
} from '@/lib/utils/walletFormatters'
import { Alert } from '@/components/ui/Alert'

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

interface AdjustBalanceModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userEmail?: string
  onSuccess?: () => void
}

export function AdjustBalanceModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  onSuccess,
}: AdjustBalanceModalProps) {
  const [currencyType, setCurrencyType] = useState<CurrencyType>('fiat')
  const [currencyCode, setCurrencyCode] = useState('')
  const [direction, setDirection] = useState<TransactionDirection>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState<TransactionReason>('deposit')
  const [requestId, setRequestId] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showConfirm, setShowConfirm] = useState(false)

  const t = useTranslations('Wallet')
  const tCommon = useTranslations('Common')
  const [adjustBalance, { isLoading, isSuccess, isError, error, reset }] = useAdjustBalanceMutation()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrencyType('fiat')
      setCurrencyCode('')
      setDirection('credit')
      setAmount('')
      setReason('deposit')
      setRequestId('')
      setIdempotencyKey(generateIdempotencyKey())
      setErrors({})
      setShowConfirm(false)
      reset()
    }
  }, [isOpen, reset])

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2000)
    }
  }, [isSuccess, onSuccess, onClose])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showConfirm) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, showConfirm, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate currency code
    const codeValidation = validateCurrencyCode(currencyCode, t)
    if (!codeValidation.isValid) {
      newErrors.currencyCode = codeValidation.error!
    }

    // Validate amount
    const amountValidation = validateAmount(amount, 8, t)
    if (!amountValidation.isValid) {
      newErrors.amount = amountValidation.error!
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setShowConfirm(true)
  }

  const handleConfirm = async () => {
    try {
      await adjustBalance({
        userId,
        currencyType,
        currencyCode: currencyCode.toUpperCase(),
        direction,
        amount,
        reason,
        requestId: requestId || undefined,
        idempotencyKey,
      }).unwrap()
    } catch (err) {
      console.error('Failed to adjust balance:', err)
      setShowConfirm(false)
    }
  }

  const handleCancel = () => {
    setShowConfirm(false)
  }

  if (!isOpen) return null

  const getMaxDecimals = () => {
    if (currencyType === 'crypto') return 8
    if (currencyType === 'gold') return 4
    return 2
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-balance-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xl transition-opacity"
        onClick={!showConfirm && !isLoading ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-bg-elevated rounded-2xl shadow-apple-card border border-border-light w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-light" >
            <div>
              <h2 id="adjust-balance-title" className="text-xl font-semibold text-text-primary">
                {t('adjustBalanceTitle')}
              </h2>
              {userEmail && (
                <p className="text-sm text-text-tertiary mt-1">{t('user')} {userEmail}</p>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={isLoading || showConfirm}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={tCommon('close')}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6" >
            {/* Success Message */}
            {isSuccess && (
              <Alert variant="success" title={t('adjustBalanceSuccess')}>
                {t('transactionRecorded')}
              </Alert>
            )}

            {/* Error Message */}
            {isError && (
              <Alert variant="error" title={t('adjustBalanceError')}>
                {(error as any)?.data?.message || t('errorOccurred')}
              </Alert>
            )}

            {/* Confirmation View */}
            {showConfirm && !isSuccess && (
              <div className="space-y-4">
                <Alert variant="warning" title={t('confirmOperation')}>
                  {t('confirmAdjustBalance')}
                </Alert>

                <div className="bg-bg-base rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('currencyType')}</span>
                    <span className="text-text-primary font-medium">
                      {getCurrencyTypeLabel(currencyType, t)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('currencyCode')}</span>
                    <span className="text-text-primary font-medium">{currencyCode.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('transactionTypeLabel')}</span>
                    <span className="text-text-primary font-medium">
                      {direction === 'credit' ? t('credit') : t('debit')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('amount')}</span>
                    <span className={cn(
                      'font-bold',
                      direction === 'credit' ? 'text-success-text' : 'text-error-text'
                    )}>
                      {direction === 'credit' ? '+' : '-'}{amount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('reason')}</span>
                    <span className="text-text-primary font-medium">
                      {getTransactionReasonLabel(reason, t)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? t('processing') : t('confirmAndSubmit')}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-bg-secondary hover:bg-bg-elevated text-text-primary rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Form View */}
            {!showConfirm && !isSuccess && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Rate Limit Warning */}
                <Alert variant="info" icon={<FiAlertCircle />}>
                  {t('rateLimitWarning')}
                </Alert>

                {/* Currency Type */}
                <div>
                  <label htmlFor="currency-type" className="block text-sm font-medium text-text-secondary mb-2">
                    {t('currencyTypeLabel')}
                  </label>
                  <select
                    id="currency-type"
                    value={currencyType}
                    onChange={(e) => setCurrencyType(e.target.value as CurrencyType)}
                    className="w-full px-3 py-2 bg-bg-base border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  >
                    <option value="fiat">{t('fiat')}</option>
                    <option value="crypto">{t('crypto')}</option>
                    <option value="gold">{t('gold')}</option>
                  </select>
                </div>

                {/* Currency Code */}
                <div>
                  <label htmlFor="currency-code" className="block text-sm font-medium text-text-secondary mb-2">
                    {t('currencyCodeLabel')}
                  </label>
                  <input
                    type="text"
                    id="currency-code"
                    value={currencyCode}
                    onChange={(e) => {
                      setCurrencyCode(e.target.value)
                      if (errors.currencyCode) {
                        setErrors((prev) => ({ ...prev, currencyCode: '' }))
                      }
                    }}
                    className={cn(
                      'w-full px-3 py-2 bg-bg-base border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent',
                      errors.currencyCode ? 'border-error-text' : 'border-border-light'
                    )}
                    placeholder="USD"
                    maxLength={10}
                    required
                  />
                  {errors.currencyCode && (
                    <p className="text-sm text-error-text mt-1">{errors.currencyCode}</p>
                  )}
                </div>

                {/* Direction */}
                <div>
                  <label htmlFor="direction" className="block text-sm font-medium text-text-secondary mb-2">
                    {t('transactionTypeLabel')}
                  </label>
                  <select
                    id="direction"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as TransactionDirection)}
                    className="w-full px-3 py-2 bg-bg-base border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  >
                    <option value="credit">{t('credit')}</option>
                    <option value="debit">{t('debit')}</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-text-secondary mb-2">
                    {t('amountLabel', { decimals: getMaxDecimals() })}
                  </label>
                  <input
                    type="text"
                    id="amount"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      if (errors.amount) {
                        setErrors((prev) => ({ ...prev, amount: '' }))
                      }
                    }}
                    className={cn(
                      'w-full px-3 py-2 bg-bg-base border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent',
                      errors.amount ? 'border-error-text' : 'border-border-light'
                    )}
                    placeholder="100.50"
                    required
                  />
                  {errors.amount && (
                    <p className="text-sm text-error-text mt-1">{errors.amount}</p>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-text-secondary mb-2">
                    {t('reasonLabel')}
                  </label>
                  <select
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value as TransactionReason)}
                    className="w-full px-3 py-2 bg-bg-base border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  >
                    <option value="deposit">{t('deposit')}</option>
                    <option value="withdrawal">{t('withdrawal')}</option>
                    <option value="transfer">{t('transfer')}</option>
                    <option value="adjustment">{t('adjustment')}</option>
                  </select>
                </div>

                {/* Request ID (Optional) */}
                <div>
                  <label htmlFor="request-id" className="block text-sm font-medium text-text-secondary mb-2">
                    {t('requestId')}
                  </label>
                  <input
                    type="text"
                    id="request-id"
                    value={requestId}
                    onChange={(e) => setRequestId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-base border border-border-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="MongoDB ObjectId"
                  />
                </div>

                {/* Idempotency Key (Auto-generated) */}
                <div>
                  <label htmlFor="idempotency-key" className="block text-sm font-medium text-text-secondary mb-2">
                    {t('idempotencyKey')}
                  </label>
                  <input
                    type="text"
                    id="idempotency-key"
                    value={idempotencyKey}
                    readOnly
                    className="w-full px-3 py-2 bg-bg-secondary border border-border-light rounded-lg text-text-tertiary cursor-not-allowed"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    {t('idempotencyKeyDesc')}
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('continue')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
