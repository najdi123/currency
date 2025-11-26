'use client'

import { lazy, Suspense, memo } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { SelectedChartItem } from '@/types/chart'

// Lazy load chart component to reduce initial bundle size
const ChartBottomSheet = lazy<
  React.ComponentType<{
    isOpen: boolean
    onClose: () => void
    item: SelectedChartItem | null
  }>
>(() =>
  import(
    /* webpackChunkName: "chart-bottom-sheet" */
    /* webpackPrefetch: true */
    '@/components/ChartBottomSheet'
  ).then((mod) => ({ default: mod.ChartBottomSheet }))
)

interface ChartLayerWithBoundaryProps {
  /** Whether the chart is open */
  isOpen: boolean
  /** Callback to close the chart */
  onClose: () => void
  /** The selected item to display */
  selectedItem: SelectedChartItem | null
  /** Translation function for Chart namespace */
  t2: (key: string) => string
}

/**
 * Chart layer component with ErrorBoundary and Suspense for lazy loading.
 * Only renders the loading/error states when the chart is open.
 */
function ChartLayerWithBoundaryComponent({
  isOpen,
  onClose,
  selectedItem,
  t2,
}: ChartLayerWithBoundaryProps) {
  return (
    <ErrorBoundary
      boundaryName="ChartLazyLoad"
      fallback={(_error, reset) =>
        // Only show error UI if chart is open
        isOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          >
            <div
              className="bg-surface rounded-lg p-6 shadow-xl max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="mb-4 text-red-500 text-5xl" aria-hidden="true">
                  Warning
                </div>
                <h3 className="text-lg font-semibold text-error-text mb-2">
                  {t2('loadError')}
                </h3>
                <p className="text-text-secondary mb-4 text-sm">
                  {t2('loadErrorMessage')}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      reset()
                      window.location.reload()
                    }}
                    className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {t2('retry')}
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-gray-200 dark:bg-gray-700 text-text-primary px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    {t2('close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null
      }
    >
      <Suspense
        fallback={
          // Only show loading UI if chart is open
          isOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-surface rounded-lg p-6 shadow-xl">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <p className="text-text-primary text-sm">{t2('loading')}</p>
                </div>
              </div>
            </div>
          ) : null
        }
      >
        <ChartBottomSheet isOpen={isOpen} onClose={onClose} item={selectedItem} />
      </Suspense>
    </ErrorBoundary>
  )
}

export const ChartLayerWithBoundary = memo(ChartLayerWithBoundaryComponent)
