/**
 * Offline Banner Component
 *
 * Shows a banner when the user is offline or has a poor connection.
 * Automatically hides when connection is restored.
 *
 * Features:
 * - Shows when offline
 * - Shows warning for poor connection
 * - Auto-hides when connection restored
 * - Smooth animations
 * - Triggers refetch when reconnected (optional)
 * - Persian text with RTL support
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  useNetworkStatus,
  getQualityText,
  getConnectionTypeText,
  type ConnectionQuality,
} from '@/lib/hooks/useNetworkStatus'

/**
 * Offline Banner Props
 */
export interface OfflineBannerProps {
  /** Callback when connection is restored (can trigger refetch) */
  onReconnect?: () => void
  /** Show warning for poor connection (default: true) */
  showPoorConnectionWarning?: boolean
  /** Auto-hide after reconnect (default: true) */
  autoHideOnReconnect?: boolean
  /** Auto-hide delay in ms (default: 3000) */
  autoHideDelay?: number
  /** Custom className */
  className?: string
}

/**
 * Get banner style based on connection quality
 */
function getBannerStyle(quality: ConnectionQuality): {
  bg: string
  border: string
  text: string
  icon: string
} {
  switch (quality) {
    case 'offline':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-900 dark:text-red-100',
        icon: '🔴',
      }
    case 'poor':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-900 dark:text-amber-100',
        icon: '⚠️',
      }
    case 'fair':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-900 dark:text-yellow-100',
        icon: '📶',
      }
    default:
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-900 dark:text-green-100',
        icon: '✅',
      }
  }
}

/**
 * Get banner message based on connection quality
 */
function getBannerMessage(
  quality: ConnectionQuality,
  isOnline: boolean,
  connectionType?: string,
  wasOffline?: boolean,
  t?: (key: string, params?: any) => string
): { title: string; subtitle?: string } {
  if (!t) {
    // Fallback for when t is not provided
    if (!isOnline || quality === 'offline') {
      return {
        title: 'You are offline',
        subtitle: 'Please check your internet connection',
      }
    }
    return { title: 'Connected', subtitle: 'Internet connection established' }
  }

  if (!isOnline || quality === 'offline') {
    return {
      title: t('offlineTitle'),
      subtitle: t('offlineSubtitle'),
    }
  }

  if (wasOffline) {
    return {
      title: t('onlineTitle'),
      subtitle: connectionType ? `${t('connectionType')} ${connectionType}` : t('onlineSubtitle'),
    }
  }

  if (quality === 'poor') {
    return {
      title: t('poorConnectionTitle'),
      subtitle: t('poorConnectionSubtitle'),
    }
  }

  if (quality === 'fair') {
    return {
      title: t('fairConnectionTitle'),
      subtitle: t('fairConnectionSubtitle'),
    }
  }

  return {
    title: t('onlineTitle'),
    subtitle: `${t('connectionQuality')} ${getQualityText(quality)}`,
  }
}

/**
 * Offline Banner Component
 */
