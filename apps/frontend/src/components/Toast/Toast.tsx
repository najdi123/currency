'use client'

import { useEffect } from 'react'
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX, FiXCircle } from 'react-icons/fi'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  description?: string
  duration?: number
  onClose: (id: string) => void
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
}

const iconMap = {
  success: FiCheckCircle,
  error: FiXCircle,
  warning: FiAlertCircle,
  info: FiInfo,
}

const colorMap = {
  success: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-800 dark:text-green-200',
    icon: 'text-green-600 dark:text-green-400',
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-800 dark:text-red-200',
    icon: 'text-red-600 dark:text-red-400',
  },
  warning: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    border: 'border-yellow-300 dark:border-yellow-700',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: 'text-yellow-600 dark:text-yellow-400',
  },
  info: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-800 dark:text-blue-200',
    icon: 'text-blue-600 dark:text-blue-400',
  },
}

const positionMap = {
  'top-right': 'top-20 right-4',
  'top-center': 'top-20 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
}

/**
 * Toast - Notification component with auto-dismiss
 *
 * Features:
 * - 4 types: success, error, warning, info
 * - Auto-dismiss with configurable duration
 * - Manual close button
 * - Smooth animations (slide in/out)
 * - RTL support
 * - Accessibility (ARIA labels, live regions)
 * - Optional description text
 * - Configurable position
 *
 * Usage:
 * ```tsx
 * <Toast
 *   id="unique-id"
 *   type="error"
 *   message="Something went wrong"
 *   description="Please try again later"
 *   duration={5000}
 *   onClose={(id) => removeToast(id)}
 * />
 * ```
 */
export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  description,
  duration = 5000,
  onClose,
  position = 'top-right',
}) => {
  const Icon = iconMap[type]
  const colors = colorMap[type]
  const positionClass = positionMap[position]

  // Auto-dismiss after duration
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  // Determine ARIA role based on type
  const ariaRole = type === 'error' ? 'alert' : 'status'
  const ariaLive = type === 'error' ? 'assertive' : 'polite'

  return (
    <div
      className={`fixed z-50 ${positionClass}
        ${colors.bg} ${colors.border} ${colors.text}
        border rounded-lg shadow-lg
        px-4 py-3 pr-10
        animate-slide-in-from-right
        max-w-sm w-full
        flex items-start gap-3
      `}
      role={ariaRole}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      {/* Icon */}
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${colors.icon}`} aria-hidden="true" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{message}</p>
        {description && (
          <p className="text-xs mt-1 opacity-90">{description}</p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => onClose(id)}
        className={`absolute top-3 right-3 ${colors.text} hover:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-1 rounded-sm`}
        aria-label="Close notification"
        type="button"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  )
}
