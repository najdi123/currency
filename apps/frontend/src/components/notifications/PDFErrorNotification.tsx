'use client'

import { memo } from 'react'

interface PDFErrorNotificationProps {
  /** Error message to display */
  error: string
  /** Callback when user dismisses the error */
  onDismiss: () => void
}

/**
 * Error notification toast for PDF generation failures.
 * Displays at the bottom of the screen with an error icon and dismiss button.
 */
function PDFErrorNotificationComponent({ error, onDismiss }: PDFErrorNotificationProps) {
  return (
    <div
      className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-slide-up"
      role="alert"
      aria-live="assertive"
    >
      <svg
        className="h-5 w-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{error}</span>
      <button
        onClick={onDismiss}
        className="ml-2 hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-500 rounded"
        aria-label="Close error"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}

export const PDFErrorNotification = memo(PDFErrorNotificationComponent)
