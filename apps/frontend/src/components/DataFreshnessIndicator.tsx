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
  dataSource?: 'cache' | 'api' | 'fallback' | 'snapshot';
  isHistorical?: boolean;
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
  dataSource,
  isHistorical = false,
}) => {
  const t = useTranslations('Notifications');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const age = getDataAge(lastUpdated);
  const relativeTime = getRelativeTime(lastUpdated, t);

  // Map data source to display labels and colors
  const sourceConfig = {
    cache: {
      label: t('dataSource.cache'),
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
    },
    api: {
      label: t('dataSource.live'),
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
    },
    snapshot: {
      label: isHistorical ? t('dataSource.historical') : t('dataSource.snapshot'),
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800',
    },
    fallback: {
      label: t('dataSource.fallback'),
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
    },
  };

  const sourceStyle = dataSource ? sourceConfig[dataSource] : null;

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left side: Last Updated Time + Data Source */}
        <div className="flex items-center gap-2">
          {/* Last Updated Time */}
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <FiClock className="w-3 h-3" aria-hidden="true" />
            <span>{relativeTime}</span>
          </div>

          {/* Data Source Indicator */}
          {sourceStyle && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                sourceStyle.bg,
                sourceStyle.color,
                sourceStyle.border
              )}
              title={`Data source: ${sourceStyle.label}`}
            >
              <svg
                className="w-2.5 h-2.5"
                fill="currentColor"
                viewBox="0 0 8 8"
                aria-hidden="true"
              >
                <circle cx="4" cy="4" r="3" />
              </svg>
              {sourceStyle.label}
            </span>
          )}
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
