'use client';

import { useRateLimit } from '@/hooks/useRateLimit';
import { useTranslations } from 'next-intl';
import { FiClock as Clock, FiTrendingUp as TrendingUp, FiZap as Zap } from 'react-icons/fi';

// Utility function for conditional classnames
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

export function RateLimitMeter() {
  const t = useTranslations('rateLimit');
  const { status, loading, error } = useRateLimit();

  if (loading) {
    return (
      <div className="animate-pulse bg-white/5 rounded-lg h-48" />
    );
  }

  if (error || !status) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
        <p className="text-red-400 text-sm">{t('errorLoading')}</p>
      </div>
    );
  }

  const used = status.limit - status.remaining;
  const percentage = Math.round((used / status.limit) * 100);

  const getBarColor = () => {
    if (percentage < 50) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    if (percentage < 80) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    return 'bg-gradient-to-r from-red-500 to-pink-500';
  };

  const formatResetTime = () => {
    const resetDate = new Date(status.resetAt);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));

    if (hours > 24) {
      const days = Math.ceil(hours / 24);
      return `${days} ${t(days === 1 ? 'day' : 'days')}`;
    }
    return hours > 1 ? `${hours} ${t('hours')}` : t('lessThanHour');
  };

  return (
    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm rounded-lg p-6 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">
          {t('apiUsage')}
        </h3>
        <div className="flex items-center gap-2">
          <span className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            status.tier === 'free' && 'bg-gray-500/20 text-gray-300',
            status.tier === 'premium' && 'bg-blue-500/20 text-blue-300',
            status.tier === 'enterprise' && 'bg-purple-500/20 text-purple-300',
          )}>
            {status.tier.charAt(0).toUpperCase() + status.tier.slice(1)} {t('plan')}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/80 font-medium">
            {used} / {status.limit} {t('requests')}
          </span>
          <span className="text-white/60">
            {percentage}%
          </span>
        </div>

        <div
          className="relative w-full bg-white/10 rounded-full h-4 overflow-hidden"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${t('apiUsage')}: ${percentage}% ${t('used')}`}
        >
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out',
              getBarColor()
            )}
            style={{ width: `${percentage}%` }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
        </div>
      </div>

      {/* Status Info */}
      <div className="flex items-center justify-between text-sm text-white/60 mb-4">
        <div className="flex items-center gap-2">
          <Clock size={16} />
          <span>{t('resetsIn')} {formatResetTime()}</span>
        </div>

        <div className="flex items-center gap-1.5 text-white/80">
          <span>{status.remaining} {t('remaining')}</span>
        </div>
      </div>

      {/* Upgrade CTA */}
      {status.tier === 'free' && percentage > 70 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white mb-1">
                {t('nearLimitWarning')}
              </p>
              <p className="text-xs text-white/60">
                {t('upgradeForMore')}
              </p>
            </div>
            <button
              onClick={() => window.open('/pricing', '_blank')}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium whitespace-nowrap"
            >
              <Zap size={16} aria-hidden="true" />
              <span>{t('upgradePlan')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Critical Warning */}
      {percentage > 90 && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-500/20 rounded-full">
              <TrendingUp className="text-red-400" size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-red-400 mb-1">
                {t('criticalWarning')}
              </p>
              <p className="text-xs text-red-400/70">
                {t('criticalMessage')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
