import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi'

interface SuccessNotificationProps {
  show: boolean
  isStaleData?: boolean
  staleDataTime?: Date | null
}

export const SuccessNotification = ({ show, isStaleData = false, staleDataTime }: SuccessNotificationProps) => {
  if (!show) return null

  // Format the stale data timestamp
  const formatStaleTime = (date: Date | null | undefined) => {
    if (!date) return ''

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays} روز پیش`
    } else if (diffHours > 0) {
      return `${diffHours} ساعت پیش`
    } else if (diffMins > 0) {
      return `${diffMins} دقیقه پیش`
    } else {
      return 'لحظاتی پیش'
    }
  }

  if (isStaleData) {
    // Stale data notification - warning style
    return (
      <div
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50
          bg-yellow-100 dark:bg-yellow-900/30
          border border-yellow-300 dark:border-yellow-700
          text-yellow-800 dark:text-yellow-200
          px-4 py-3 rounded-lg shadow-lg
          flex items-center gap-2
          animate-success-in max-w-md"
        role="status"
        aria-live="polite"
        
      >
        <FiAlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
        <div className="text-sm">
          <div className="font-medium">آخرین داده‌های موجود</div>
          <div className="text-xs mt-0.5 opacity-90">
            به‌روزرسانی: {formatStaleTime(staleDataTime)}
          </div>
        </div>
      </div>
    )
  }

  // Fresh data notification - success style
  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50
        bg-green-100 dark:bg-green-900/30
        border border-green-300 dark:border-green-700
        text-green-800 dark:text-green-200
        px-4 py-3 rounded-lg shadow-lg
        flex items-center gap-2
        animate-success-in"
      role="status"
      aria-live="polite"
      
    >
      <FiCheckCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium">داده‌ها با موفقیت به‌روز شد</span>
    </div>
  )
}
