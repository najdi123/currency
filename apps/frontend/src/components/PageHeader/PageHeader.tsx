'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { SettingsModal } from '@/components/SettingsModal'
import { HiRefresh, HiViewList } from 'react-icons/hi'
import { FiClock, FiGrid, FiSettings } from 'react-icons/fi'
import type { ViewMode } from '@/lib/hooks/useViewModePreference'

interface PageHeaderProps {
  mobileViewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onRefresh: () => void
  isRefreshing: boolean
  isFetching: boolean
  lastUpdated: Date | null
  isLoading: boolean
}

export const PageHeader = ({
  mobileViewMode,
  onViewModeChange,
  onRefresh,
  isRefreshing,
  isFetching,
  lastUpdated,
  isLoading,
}: PageHeaderProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const t = useTranslations('PageHeader')

  const toggleViewMode = () => {
    onViewModeChange(mobileViewMode === 'single' ? 'dual' : 'single')
  }

  return (
    <>
      <div className="bg-bg-elevated border-b border-border-light shadow-sm text-center py-8 sm:py-10 lg:py-12 px-4 sm:px-6 lg:px-8 sm:mb-10 lg:mb-12">
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
                  ? t('viewMode.switchToDual')
                  : t('viewMode.switchToSingle')
              }
              title={mobileViewMode === 'single' ? t('viewMode.dual') : t('viewMode.single')}
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
            disabled={isRefreshing || isFetching}
            aria-label={isRefreshing ? t('refresh.updating') : t('refresh.update')}
            aria-busy={isRefreshing || isFetching}
          >
            <HiRefresh
              className={`text-xl ${isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isRefreshing ? t('refresh.updating') : isFetching ? t('refresh.fetching') : t('refresh.update')}
          </Button>
          <div className="flex items-center gap-2 text-apple-caption text-text-secondary">
            <span className="relative flex h-3 w-3" aria-hidden="true">
              {isFetching ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                </>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                </>
              )}
            </span>
            <FiClock className="text-base" aria-hidden="true" />
            <p aria-live="polite">
              {t('lastUpdate')}:{' '}
              {lastUpdated ? (
                <time dateTime={lastUpdated.toISOString()}>
                  {lastUpdated.toLocaleTimeString('fa-IR')}
                </time>
              ) : (
                '--:--:--'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
