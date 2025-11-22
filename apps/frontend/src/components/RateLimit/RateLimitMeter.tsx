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

  const used = status.maxRequestsPerWindow - status.remaining;
  const percentage = Math.round((used / status.maxRequestsPerWindow) * 100);

  const getBarColor = () => {
    if (percentage < 50) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    if (percentage < 80) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    return 'bg-gradient-to-r from-red-500 to-pink-500';
  };

  const formatResetTime = () => {
    const resetDate = new Date(status.windowEnd);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    const minutes = Math.ceil(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm rounded-lg p-6 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">
          {t('apiUsage')}
        </h3>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
            {status.windowDurationHours}h {t('window')}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/80 font-medium">
            {used} / {status.maxRequestsPerWindow} {t('requests')}
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

      {/* Warning when quota running low */}
      {percentage > 70 && percentage <= 90 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-full">
              <Clock className="text-yellow-400" size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-400 mb-1">
                {t('quotaRunningLow')}
              </p>
              <p className="text-xs text-yellow-400/70">
                {t('quotaResetsSoon')} {formatResetTime()}
              </p>
            </div>
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
                {t('staleDataWillShow')} {formatResetTime()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
