'use client'

import { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react'
import {
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
} from '@/lib/store/services/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { ItemCardGrid } from '@/components/ItemCardGrid'
import { ItemCardSkeleton } from '@/components/ItemCardSkeleton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { useChartBottomSheet } from '@/lib/hooks/useChartBottomSheet'
import { mapItemCodeToApi } from '@/lib/utils/chartUtils'
import type { ItemType, SelectedChartItem } from '@/types/chart'
import { FaDollarSign, FaEuroSign, FaPoundSign, FaBitcoin, FaEthereum } from 'react-icons/fa'
import { SiTether } from 'react-icons/si'
import { GiGoldBar, GiTwoCoins } from 'react-icons/gi'
import { FiClock, FiInfo } from 'react-icons/fi'
import { HiRefresh } from 'react-icons/hi'

// Lazy load chart component to reduce initial bundle size
const ChartBottomSheet = lazy<React.ComponentType<{
  isOpen: boolean
  onClose: () => void
  item: SelectedChartItem | null
}>>(() =>
  import(
    /* webpackChunkName: "chart-bottom-sheet" */
    /* webpackPrefetch: true */
    '@/components/ChartBottomSheet'
  ).then(mod => ({ default: mod.ChartBottomSheet }))
)

// Currency items to display
const currencyItems = [
  { key: 'usd_sell', name: 'دلار آمریکا', icon: FaDollarSign, color: 'text-blue-600' },
  { key: 'eur', name: 'یورو', icon: FaEuroSign, color: 'text-blue-600' },
  { key: 'gbp', name: 'پوند انگلیس', icon: FaPoundSign, color: 'text-blue-600' },
  { key: 'cad', name: 'دلار کانادا', icon: FaDollarSign, color: 'text-blue-600' },
  { key: 'aud', name: 'دلار استرالیا', icon: FaDollarSign, color: 'text-blue-600' },
]

const cryptoItems = [
  { key: 'usdt', name: 'تتر', icon: SiTether, color: 'text-purple-600' },
  { key: 'btc', name: 'بیت کوین', icon: FaBitcoin, color: 'text-purple-600' },
  { key: 'eth', name: 'اتریوم', icon: FaEthereum, color: 'text-purple-600' },
]

const goldItems = [
  { key: 'sekkeh', name: 'سکه امامی', icon: GiTwoCoins, color: 'text-gold-400' },
  { key: 'bahar', name: 'بهار آزادی', icon: GiTwoCoins, color: 'text-gold-400' },
  { key: 'nim', name: 'نیم سکه', icon: GiTwoCoins, color: 'text-gold-400' },
  { key: 'rob', name: 'ربع سکه', icon: GiTwoCoins, color: 'text-gold-400' },
  { key: 'gerami', name: 'سکه گرمی', icon: GiTwoCoins, color: 'text-gold-400' },
  { key: '18ayar', name: 'طلای 18 عیار', icon: GiGoldBar, color: 'text-gold-400' },
]

export default function Home() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const chartSheet = useChartBottomSheet()

  const {
    data: currencies,
    isLoading: currenciesLoading,
    isFetching: currenciesFetching,
    error: currenciesError,
    refetch: refetchCurrencies,
  } = useGetCurrenciesQuery(undefined, {
    pollingInterval: 300000, // 5 minutes
  })
  const {
    data: crypto,
    isLoading: cryptoLoading,
    isFetching: cryptoFetching,
    error: cryptoError,
    refetch: refetchCrypto,
  } = useGetCryptoQuery(undefined, {
    pollingInterval: 300000, // 5 minutes
  })
  const {
    data: gold,
    isLoading: goldLoading,
    isFetching: goldFetching,
    error: goldError,
    refetch: refetchGold,
  } = useGetGoldQuery(undefined, {
    pollingInterval: 300000, // 5 minutes
  })

  // Preload chart component when user scrolls near item cards
  const hasPreloadedChart = useRef(false)

  useEffect(() => {
    // Only preload once
    if (hasPreloadedChart.current) return

    // SSR guard - only run in browser
    if (typeof window === 'undefined') return

    // Use requestAnimationFrame to ensure DOM is painted
    const rafId = requestAnimationFrame(() => {
      // Query for item cards
      const cards = document.querySelectorAll('[role="listitem"]')

      // If no cards found, DOM might not be ready yet - skip preload
      // Chart will load on demand when user clicks
      if (cards.length === 0) {
        console.debug('Chart preload: No item cards found, skipping preload')
        return
      }

      // Create intersection observer to detect when cards enter viewport
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some(entry => entry.isIntersecting)) {
            // Preload the chart component
            import('@/components/ChartBottomSheet')
              .then(() => {
                hasPreloadedChart.current = true
                console.debug('Chart preloaded successfully')
              })
              .catch((err) => {
                // Don't set hasPreloadedChart on error, allow retry on click
                console.warn('Chart preload failed (will load on demand):', err)
              })
            observer.disconnect()
          }
        },
        {
          rootMargin: '100px', // Start loading 100px before visible
          threshold: 0.1
        }
      )

      // Observe all item cards
      cards.forEach(card => observer.observe(card))
    })

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, []) // Empty deps - run once after mount

  // Update timestamp when data is successfully fetched
  useEffect(() => {
    if (!currenciesError && !cryptoError && !goldError && (currencies || crypto || gold)) {
      setLastUpdated(new Date())
    }
  }, [currencies, crypto, gold, currenciesError, cryptoError, goldError])

  const handleRefresh = async () => {
    await Promise.all([refetchCurrencies(), refetchCrypto(), refetchGold()])
  }

  // Memoize computed state to prevent unnecessary re-renders
  const computedState = useMemo(() => ({
    isRefreshing: currenciesLoading || cryptoLoading || goldLoading,
    isFetching: currenciesFetching || cryptoFetching || goldFetching,
    hasAllErrors: currenciesError && cryptoError && goldError,
    hasStaleData: (currenciesError && currencies) || (cryptoError && crypto) || (goldError && gold),
    anyError: currenciesError || cryptoError || goldError
  }), [
    currenciesLoading, cryptoLoading, goldLoading,
    currenciesFetching, cryptoFetching, goldFetching,
    currenciesError, cryptoError, goldError,
    currencies, crypto, gold
  ])

  const { isRefreshing, isFetching, hasAllErrors, hasStaleData } = computedState

  // Helper functions for chart integration
  const getItemData = (itemKey: string, itemType: ItemType) => {
    switch (itemType) {
      case 'currency':
        return currencies?.[itemKey]
      case 'crypto':
        return crypto?.[itemKey]
      case 'gold':
        return gold?.[itemKey]
      default:
        return null
    }
  }

  const getItemName = (itemKey: string, itemType: ItemType): string => {
    const items = itemType === 'currency' ? currencyItems : itemType === 'crypto' ? cryptoItems : goldItems
    return items.find(item => item.key === itemKey)?.name || itemKey
  }

  const handleItemClick = (itemKey: string, itemType: ItemType) => {
    const itemData = getItemData(itemKey, itemType)
    if (itemData) {
      chartSheet.openChart({
        code: mapItemCodeToApi(itemKey),
        name: getItemName(itemKey, itemType),
        type: itemType,
        price: itemData.value,
        change: itemData.change,
      })
    }
  }

  return (
    <div className="min-h-screen bg-background-base">
      <div className="max-w-7xl mx-auto">
        {/* Main Header - Apple-style clean design */}
        <div className="bg-bg-elevated border-b border-border-light shadow-sm text-center py-8 sm:py-10 lg:py-12 px-4 sm:px-6 lg:px-8 mb-8 sm:mb-10 lg:mb-12">
          <div className="flex items-center justify-center gap-4 mb-6" dir="rtl">
            <h1 className="text-apple-large-title text-text-primary">
              نرخ ارز، طلا و ارز دیجیتال
            </h1>
            <ThemeToggle />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4" dir="rtl">
            <Button
              variant="filled"
              size="lg"
              onClick={handleRefresh}
              disabled={isRefreshing || isFetching}
              aria-label={isRefreshing ? 'در حال بروزرسانی قیمت‌ها' : 'بروزرسانی قیمت‌ها'}
              aria-busy={isRefreshing || isFetching}
            >
              <HiRefresh className={`text-xl ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isRefreshing ? 'در حال بروزرسانی...' : isFetching ? 'در حال دریافت...' : 'بروزرسانی'}
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
                آخرین بروزرسانی: {lastUpdated ? (
                  <time dateTime={lastUpdated.toISOString()}>
                    {lastUpdated.toLocaleTimeString('fa-IR')}
                  </time>
                ) : '--:--:--'}
              </p>
            </div>
          </div>
        </div>

        {/* ARIA Live Region for Screen Readers */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {(currenciesFetching || cryptoFetching || goldFetching) && 'در حال بروزرسانی قیمت‌ها...'}
          {!currenciesFetching && !cryptoFetching && !goldFetching && lastUpdated &&
            `قیمت‌ها به‌روز شدند. آخرین بروزرسانی: ${new Date(lastUpdated).toLocaleTimeString('fa-IR')}`
          }
        </div>

        {/* Content Container */}
        <div className="px-4 sm:px-6 lg:px-8">

        {/* Stale Data Warning Banner */}
        {hasStaleData && !hasAllErrors && (
          <div className="bg-warning-bg border border-warning-text/30 dark:border-warning-text/50 rounded-[var(--radius-lg)] p-4 mb-6 animate-fade-in" dir="rtl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-warning-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-warning-text mb-1">
                  داده‌ها ممکن است قدیمی باشند
                </h3>
                <p className="text-sm text-warning-text">
                  امکان دریافت آخرین اطلاعات وجود ندارد. داده‌های ذخیره‌شده قبلی نمایش داده می‌شوند.
                  {lastUpdated && (
                    <> آخرین بروزرسانی موفق: {lastUpdated.toLocaleTimeString('fa-IR')}</>
                  )}
                </p>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-sm text-warning-text hover:opacity-80 font-medium underline"
                >
                  تلاش مجدد برای بروزرسانی
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Message - only show if no cached data at all */}
        {hasAllErrors && !currencies && !crypto && !gold && (
          <div className="bg-error-bg border border-error-text/30 dark:border-error-text/50 rounded-[var(--radius-lg)] p-6 mb-6 animate-fade-in" dir="rtl">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-error-text mb-2">خطا در دریافت اطلاعات</h3>
              <p className="text-error-text mb-4">امکان دریافت اطلاعات از سرور وجود ندارد. لطفاً دوباره تلاش کنید.</p>
              <button
                onClick={handleRefresh}
                className="bg-red-600 dark:bg-red-700 text-white rounded px-6 py-2 hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
              >
                تلاش مجدد
              </button>
            </div>
          </div>
        )}

        <div className="space-y-8 sm:space-y-10 lg:space-y-12">
          {/* SECTION 1: Currencies */}
          <section
            className="bg-bg-elevated rounded-[var(--radius-lg)] shadow-sm overflow-hidden animate-fade-in"
            dir="rtl"
            lang="fa"
            aria-labelledby="currencies-heading"
          >
            <div className="px-6 py-5 border-b border-border-light">
              <h2
                id="currencies-heading"
                className="text-apple-title text-text-primary text-center flex items-center justify-center gap-2"
              >
                <FaDollarSign className="text-2xl text-accent" aria-hidden="true" />
                ارزها
              </h2>
            </div>
            <div className="p-6">

            {currenciesLoading && !currencies && <ItemCardSkeleton count={5} />}

            {currenciesError && !currencies && (
              <ErrorDisplay
                error={currenciesError}
                onRetry={() => refetchCurrencies()}
                title="خطا در دریافت اطلاعات ارزها"
              />
            )}

            {currencies && (
              <ErrorBoundary
                boundaryName="CurrenciesGrid"
                fallback={(_error, reset) => (
                  <div className="p-4 text-center text-text-secondary" dir="rtl" role="alert" aria-live="assertive">
                    <p className="mb-2">خطا در نمایش اطلاعات ارزها.</p>
                    <button
                      onClick={reset}
                      className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors text-sm"
                    >
                      تلاش مجدد
                    </button>
                  </div>
                )}
              >
                <ItemCardGrid
                  items={currencyItems}
                  data={currencies}
                  accentColor="blue"
                  onItemClick={(key) => handleItemClick(key, 'currency')}
                />
              </ErrorBoundary>
            )}
            </div>
          </section>

          {/* SECTION 2: Cryptocurrencies */}
          <section
            className="bg-bg-elevated rounded-[var(--radius-lg)] shadow-sm overflow-hidden animate-fade-in"
            dir="rtl"
            lang="fa"
            aria-labelledby="crypto-heading"
          >
            <div className="px-6 py-5 border-b border-border-light">
              <h2
                id="crypto-heading"
                className="text-apple-title text-text-primary text-center flex items-center justify-center gap-2"
              >
                <FaBitcoin className="text-2xl text-accent" aria-hidden="true" />
                ارزهای دیجیتال
              </h2>
            </div>
            <div className="p-6">

            {cryptoLoading && !crypto && <ItemCardSkeleton count={3} />}

            {cryptoError && !crypto && (
              <ErrorDisplay
                error={cryptoError}
                onRetry={() => refetchCrypto()}
                title="خطا در دریافت اطلاعات ارزهای دیجیتال"
              />
            )}

            {crypto && (
              <ErrorBoundary
                boundaryName="CryptoGrid"
                fallback={(_error, reset) => (
                  <div className="p-4 text-center text-text-secondary" dir="rtl" role="alert" aria-live="assertive">
                    <p className="mb-2">خطا در نمایش اطلاعات ارزهای دیجیتال.</p>
                    <button
                      onClick={reset}
                      className="bg-purple-600 dark:bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-700 dark:hover:bg-purple-800 transition-colors text-sm"
                    >
                      تلاش مجدد
                    </button>
                  </div>
                )}
              >
                <ItemCardGrid
                  items={cryptoItems}
                  data={crypto}
                  accentColor="purple"
                  onItemClick={(key) => handleItemClick(key, 'crypto')}
                />
              </ErrorBoundary>
            )}
            </div>
          </section>

          {/* SECTION 3: Gold & Coins */}
          <section
            className="bg-bg-elevated rounded-[var(--radius-lg)] shadow-sm overflow-hidden animate-fade-in"
            dir="rtl"
            lang="fa"
            aria-labelledby="gold-heading"
          >
            <div className="px-6 py-5 border-b border-border-light">
              <h2
                id="gold-heading"
                className="text-apple-title text-text-primary text-center flex items-center justify-center gap-2"
              >
                <GiGoldBar className="text-2xl text-accent" aria-hidden="true" />
                طلا و سکه
              </h2>
            </div>
            <div className="p-6">

            {goldLoading && !gold && <ItemCardSkeleton count={6} />}

            {goldError && !gold && (
              <ErrorDisplay
                error={goldError}
                onRetry={() => refetchGold()}
                title="خطا در دریافت اطلاعات طلا و سکه"
              />
            )}

            {gold && (
              <ErrorBoundary
                boundaryName="GoldGrid"
                fallback={(_error, reset) => (
                  <div className="p-4 text-center text-text-secondary" dir="rtl" role="alert" aria-live="assertive">
                    <p className="mb-2">خطا در نمایش اطلاعات طلا و سکه.</p>
                    <button
                      onClick={reset}
                      className="bg-gold-400 dark:bg-gold-700 text-white px-4 py-2 rounded hover:bg-gold-700 dark:hover:bg-gold-800 transition-colors text-sm"
                    >
                      تلاش مجدد
                    </button>
                  </div>
                )}
              >
                <ItemCardGrid
                  items={goldItems}
                  data={gold}
                  accentColor="gold"
                  onItemClick={(key) => handleItemClick(key, 'gold')}
                />
              </ErrorBoundary>
            )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 sm:mt-10 lg:mt-12 py-6 border-t border-border-light" dir="rtl">
          <p className="text-apple-caption text-text-secondary flex items-center justify-center gap-2">
            <FiInfo className="text-base" aria-hidden="true" />
            <span>داده‌ها به‌صورت خودکار هر 5 دقیقه یکبار به‌روزرسانی می‌شوند</span>
          </p>
        </div>

        {/* Chart Bottom Sheet - Lazy loaded for performance */}
        <ErrorBoundary
          boundaryName="ChartLazyLoad"
          fallback={(error, reset) => (
            // Only show error UI if chart is open
            chartSheet.isOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                onClick={chartSheet.closeChart}
              >
                <div
                  className="bg-surface rounded-lg p-6 shadow-xl max-w-md mx-4"
                  onClick={(e) => e.stopPropagation()}
                  dir="rtl"
                >
                  <div className="text-center">
                    <div className="mb-4 text-red-500 text-5xl">⚠️</div>
                    <h3 className="text-lg font-semibold text-error-text mb-2">
                      خطا در بارگذاری نمودار
                    </h3>
                    <p className="text-text-secondary mb-4 text-sm">
                      امکان بارگذاری نمودار وجود ندارد. لطفاً اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          reset()
                          window.location.reload()
                        }}
                        className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        تلاش مجدد
                      </button>
                      <button
                        onClick={chartSheet.closeChart}
                        className="bg-gray-200 dark:bg-gray-700 text-text-primary px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        بستن
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null
          )}
        >
          <Suspense fallback={
            // Only show loading UI if chart is open
            chartSheet.isOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-surface rounded-lg p-6 shadow-xl">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-primary text-sm" dir="rtl">در حال بارگذاری نمودار...</p>
                  </div>
                </div>
              </div>
            ) : null
          }>
            <ChartBottomSheet
              isOpen={chartSheet.isOpen}
              onClose={chartSheet.closeChart}
              item={chartSheet.selectedItem}
            />
          </Suspense>
        </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
