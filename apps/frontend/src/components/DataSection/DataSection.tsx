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
  const isHistorical = metadata?.isHistorical
  const dataSource = metadata?.source

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
            {isHistorical && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Historical
              </span>
            )}
          </h2>

          {/* Data Freshness Indicator */}
          {lastUpdated && data && !isLoading && !error && (
            <DataFreshnessIndicator
              lastUpdated={lastUpdated}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              dataSource={dataSource}
              isHistorical={isHistorical}
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
          <div className="relative">
            {/* Loading overlay for data transitions (e.g., today ↔ yesterday) */}
            {isRefreshing && (
              <div
                className="absolute inset-0 bg-background-base/40 dark:bg-background-base/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-lg transition-opacity duration-200"
                role="status"
                aria-live="polite"
                aria-label={t('loadingNewData')}
              >
                <div className="bg-surface/90 dark:bg-surface/80 backdrop-blur-md rounded-xl px-5 py-3 shadow-lg border border-border-light flex items-center gap-3">
                  <svg
                    className="animate-spin h-5 w-5 text-accent"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-text-primary">
                    {t('loadingText')}
                  </span>
                </div>
              </div>
            )}

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
          </div>
        )}
      </div>
    </section>
  )
}
