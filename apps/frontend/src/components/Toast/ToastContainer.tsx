'use client'

import { Toast, ToastProps } from './Toast'

interface ToastContainerProps {
  toasts: Omit<ToastProps, 'onClose'>[]
  onClose: (id: string) => void
  position?: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'
}

/**
 * ToastContainer - Manages and displays multiple toast notifications
 *
 * Features:
 * - Stacks multiple toasts vertically
 * - Handles z-index layering
 * - Auto-positions based on configuration
 * - Smooth entrance/exit animations
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onClose,
  position = 'top-right',
}) => {
  if (toasts.length === 0) return null

  return (
    <div
      className={`fixed z-50 flex flex-col gap-3 ${
        position.includes('top') ? 'top-20' : 'bottom-4'
      } ${
        position.includes('right')
          ? 'right-4'
          : position.includes('center')
          ? 'left-1/2 -translate-x-1/2'
          : 'left-4'
      }`}
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            zIndex: 1000 + toasts.length - index,
            animation: `slideInRight 0.3s ease-out`,
          }}
        >
          <Toast {...toast} onClose={onClose} position={position} />
        </div>
      ))}
    </div>
  )
}
