'use client';

import { useRateLimit } from '@/hooks/useRateLimit';
import { useTranslations } from 'next-intl';

/**
 * RateLimitBadge - Compact badge showing current rate limit status
 *
 * Features:
 * - Shows tier level (free/premium/enterprise)
 * - Displays remaining requests count
 * - Color-coded based on usage percentage
 * - Compact design for header placement
 * - RTL support
 *
 * Accessibility:
 * - ARIA labels for screen readers
 * - Semantic HTML
 * - Color and text indicators (not color alone)
 */
export function RateLimitBadge() {
  const t = useTranslations('rateLimit');
  const { status, loading } = useRateLimit();

  // Don't show during loading or if no status
  if (loading || !status) return null;

  const getUsageColor = () => {
    if (status.percentage > 50) return 'bg-green-500/20 text-green-500';
    if (status.percentage > 20) return 'bg-yellow-500/20 text-yellow-500';
    return 'bg-red-500/20 text-red-500';
  };

  const getIndicatorColor = () => {
    if (status.percentage > 50) return 'bg-green-500';
    if (status.percentage > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTierColor = () => {
    const colors = {
      free: 'bg-gray-500/20 text-gray-500',
      premium: 'bg-blue-500/20 text-blue-500',
      enterprise: 'bg-purple-500/20 text-purple-500',
    };

    return colors[status.tier] || 'bg-gray-500/20 text-gray-500';
  };

  const getTierLabel = () => {
    return status.tier.toUpperCase();
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 dark:bg-white/5 backdrop-blur-sm border border-white/10"
      role="status"
      aria-label={`${t('apiUsage')}: ${status.remaining} of ${status.limit} ${t('requests')}`}
    >
      {/* Tier Badge */}
      <span
        className={`px-2 py-0.5 text-xs font-semibold rounded ${getTierColor()}`}
        aria-label={`${t('plan')}: ${status.tier}`}
      >
        {getTierLabel()}
      </span>

      {/* Usage Indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${getIndicatorColor()} ${
            status.percentage > 20 ? 'animate-pulse' : ''
          }`}
          aria-hidden="true"
        />
        <span className={`text-sm font-medium ${getUsageColor()}`}>
          {status.remaining}/{status.limit}
        </span>
      </div>
    </div>
  );
}
