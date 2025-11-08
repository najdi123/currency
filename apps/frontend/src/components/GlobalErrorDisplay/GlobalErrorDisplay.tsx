'use client';

import { useTranslations } from 'next-intl';

interface GlobalErrorDisplayProps {
  onRetry: () => void
}

export const GlobalErrorDisplay = ({ onRetry }: GlobalErrorDisplayProps) => {
  const t = useTranslations('Errors');
  return (
    <div
      className="bg-error-bg border border-error-text/30 dark:border-error-text/50 rounded-[var(--radius-lg)] p-6 mb-6 animate-fade-in mt-2"
      
    >
      <div className="text-center">
        <h3 className="text-lg font-semibold text-error-text mb-2">
          {t('globalErrorTitle')}
        </h3>
        <p className="text-error-text mb-4">
          {t('globalErrorDescription')}
        </p>
        <button
          onClick={onRetry}
          className="bg-red-600 dark:bg-red-700 text-white rounded px-6 py-2 hover:bg-red-700 dark:hover:bg-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
        >
          {t('retry')}
        </button>
      </div>
    </div>
  )
}
