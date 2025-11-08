'use client';

import { useTranslations } from 'next-intl';

interface StaleDataWarningProps {
  lastUpdated: Date | null
  onRetry: () => void
}

export const StaleDataWarning = ({ lastUpdated, onRetry }: StaleDataWarningProps) => {
  const t = useTranslations('Notifications');
  return (
    <div
      className="bg-warning-bg border border-warning-text/30 dark:border-warning-text/50 rounded-[var(--radius-lg)] p-4 mb-6 animate-fade-in"
      
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-warning-text"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-warning-text mb-1">
            {t('staleWarning.title')}
          </h3>
          <p className="text-sm text-warning-text">
            {t('staleWarning.message')}
            {lastUpdated && (
              <> {t('staleWarning.lastUpdate', { time: lastUpdated.toLocaleTimeString('fa-IR') })}</>
            )}
          </p>
          <button
            onClick={onRetry}
            className="mt-2 text-sm text-warning-text hover:opacity-80 font-medium underline focus:outline-none focus:ring-2 focus:ring-warning-text focus:ring-offset-2 rounded"
          >
            {t('staleWarning.retry')}
          </button>
        </div>
      </div>
    </div>
  )
}
