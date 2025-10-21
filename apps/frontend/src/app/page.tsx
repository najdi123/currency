'use client'

import { useState, useEffect } from 'react'
import {
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
} from '@/lib/store/services/api'
import { formatToman, formatChange, getChangeColor } from '@/lib/utils/formatters'
import { ErrorDisplay } from '@/components/ErrorDisplay'

// Currency items to display
const currencyItems = [
  { key: 'usd_sell', name: 'دلار آمریکا' },
  { key: 'eur', name: 'یورو' },
  { key: 'gbp', name: 'پوند انگلیس' },
  { key: 'cad', name: 'دلار کانادا' },
  { key: 'aud', name: 'دلار استرالیا' },
]

const cryptoItems = [
  { key: 'usdt', name: 'تتر' },
  { key: 'btc', name: 'بیت کوین' },
  { key: 'eth', name: 'اتریوم' },
]

const goldItems = [
  { key: 'sekkeh', name: 'سکه امامی' },
  { key: 'bahar', name: 'بهار آزادی' },
  { key: 'nim', name: 'نیم سکه' },
  { key: 'rob', name: 'ربع سکه' },
  { key: 'gerami', name: 'سکه گرمی' },
  { key: '18ayar', name: 'طلای 18 عیار' },
]

// Loading skeleton component
function LoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex justify-between items-center border-b pb-3 last:border-b-0 animate-pulse">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-100 rounded w-1/2"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const {
    data: currencies,
    isLoading: currenciesLoading,
    isFetching: currenciesFetching,
    error: currenciesError,
    refetch: refetchCurrencies,
    fulfilledTimeStamp: currenciesTimestamp,
  } = useGetCurrenciesQuery(undefined, {
    pollingInterval: 300000, // 5 minutes
  })
  const {
    data: crypto,
    isLoading: cryptoLoading,
    isFetching: cryptoFetching,
    error: cryptoError,
    refetch: refetchCrypto,
    fulfilledTimeStamp: cryptoTimestamp,
  } = useGetCryptoQuery(undefined, {
    pollingInterval: 300000, // 5 minutes
  })
  const {
    data: gold,
    isLoading: goldLoading,
    isFetching: goldFetching,
    error: goldError,
    refetch: refetchGold,
    fulfilledTimeStamp: goldTimestamp,
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

  const isRefreshing = currenciesLoading || cryptoLoading || goldLoading
  const isFetching = currenciesFetching || cryptoFetching || goldFetching
  const hasAllErrors = currenciesError && cryptoError && goldError

  // Check if showing stale data (has error but also has cached data)
  const hasStaleData = (currenciesError && currencies) || (cryptoError && crypto) || (goldError && gold)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Main Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4" dir="rtl">
            نرخ ارز، طلا و ارز دیجیتال
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4" dir="rtl">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isFetching}
              className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isFetching && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isRefreshing ? 'در حال بروزرسانی...' : isFetching ? 'در حال دریافت...' : 'بروزرسانی'}
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="relative flex h-2 w-2">
                {isFetching ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </>
                )}
              </span>
              <span>
                آخرین بروزرسانی: {lastUpdated ? lastUpdated.toLocaleTimeString('fa-IR') : '--:--:--'}
              </span>
            </div>
          </div>
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* SECTION 1: Currencies */}
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6" dir="rtl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
              ارزها
            </h2>

            {currenciesLoading && !currencies && <LoadingSkeleton count={5} />}

            {currenciesError && !currencies && (
              <ErrorDisplay
                error={currenciesError}
                onRetry={() => refetchCurrencies()}
                title="خطا در دریافت اطلاعات ارزها"
              />
            )}

            {currencies && (
              <div className="space-y-4">
                {currencyItems.map(item => {
                  const data = currencies[item.key]
                  if (!data) return null

                  return (
                    <div key={item.key} className="flex justify-between items-center border-b pb-3 last:border-b-0">
                      <div>
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-600">{formatToman(data.value)} تومان</p>
                      </div>
                      <div className={`text-sm font-medium ${getChangeColor(data.change)}`}>
                        {formatChange(data.change)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: Cryptocurrencies */}
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6" dir="rtl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
              ارزهای دیجیتال
            </h2>

            {cryptoLoading && !crypto && <LoadingSkeleton count={3} />}

            {cryptoError && !crypto && (
              <ErrorDisplay
                error={cryptoError}
                onRetry={() => refetchCrypto()}
                title="خطا در دریافت اطلاعات ارزهای دیجیتال"
              />
            )}

            {crypto && (
              <div className="space-y-4">
                {cryptoItems.map(item => {
                  const data = crypto[item.key]
                  if (!data) return null

                  return (
                    <div key={item.key} className="flex justify-between items-center border-b pb-3 last:border-b-0">
                      <div>
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-600">{formatToman(data.value)} تومان</p>
                      </div>
                      <div className={`text-sm font-medium ${getChangeColor(data.change)}`}>
                        {formatChange(data.change)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: Gold & Coins */}
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 md:col-span-2 xl:col-span-1" dir="rtl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
              طلا و سکه
            </h2>

            {goldLoading && !gold && <LoadingSkeleton count={6} />}

            {goldError && !gold && (
              <ErrorDisplay
                error={goldError}
                onRetry={() => refetchGold()}
                title="خطا در دریافت اطلاعات طلا و سکه"
              />
            )}

            {gold && (
              <div className="space-y-4">
                {goldItems.map(item => {
                  const data = gold[item.key]
                  if (!data) return null

                  return (
                    <div key={item.key} className="flex justify-between items-center border-b pb-3 last:border-b-0">
                      <div>
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-600">{formatToman(data.value)} تومان</p>
                      </div>
                      <div className={`text-sm font-medium ${getChangeColor(data.change)}`}>
                        {formatChange(data.change)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 py-4 border-t border-gray-200" dir="rtl">
          <p className="text-sm text-gray-600">
            داده‌ها به‌صورت خودکار هر 5 دقیقه یکبار به‌روزرسانی می‌شوند
          </p>
        </div>
      </div>
    </div>
  )
}