export function OfflineBanner({
  onReconnect,
  showPoorConnectionWarning = true,
  autoHideOnReconnect = true,
  autoHideDelay = 3000,
  className = '',
}: OfflineBannerProps) {
  const t = useTranslations('Notifications')
  const tCommon = useTranslations('Common')
  const { isOnline, quality, connectionType } = useNetworkStatus()
  const [isVisible, setIsVisible] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false) // Track manual dismissal

  // Track when user goes offline/online
  useEffect(() => {
    // Just went offline
    if (!isOnline && !wasOffline) {
      setWasOffline(true)
      setIsVisible(true)
      setIsClosing(false)
      setIsDismissed(false) // Reset dismissal when going offline
    }

    // Just came back online
    if (isOnline && wasOffline) {
      // Trigger refetch callback
      if (onReconnect) {
        onReconnect()
      }

      // Auto-hide after delay
      if (autoHideOnReconnect) {
        setTimeout(() => {
          handleClose()
        }, autoHideDelay)
      }

      setWasOffline(false)
      setIsDismissed(false) // Reset dismissal when coming back online
    }
  }, [isOnline, wasOffline, onReconnect, autoHideOnReconnect, autoHideDelay])

  // Show/hide based on connection quality
  useEffect(() => {
    // Don't show if user manually dismissed it
    if (isDismissed) {
      return
    }

    if (!isOnline) {
      setIsVisible(true)
      setIsClosing(false)
      return
    }

    if (showPoorConnectionWarning && (quality === 'poor' || quality === 'fair')) {
      setIsVisible(true)
      setIsClosing(false)

      // Auto-close 'fair' quality warning after 4 seconds
      if (quality === 'fair') {
        const timer = setTimeout(() => {
          handleClose()
        }, 4000)
        return () => clearTimeout(timer)
      }
      return
    }

    // Hide if connection is good and was not offline
    if (!wasOffline && quality !== 'poor' && quality !== 'fair') {
      if (isVisible) {
        handleClose()
      }
    }
  }, [isOnline, quality, showPoorConnectionWarning, wasOffline, isVisible, isDismissed])

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true)
    setIsDismissed(true) // Mark as dismissed by user
    setTimeout(() => {
      setIsVisible(false)
      setIsClosing(false)
    }, 300) // Match animation duration
  }

  // Don't render if not visible
  if (!isVisible) return null

  const style = getBannerStyle(quality)
  const message = getBannerMessage(quality, isOnline, getConnectionTypeText(connectionType), wasOffline, t)

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`${style.bg} ${style.text} shadow-md border-b ${style.border} transition-apple ${
          isClosing ? 'transform -translate-y-full opacity-0' : 'transform translate-y-0 opacity-100 animate-slide-down'
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3" >
          <div className="flex items-center justify-between gap-4">
            {/* Icon and Message */}
            <div className="flex items-center gap-3 flex-1">
              {/* Icon */}
              <div className="text-xl flex-shrink-0" aria-hidden="true">
                {style.icon}
              </div>

              {/* Message */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base">
                  {message.title}
                </p>
                {message.subtitle && (
                  <p className="text-xs sm:text-sm opacity-75 mt-0.5">
                    {message.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Close Button */}
            {(isOnline || quality !== 'offline') && (
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-apple-fast active-scale-apple focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2"
                aria-label={tCommon('close')}
                type="button"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Minimal Offline Indicator (for bottom-right corner)
 */
export function OfflineIndicator() {
  const t = useTranslations('Notifications')
  const { isOnline, quality } = useNetworkStatus()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(!isOnline || quality === 'poor')
  }, [isOnline, quality])

  if (!isVisible) return null

  const style = getBannerStyle(quality)

  return (
    <div
      className="fixed bottom-4 right-4 z-40 animate-pulse"
      role="status"
      aria-label={isOnline ? t('weakConnection') : t('offlineIndicator')}
    >
      <div
        className={`${style.bg} ${style.text} rounded-full shadow-lg px-4 py-2 flex items-center gap-2 text-sm font-medium`}
      >
        <span className="text-lg" aria-hidden="true">
          {style.icon}
        </span>
        <span>{isOnline ? t('weakConnection') : t('offlineIndicator')}</span>
      </div>
    </div>
  )
}

/**
 * Connection Quality Badge (for inline display)
 */
export function ConnectionQualityBadge({ showWhenGood = false }: { showWhenGood?: boolean }) {
  const { quality, connectionType, effectiveBandwidth, rtt } = useNetworkStatus()

  // Hide when connection is good and showWhenGood is false
  if (!showWhenGood && (quality === 'excellent' || quality === 'good')) {
    return null
  }

  const style = getBannerStyle(quality)

  return (
    <div
      className={`inline-flex items-center gap-2 ${style.bg} ${style.text} rounded-full px-3 py-1 text-xs font-medium`}
      title={`کیفیت: ${getQualityText(quality)}${
        connectionType ? ` - نوع: ${getConnectionTypeText(connectionType)}` : ''
      }${effectiveBandwidth ? ` - سرعت: ${effectiveBandwidth.toFixed(1)} Mbps` : ''}${
        rtt ? ` - RTT: ${rtt}ms` : ''
      }`}
    >
      <span aria-hidden="true">{style.icon}</span>
      <span>{getQualityText(quality)}</span>
      {connectionType && (
        <span className="opacity-75">({getConnectionTypeText(connectionType)})</span>
      )}
    </div>
  )
}

export default OfflineBanner
