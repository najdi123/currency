import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { ItemCardGrid } from '@/components/ItemCardGrid'
import { ItemCardSkeleton } from '@/components/ItemCardSkeleton'
import type { IconType } from 'react-icons'
import type { ViewMode } from '@/lib/hooks/useViewModePreference'
import type { ItemType } from '@/types/chart'
import type { DataItem } from '@/lib/utils/dataItemHelpers'

interface DataSectionProps {
  title: string
  headingId: string
  icon: IconType
  items: DataItem[]
  data: any
  isLoading: boolean
  error: any
  itemType: ItemType
  accentColor: 'blue' | 'purple' | 'gold'
  viewMode: ViewMode
  onItemClick: (key: string) => void
  onRetry: () => void
  errorTitle: string
  boundaryName: string
}

export const DataSection = ({
  title,
  headingId,
  icon: Icon,
  items,
  data,
  isLoading,
  error,
  itemType,
  accentColor,
  viewMode,
  onItemClick,
  onRetry,
  errorTitle,
  boundaryName,
}: DataSectionProps) => {
  const skeletonCount = items.length

  return (
    <section
      className=" overflow-hidden mb-0"
      dir="rtl"
      lang="fa"
      aria-labelledby={headingId}
    >
      <div className=" pt-5">
        <h2
          id={headingId}
          className="text-apple-title text-text-primary text-center flex items-center justify-center gap-2"
        >
          <Icon className="text-2xl text-accent" aria-hidden="true" />
          {title}
        </h2>
      </div>
      <div className="py-6">
        {isLoading && !data && <ItemCardSkeleton count={skeletonCount} />}

        {error && !data && (
          <ErrorDisplay error={error} onRetry={onRetry} title={errorTitle} />
        )}

        {data && (
          <ErrorBoundary
            boundaryName={boundaryName}
            fallback={(_error, reset) => (
              <div
                className="p-4 text-center text-text-secondary"
                dir="rtl"
                role="alert"
                aria-live="assertive"
              >
                <p className="mb-2">خطا در نمایش اطلاعات {title}.</p>
                <button
                  onClick={reset}
                  className={`${
                    accentColor === 'blue'
                      ? 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800'
                      : accentColor === 'purple'
                      ? 'bg-purple-600 dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-800'
                      : 'bg-gold-400 dark:bg-gold-700 hover:bg-gold-700 dark:hover:bg-gold-800'
                  } text-white px-4 py-2 rounded transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${accentColor}-400`}
                >
                  تلاش مجدد
                </button>
              </div>
            )}
          >
            <ItemCardGrid
              items={items}
              data={data}
              itemType={itemType}
              accentColor={accentColor}
              viewMode={viewMode}
              onItemClick={onItemClick}
            />
          </ErrorBoundary>
        )}
      </div>
    </section>
  )
}
