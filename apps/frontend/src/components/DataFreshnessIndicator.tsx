'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FiClock, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { getDataAge, getRelativeTime } from '@/lib/utils/dateUtils';
import { Alert } from '@/components/ui/Alert';

interface DataFreshnessIndicatorProps {
  lastUpdated: string | Date;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * DataFreshnessIndicator - Shows data age and refresh button
 *
 * Features:
 * - Displays relative time (e.g., "5 دقیقه پیش")
 * - Warning indicator for stale data (>24 hours)
 * - Manual refresh button when data is stale
 * - Loading state with spinning icon
 * - Error handling with auto-dismiss
 *
 * Accessibility:
 * - ARIA labels on buttons
 * - Keyboard accessible
 * - Screen reader friendly
 */
export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  lastUpdated,
  onRefresh,
  isRefreshing = false,
}) => {
  const t = useTranslations('Notifications');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const age = getDataAge(lastUpdated);
  const relativeTime = getRelativeTime(lastUpdated, t);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onRefresh();
    } catch (err: any) {
      setError(t('dataFreshness.refreshError'));
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2" >
      {/* Error Message */}
      {error && (
        <Alert variant="error" className="text-xs py-2 px-3" animate={true}>
          {error}
        </Alert>
      )}

      {/* Freshness Indicator */}
      <div className="flex items-center justify-between gap-3">
        {/* Last Updated Time */}
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <FiClock className="w-3 h-3" aria-hidden="true" />
          <span>{relativeTime}</span>
        </div>

        {/* Stale Warning + Refresh Button */}
        {age.isStale && (
          <div className="flex items-center gap-2">
            {/* Warning */}
            <div className="flex items-center gap-1 text-warning-text text-xs">
              <FiAlertTriangle className="w-3 h-3" aria-hidden="true" />
              <span>{t('dataFreshness.staleData')}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md',
                'text-xs font-medium',
                'border border-accent/30 text-accent',
                'hover:bg-accent/5 hover:border-accent/50',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'active:scale-95',
                'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-1'
              )}
              aria-label={t('dataFreshness.refreshButton')}
            >
              <FiRefreshCw
                className={cn(
                  'w-3 h-3',
                  (isLoading || isRefreshing) && 'animate-spin'
                )}
                aria-hidden="true"
              />
              <span>{t('dataFreshness.refreshButton')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
