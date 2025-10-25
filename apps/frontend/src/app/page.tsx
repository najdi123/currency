'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
} from '@/lib/store/services/api'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { ItemCardGrid } from '@/components/ItemCardGrid'
import { ItemCardSkeleton } from '@/components/ItemCardSkeleton'
import { FaDollarSign, FaEuroSign, FaPoundSign, FaBitcoin, FaEthereum } from 'react-icons/fa'
import { SiTether } from 'react-icons/si'
import { GiGoldBar, GiTwoCoins } from 'react-icons/gi'
import { FiClock, FiInfo } from 'react-icons/fi'
import { HiRefresh } from 'react-icons/hi'

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
  { key: 'sekkeh', name: 'سکه امامی', icon: GiTwoCoins, color: 'text-amber-600' },
  { key: 'bahar', name: 'بهار آزادی', icon: GiTwoCoins, color: 'text-amber-600' },
  { key: 'nim', name: 'نیم سکه', icon: GiTwoCoins, color: 'text-amber-600' },
  { key: 'rob', name: 'ربع سکه', icon: GiTwoCoins, color: 'text-amber-600' },
  { key: 'gerami', name: 'سکه گرمی', icon: GiTwoCoins, color: 'text-amber-600' },
  { key: '18ayar', name: 'طلای 18 عیار', icon: GiGoldBar, color: 'text-amber-600' },
]

export default function Home() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Main Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-8 px-4 shadow-lg mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 drop-shadow-lg" dir="rtl">
            نرخ ارز، طلا و ارز دیجیتال
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4" dir="rtl">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isFetching}
              className="bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold px-6 py-3 rounded-full shadow-md hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 flex items-center gap-2 text-base md:text-lg"
              aria-label={isRefreshing ? 'در حال بروزرسانی قیمت‌ها' : 'بروزرسانی قیمت‌ها'}
              aria-busy={isRefreshing || isFetching}
            >
              <HiRefresh className={`text-xl ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isRefreshing ? 'در حال بروزرسانی...' : isFetching ? 'در حال دریافت...' : 'بروزرسانی'}
            </button>
            <div className="flex items-center gap-2 text-sm text-white/90">
              <span className="relative flex h-3 w-3" aria-hidden="true">
                {isFetching ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400"></span>
                  </>
                )}
              </span>
              <FiClock className="text-base" aria-hidden="true" />
              <p className="text-sm text-white/90" aria-live="polite">
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
        <div className="p-4 sm:p-6 lg:p-8">

        {/* Stale Data Warning Banner */}
        {hasStaleData && !hasAllErrors && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6" dir="rtl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  داده‌ها ممکن است قدیمی باشند
                </h3>
                <p className="text-sm text-yellow-700">
                  امکان دریافت آخرین اطلاعات وجود ندارد. داده‌های ذخیره‌شده قبلی نمایش داده می‌شوند.
                  {lastUpdated && (
                    <> آخرین بروزرسانی موفق: {lastUpdated.toLocaleTimeString('fa-IR')}</>
                  )}
                </p>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-sm text-yellow-800 hover:text-yellow-900 font-medium underline"
                >
                  تلاش مجدد برای بروزرسانی
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Message - only show if no cached data at all */}
        {hasAllErrors && !currencies && !crypto && !gold && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6" dir="rtl">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-800 mb-2">خطا در دریافت اطلاعات</h3>
              <p className="text-red-600 mb-4">امکان دریافت اطلاعات از سرور وجود ندارد. لطفاً دوباره تلاش کنید.</p>
              <button
                onClick={handleRefresh}
                className="bg-red-600 text-white rounded px-6 py-2 hover:bg-red-700 transition-colors"
              >
                تلاش مجدد
              </button>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* SECTION 1: Currencies */}
          <section
            className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 border-t-4 border-t-blue-500 overflow-hidden"
            dir="rtl"
            lang="fa"
            aria-labelledby="currencies-heading"
          >
            <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
              <h2
                id="currencies-heading"
                className="text-2xl md:text-3xl font-bold text-blue-700 text-center flex items-center justify-center gap-2"
              >
                <FaDollarSign className="text-3xl" aria-hidden="true" />
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
                  <div className="p-4 text-center text-gray-600" dir="rtl" role="alert" aria-live="assertive">
                    <p className="mb-2">خطا در نمایش اطلاعات ارزها.</p>
                    <button
                      onClick={reset}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
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
                />
              </ErrorBoundary>
            )}
            </div>
          </section>

          {/* SECTION 2: Cryptocurrencies */}
          <section
            className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 border-t-4 border-t-purple-500 overflow-hidden"
            dir="rtl"
            lang="fa"
            aria-labelledby="crypto-heading"
          >
            <div className="bg-purple-50 px-6 py-4 border-b border-purple-100">
              <h2
                id="crypto-heading"
                className="text-2xl md:text-3xl font-bold text-purple-700 text-center flex items-center justify-center gap-2"
              >
                <FaBitcoin className="text-3xl" aria-hidden="true" />
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
                  <div className="p-4 text-center text-gray-600" dir="rtl" role="alert" aria-live="assertive">
                    <p className="mb-2">خطا در نمایش اطلاعات ارزهای دیجیتال.</p>
                    <button
                      onClick={reset}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors text-sm"
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
                />
              </ErrorBoundary>
            )}
            </div>
          </section>

          {/* SECTION 3: Gold & Coins */}
          <section
            className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 border-t-4 border-t-amber-500 overflow-hidden"
            dir="rtl"
            lang="fa"
            aria-labelledby="gold-heading"
          >
            <div className="bg-amber-50 px-6 py-4 border-b border-amber-100">
              <h2
                id="gold-heading"
                className="text-2xl md:text-3xl font-bold text-amber-700 text-center flex items-center justify-center gap-2"
              >
                <GiGoldBar className="text-3xl" aria-hidden="true" />
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
                  <div className="p-4 text-center text-gray-600" dir="rtl" role="alert" aria-live="assertive">
                    <p className="mb-2">خطا در نمایش اطلاعات طلا و سکه.</p>
                    <button
                      onClick={reset}
                      className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 transition-colors text-sm"
                    >
                      تلاش مجدد
                    </button>
                  </div>
                )}
              >
                <ItemCardGrid
                  items={goldItems}
                  data={gold}
                  accentColor="amber"
                />
              </ErrorBoundary>
            )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-4 border-t border-gray-200" dir="rtl">
          <p className="text-sm text-gray-600 flex items-center justify-center gap-2">
            <FiInfo className="text-base" />
            <span>داده‌ها به‌صورت خودکار هر 5 دقیقه یکبار به‌روزرسانی می‌شوند</span>
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
