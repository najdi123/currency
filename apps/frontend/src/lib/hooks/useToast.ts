import { useState, useCallback } from 'react'
import type { ToastType } from '@/components/Toast/Toast'

export interface ToastData {
  id: string
  type: ToastType
  message: string
  description?: string
  duration?: number
}

let toastIdCounter = 0

/**
 * useToast - Hook for managing toast notifications
 *
 * Features:
 * - Add toasts with auto-generated IDs
 * - Remove toasts by ID
 * - Clear all toasts
 * - Helper methods for each toast type
 *
 * Usage:
 * ```tsx
 * const { toasts, addToast, removeToast, success, error, warning, info } = useToast()
 *
 * // Show success toast
 * success('Data saved successfully!')
 *
 * // Show error toast with description
 * error('Failed to load data', 'Please check your connection and try again')
 *
 * // Custom toast
 * addToast({
 *   type: 'info',
 *   message: 'New version available',
 *   duration: 10000,
 * })
 * ```
 */
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback(
    (toast: Omit<ToastData, 'id'>) => {
      const id = `toast-${Date.now()}-${toastIdCounter++}`
      const newToast: ToastData = {
        id,
        duration: 5000, // Default duration
        ...toast,
      }

      setToasts((prev) => [...prev, newToast])

      return id
    },
    []
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  // Helper methods for common toast types
  const success = useCallback(
    (message: string, description?: string, duration?: number) => {
      return addToast({ type: 'success', message, description, duration })
    },
    [addToast]
  )

  const error = useCallback(
    (message: string, description?: string, duration?: number) => {
      return addToast({ type: 'error', message, description, duration: duration ?? 7000 }) // Errors stay longer
    },
    [addToast]
  )

  const warning = useCallback(
    (message: string, description?: string, duration?: number) => {
      return addToast({ type: 'warning', message, description, duration })
    },
    [addToast]
  )

  const info = useCallback(
    (message: string, description?: string, duration?: number) => {
      return addToast({ type: 'info', message, description, duration })
    },
    [addToast]
  )

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  }
}
