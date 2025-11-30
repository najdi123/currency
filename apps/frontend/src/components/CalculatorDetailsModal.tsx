'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Drawer } from 'vaul'
import { Button } from '@/components/ui/Button'
import { formatToman } from '@/lib/utils/formatters'
import { HiX, HiTrash, HiCalendar, HiClock } from 'react-icons/hi'
import type { CalculatorItem } from '@/lib/store/slices/calculatorSlice'

interface CalculatorDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  items: CalculatorItem[]
  totalValue: number
  currentDate?: string
  onRemoveItem: (id: string) => void
  onClearAll: () => void
}

export const CalculatorDetailsModal: React.FC<CalculatorDetailsModalProps> = ({
  isOpen,
  onClose,
  items,
  totalValue,
  currentDate,
  onRemoveItem,
  onClearAll,
}) => {
  const t = useTranslations('Calculator')
  const tCommon = useTranslations('Common')

  // Format date and time
  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tehran',
      timeZoneName: 'short',
    })
  }

  const isToday = !currentDate || currentDate === new Date().toISOString().split('T')[0]

  // Bottom nav height is approximately 80px on mobile, 70px on desktop
  // We'll position the drawer above it
  const bottomNavHeight = 130 // px

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <Drawer.Content
          className="fixed left-0 right-0 z-40 flex flex-col bg-surface rounded-t-[20px] shadow-xl"
          style={{
            bottom: `${bottomNavHeight}px`,
            maxHeight: `calc(90vh - ${bottomNavHeight}px)`
          }}
        >
          {/* Drag Handle */}
          <div className="flex justify-center py-3">
            <div className="w-12 h-1.5 bg-border-light rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-4 border-b border-border-light">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text-primary">{t('calculationDetails')}</h2>

              {/* Date and Time Info */}
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <HiCalendar className="w-4 h-4" />
                  <span>
                    {isToday ? t('today') : formatDate(currentDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <HiClock className="w-4 h-4" />
                  <span>{formatTime()}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
              aria-label={tCommon('close')}
            >
              <HiX className="w-6 h-6 text-text-secondary" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-secondary">{t('noItems')}</p>
                <p className="text-sm text-text-tertiary mt-2">{t('addItemsPrompt')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg border border-border-light"
                  >
                    <div className="flex-1 min-w-0">
                      <div>
                        <h3 className="font-medium text-text-primary truncate">
                          {item.variantName || item.name}
                        </h3>
                        {item.variantName && (
                          <p className="text-xs text-text-tertiary mt-0.5 truncate">
                            {item.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
                        <span>
                          {item.quantity} {item.type === 'gold' ? t('grams') : t('piece')}
                        </span>
                        <span>×</span>
                        <span>{formatToman(item.unitPrice)} {t('toman')}</span>
                      </div>
                      <p className="text-sm font-semibold text-accent mt-1">
                        = {formatToman(item.totalValue)} {t('toman')}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-3"
                      aria-label={t('removeItem')}
                    >
                      <HiTrash className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Total and Actions */}
          <div className="border-t border-border-light px-6 py-4 bg-bg-elevated pb-14">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-text-secondary">{t('total')}</p>
                <p className="text-2xl font-bold text-text-primary">
                  {formatToman(totalValue)} {t('toman')}
                </p>
              </div>
              {items.length > 0 && (
                <Button
                  variant="tinted"
                  size="md"
                  onClick={onClearAll}
                  className="text-red-600 dark:text-red-400"
                >
                  <HiTrash className="w-4 h-4" />
                  {t('clearAll')}
                </Button>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
