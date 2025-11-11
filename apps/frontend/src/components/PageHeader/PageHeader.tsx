'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { SettingsModal } from '@/components/SettingsModal'
import { LastUpdatedDisplay } from '@/components/LastUpdatedDisplay'
import { HiRefresh, HiViewList } from 'react-icons/hi'
import { FiGrid, FiSettings } from 'react-icons/fi'
import type { ViewMode } from '@/lib/hooks/useViewModePreference'
import type { HistoricalNavigationState } from '@/hooks/useHistoricalNavigation'

interface PageHeaderProps {
  mobileViewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onRefresh: () => void
  isRefreshing: boolean
  isFetching: boolean
  lastUpdated: Date | null
  isLoading: boolean
  historicalNav: HistoricalNavigationState
}

export const PageHeader = ({
  mobileViewMode,
  onViewModeChange,
  onRefresh,
  isRefreshing,
  isFetching,
  lastUpdated,
  isLoading,
  historicalNav,
}: PageHeaderProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const t = useTranslations('PageHeader')
  const tHistorical = useTranslations('Historical')

  const toggleViewMode = () => {
    onViewModeChange(mobileViewMode === 'single' ? 'dual' : 'single')
  }

  return (
    <>
      <div className="bg-bg-elevated border-b border-border-light shadow-sm text-center py-8 sm:py-10 lg:py-12 px-4 sm:px-6 lg:px-8 mb-3 sm:mb-10 lg:mb-12">
        <div className="flex items-center justify-center gap-4 mb-6" >
          <h1 className="text-apple-large-title text-text-primary">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2">
            {/* Mobile View Toggle - Only visible on mobile */}
            <button
              onClick={toggleViewMode}
              disabled={isLoading}
              className="md:hidden p-2 rounded-lg bg-bg-elevated hover:bg-bg-secondary border border-border-light transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={
                mobileViewMode === 'single'
                  ? t('viewModeSingle')
                  : t('viewModeDual')
              }
              title={mobileViewMode === 'single' ? t('viewModeSingleTitle') : t('viewModeDualTitle')}
            >
              {mobileViewMode === 'single' ? (
                <HiViewList className="w-5 h-5 text-text-primary" />
              ) : (
                <FiGrid className="w-5 h-5 text-text-primary" />
              )}
            </button>
            {/* Settings Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg bg-bg-elevated hover:bg-bg-secondary border border-border-light transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900 active-scale-apple"
              aria-label={t('settings')}
              title={t('settings')}
            >
              <FiSettings className="w-5 h-5 text-text-primary" />
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4" >
          <Button
            variant="filled"
            size="lg"
            onClick={onRefresh}
            disabled={isRefreshing || isFetching || !historicalNav.isToday}
            aria-label={isRefreshing ? t('refreshing') : t('refreshButton')}
            aria-busy={isRefreshing || isFetching}
            title={!historicalNav.isToday ? 'Switch to today to refresh data' : undefined}
          >
            <HiRefresh
              className={`text-xl ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isRefreshing ? t('refreshing') : isFetching ? t('fetching') : t('refreshButton')}
          </Button>
          <LastUpdatedDisplay
            lastUpdated={lastUpdated}
            isFetching={isFetching}
            historicalNav={historicalNav}
          />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
