interface GlobalErrorDisplayProps {
  onRetry: () => void
}

export const GlobalErrorDisplay = ({ onRetry }: GlobalErrorDisplayProps) => {
  return (
    <div
      className="bg-error-bg border border-error-text/30 dark:border-error-text/50 rounded-[var(--radius-lg)] p-6 mb-6 animate-fade-in"
      dir="rtl"
    >
      <div className="text-center">
        <h3 className="text-lg font-semibold text-error-text mb-2">
          خطا در دریافت اطلاعات
        </h3>
        <p className="text-error-text mb-4">
          امکان دریافت اطلاعات از سرور وجود ندارد. لطفاً دوباره تلاش کنید.
        </p>
        <button
          onClick={onRetry}
          className="bg-red-600 dark:bg-red-700 text-white rounded px-6 py-2 hover:bg-red-700 dark:hover:bg-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
        >
          تلاش مجدد
        </button>
      </div>
    </div>
  )
}
