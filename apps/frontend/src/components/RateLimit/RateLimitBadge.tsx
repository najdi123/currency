'use client';

import { useRateLimit } from '@/hooks/useRateLimit';
import { useTranslations } from 'next-intl';

// Utility function for conditional classnames
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

export function RateLimitBadge() {
  const t = useTranslations('rateLimit');
  const { status, loading } = useRateLimit();

  if (loading || !status) {
    return (
      <div className="h-8 w-24 animate-pulse bg-white/5 rounded-lg" />
    );
  }

  // Calculate percentage of remaining requests
  const remainingPercentage = Math.round((status.remaining / status.limit) * 100);

  const getColor = () => {
    // Green if more than 50% remaining
    if (remainingPercentage > 50) return 'bg-green-500/20 text-green-400 border-green-500/30';
    // Yellow if 20-50% remaining (inclusive of 20%)
    if (remainingPercentage >= 20) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    // Red if less than 20% remaining
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getTierColor = () => {
    const colors = {
      free: 'bg-gray-500/20 text-gray-300',
      premium: 'bg-blue-500/20 text-blue-300',
      enterprise: 'bg-purple-500/20 text-purple-300',
    };
    return colors[status.tier] || colors.free;
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10"
      role="status"
      aria-live="polite"
      aria-label={`${t('apiUsage')}: ${status.remaining} ${t('remaining')} out of ${status.limit} ${t('requests')}`}
    >
      {/* Tier Badge */}
      <span className={cn(
        'px-2 py-0.5 text-xs rounded font-medium',
        getTierColor()
      )}>
        {status.tier.toUpperCase()}
      </span>

      {/* Usage Indicator */}
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium',
        getColor()
      )}>
        <div className={cn(
          'w-2 h-2 rounded-full',
          remainingPercentage > 50 ? 'bg-green-400' :
          remainingPercentage > 20 ? 'bg-yellow-400' : 'bg-red-400',
          remainingPercentage < 30 && 'animate-pulse'
        )} />
        <span>
          {status.remaining}/{status.limit}
        </span>
      </div>
    </div>
  );
}
