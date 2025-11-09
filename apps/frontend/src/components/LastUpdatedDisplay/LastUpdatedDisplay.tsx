'use client'

import { useTranslations } from 'next-intl'
import { FiClock } from 'react-icons/fi'

interface LastUpdatedDisplayProps {
  lastUpdated: Date | null
  isFetching: boolean
}

export const LastUpdatedDisplay = ({
  lastUpdated,
  isFetching,
}: LastUpdatedDisplayProps) => {
  const t = useTranslations('PageHeader')

  return (
    <div className="flex items-center gap-3 text-text-secondary">
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
      <FiClock className="text-base flex-shrink-0 mt-1" aria-hidden="true" />
      <div className="flex flex-col items-start gap-0.5" aria-live="polite">
        <div className="text-apple-footnote text-text-tertiary">
          {t('lastUpdated')}
        </div>
        {lastUpdated ? (
          <div className="flex items-center gap-3">
            <time
              dateTime={lastUpdated.toISOString()}
              className="text-xl sm:text-2xl font-semibold text-text-primary tabular-nums"
            >
              {new Intl.DateTimeFormat('fa-IR', {
                timeZone: 'Asia/Tehran',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }).format(lastUpdated)}
            </time>
            <div className="flex flex-col gap-0.5 text-apple-caption text-text-tertiary">
              <div>
                {new Intl.DateTimeFormat('fa-IR', {
                  timeZone: 'Asia/Tehran',
                  calendar: 'persian',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }).format(lastUpdated)}
              </div>
              <div>
                {new Intl.DateTimeFormat('en-US', {
                  timeZone: 'Asia/Tehran',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                }).format(lastUpdated)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xl sm:text-2xl font-semibold text-text-primary">
            --:--
          </div>
        )}
      </div>
    </div>
  )
}
