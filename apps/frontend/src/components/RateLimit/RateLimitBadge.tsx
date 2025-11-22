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

  // Calculate percentage of quota used (not remaining)
  const used = status.maxRequestsPerWindow - status.remaining;
  const usedPercentage = Math.round((used / status.maxRequestsPerWindow) * 100);

  const getColor = () => {
    // Green if less than 50% used
    if (usedPercentage < 50) return 'bg-green-500/20 text-green-400 border-green-500/30';
    // Yellow if 50-80% used
    if (usedPercentage < 80) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    // Red if more than 80% used
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10"
      role="status"
      aria-live="polite"
      aria-label={`${t('apiUsage')}: ${status.remaining} ${t('remaining')} out of ${status.maxRequestsPerWindow} ${t('requests')}`}
    >
      {/* Usage Indicator */}
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium',
        getColor()
      )}>
        <div className={cn(
          'w-2 h-2 rounded-full',
          usedPercentage < 50 ? 'bg-green-400' :
          usedPercentage < 80 ? 'bg-yellow-400' : 'bg-red-400',
          usedPercentage > 70 && 'animate-pulse'
        )} />
        <span>
          {status.remaining}/{status.maxRequestsPerWindow}
        </span>
      </div>
    </div>
  );
}
