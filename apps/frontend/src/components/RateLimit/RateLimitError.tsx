'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FiClock as Clock, FiZap as Zap, FiX as X } from 'react-icons/fi';

// Utility function for conditional classnames
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

interface RateLimitErrorProps {
  retryAfter: number; // seconds
  resetAt: string;
  onRetry?: () => void;
  onClose?: () => void;
}

export function RateLimitError({ retryAfter, resetAt, onRetry, onClose }: RateLimitErrorProps) {
  const t = useTranslations('rateLimit');
  const [countdown, setCountdown] = useState(retryAfter);
  const [canRetry, setCanRetry] = useState(retryAfter <= 0);
  const modalRef = useRef<HTMLDivElement>(null);

  // Countdown timer - fixed to avoid memory leak
  useEffect(() => {
    if (countdown <= 0) {
      setCanRetry(true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanRetry(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []); // Only run once

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    if (minutes > 0) {
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    }
    return `0:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-limit-title"
      aria-describedby="rate-limit-description"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-orange-500/30 rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 z-10 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-white/60" />
          </button>
        )}

        <div className="relative p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full border border-orange-500/30">
              <Clock className="text-orange-400" size={32} />
            </div>
          </div>

          {/* Title */}
          <h3 id="rate-limit-title" className="text-2xl font-bold text-white text-center mb-2">
            {t('rateLimitExceeded')}
          </h3>

          {/* Message */}
          <p id="rate-limit-description" className="text-white/70 text-center mb-6 text-sm">
            {t('rateLimitMessage')}
          </p>

          {/* Countdown */}
          {!canRetry && (
            <div className="flex flex-col items-center mb-6">
              <p className="text-sm text-white/60 mb-2">{t('tryAgainIn')}</p>
              <div
                className="flex items-center gap-2 text-3xl font-mono font-bold text-orange-400"
                aria-live="polite"
                aria-atomic="true"
              >
                <Clock size={24} aria-hidden="true" />
                <span>{formatTime(countdown)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {canRetry && onRetry ? (
              <button
                onClick={onRetry}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                {t('tryAgain')}
              </button>
            ) : (
              <div className="flex-1 px-6 py-3 bg-white/5 text-white/40 rounded-lg text-center font-medium cursor-not-allowed">
                {t('pleaseWait')}
              </div>
            )}

            <button
              onClick={() => window.open('/pricing', '_blank')}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              <Zap size={18} aria-hidden="true" />
              <span>{t('upgradePlan')}</span>
            </button>
          </div>

          {/* Reset Time */}
          <p className="text-xs text-white/40 text-center mt-4">
            {t('quotaResetsAt')}: {new Date(resetAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
