'use client'

import { useTranslations } from 'next-intl'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { ItemCardGrid } from '@/components/ItemCardGrid'
import { ItemCardSkeleton } from '@/components/ItemCardSkeleton'
import { DataFreshnessIndicator } from '@/components/DataFreshnessIndicator'
import { ExpandableSection } from '@/components/ExpandableSection'
import { splitItemsByVisibility } from '@/lib/utils/dataItemHelpers'
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
  isRefreshing?: boolean
  category: 'currencies' | 'crypto' | 'gold'
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
  isRefreshing = false,
  category,
}: DataSectionProps) => {
  const t = useTranslations('DataSection')
  const skeletonCount = items.length

  // Split items into main and additional for show more functionality
  const { main: mainItems, additional: additionalItems } = splitItemsByVisibility(category, items)

  // Extract metadata if available
  const metadata = data?._metadata
  const lastUpdated = metadata?.lastUpdated

  // Wrap onRetry to return a Promise
  const handleRefresh = async () => {
    await onRetry()
  }

  return (
    <section
      className=" overflow-hidden mb-0"
      aria-labelledby={headingId}
    >
      <div className=" pt-5">
        <div className="flex flex-col items-center gap-2">
          <h2
            id={headingId}
            className="text-apple-title text-text-primary text-center flex items-center justify-center gap-2"
          >
            <Icon className="text-2xl text-accent" aria-hidden="true" />
            {title}
          </h2>

          {/* Data Freshness Indicator */}
          {lastUpdated && data && !isLoading && !error && (
            <DataFreshnessIndicator
              lastUpdated={lastUpdated}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          )}
        </div>
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
                role="alert"
                aria-live="assertive"
              >
                <p className="mb-2">{t('errorDisplay', { title: title })}</p>
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
                  {t('retryButton')}
                </button>
              </div>
            )}
          >
            <ExpandableSection
              mainContent={
                <ItemCardGrid
                  items={mainItems}
                  data={data}
                  itemType={itemType}
                  accentColor={accentColor}
                  viewMode={viewMode}
                  onItemClick={onItemClick}
                />
              }
              additionalContent={
                <ItemCardGrid
                  items={additionalItems}
                  data={data}
                  itemType={itemType}
                  accentColor={accentColor}
                  viewMode={viewMode}
                  onItemClick={onItemClick}
                />
              }
              additionalItemCount={additionalItems.length}
            />
          </ErrorBoundary>
        )}
      </div>
    </section>
  )
}
