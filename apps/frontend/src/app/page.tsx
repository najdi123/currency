'use client'

import { useState, useEffect } from 'react'
import {
  useGetCurrenciesQuery,
  useGetCryptoQuery,
  useGetGoldQuery,
} from '@/lib/store/services/api'
import { formatToman, formatChange, getChangeColor } from '@/lib/utils/formatters'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { FaDollarSign, FaEuroSign, FaPoundSign, FaBitcoin, FaEthereum } from 'react-icons/fa'
import { SiTether } from 'react-icons/si'
import { GiGoldBar, GiTwoCoins } from 'react-icons/gi'
import { FiArrowUp, FiArrowDown, FiClock, FiInfo } from 'react-icons/fi'
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

// Loading skeleton component with shimmer effect
function LoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex justify-between items-center border-b border-l-2 border-l-transparent pb-3 last:border-b-0 hover:bg-gray-50 hover:border-l-4 hover:border-l-blue-500 transition-all duration-150 px-2 -mx-2 rounded cursor-pointer">
          {/* Left side - Icon, Name and Price */}
          <div className="flex items-center gap-3 flex-1">
            {/* Icon skeleton */}
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer"
              style={{ backgroundSize: '1000px 100%' }}
            ></div>

            {/* Text content */}
            <div className="flex-1">
              {/* Name skeleton */}
              <div
                className="h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/3 mb-2 animate-shimmer"
                style={{ backgroundSize: '1000px 100%' }}
              ></div>
              {/* Price skeleton - larger to match actual price */}
              <div
                className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-2/3 animate-shimmer"
                style={{ backgroundSize: '1000px 100%' }}
              ></div>
            </div>
          </div>

          {/* Right side - Change badge skeleton */}
          <div
            className="h-8 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full animate-shimmer"
            style={{ backgroundSize: '1000px 100%' }}
          ></div>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Category colors for visual distinction
  const categoryColors = {
    currencies: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', accent: 'border-t-blue-500' },
    crypto: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', accent: 'border-t-purple-500' },
    gold: { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', accent: 'border-t-amber-500' }
  }

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
            >
              <HiRefresh className={`text-xl ${isFetching ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'در حال بروزرسانی...' : isFetching ? 'در حال دریافت...' : 'بروزرسانی'}
            </button>
            <div className="flex items-center gap-2 text-sm text-white/90">
              <span className="relative flex h-3 w-3">
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
              <FiClock className="text-base" />
              <span>
                آخرین بروزرسانی: {lastUpdated ? lastUpdated.toLocaleTimeString('fa-IR') : '--:--:--'}
              </span>
            </div>
          </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* SECTION 1: Currencies */}
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-t-4 border-t-blue-500 overflow-hidden" dir="rtl">
            <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
              <h2 className="text-2xl md:text-3xl font-bold text-blue-700 text-center flex items-center justify-center gap-2">
                <FaDollarSign className="text-3xl" />
                ارزها
              </h2>
            </div>
            <div className="p-6">

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
                  const Icon = item.icon
                  const isPositive = data.change >= 0

                  return (
                    <div key={item.key} className="flex justify-between items-center border-b border-l-2 border-l-transparent pb-3 last:border-b-0 hover:bg-gray-50 hover:border-l-4 hover:border-l-blue-500 transition-all duration-150 px-2 -mx-2 rounded cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Icon className={`text-2xl ${item.color}`} />
                        <div>
                          <p className="text-base md:text-lg font-semibold text-gray-700">{item.name}</p>
                          <p className="text-2xl md:text-3xl font-bold font-mono text-gray-900">{formatToman(data.value)} <span className="text-sm font-normal text-gray-600">تومان</span></p>
                        </div>
                      </div>
                      <div className={`inline-flex items-center gap-1 ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-full px-3 py-1 text-sm font-medium`}>
                        {isPositive ? <FiArrowUp className="text-base" /> : <FiArrowDown className="text-base" />}
                        {formatChange(data.change)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>

          {/* SECTION 2: Cryptocurrencies */}
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-t-4 border-t-purple-500 overflow-hidden" dir="rtl">
            <div className="bg-purple-50 px-6 py-4 border-b border-purple-100">
              <h2 className="text-2xl md:text-3xl font-bold text-purple-700 text-center flex items-center justify-center gap-2">
                <FaBitcoin className="text-3xl" />
                ارزهای دیجیتال
              </h2>
            </div>
            <div className="p-6">

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
                  const Icon = item.icon
                  const isPositive = data.change >= 0

                  return (
                    <div key={item.key} className="flex justify-between items-center border-b border-l-2 border-l-transparent pb-3 last:border-b-0 hover:bg-gray-50 hover:border-l-4 hover:border-l-blue-500 transition-all duration-150 px-2 -mx-2 rounded cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Icon className={`text-2xl ${item.color}`} />
                        <div>
                          <p className="text-base md:text-lg font-semibold text-gray-700">{item.name}</p>
                          <p className="text-2xl md:text-3xl font-bold font-mono text-gray-900">{formatToman(data.value)} <span className="text-sm font-normal text-gray-600">تومان</span></p>
                        </div>
                      </div>
                      <div className={`inline-flex items-center gap-1 ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-full px-3 py-1 text-sm font-medium`}>
                        {isPositive ? <FiArrowUp className="text-base" /> : <FiArrowDown className="text-base" />}
                        {formatChange(data.change)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>

          {/* SECTION 3: Gold & Coins */}
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-t-4 border-t-amber-500 overflow-hidden md:col-span-2 xl:col-span-1" dir="rtl">
            <div className="bg-amber-50 px-6 py-4 border-b border-amber-100">
              <h2 className="text-2xl md:text-3xl font-bold text-amber-700 text-center flex items-center justify-center gap-2">
                <GiGoldBar className="text-3xl" />
                طلا و سکه
              </h2>
            </div>
            <div className="p-6">

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
                  const Icon = item.icon
                  const isPositive = data.change >= 0

                  return (
                    <div key={item.key} className="flex justify-between items-center border-b border-l-2 border-l-transparent pb-3 last:border-b-0 hover:bg-gray-50 hover:border-l-4 hover:border-l-blue-500 transition-all duration-150 px-2 -mx-2 rounded cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Icon className={`text-2xl ${item.color}`} />
                        <div>
                          <p className="text-base md:text-lg font-semibold text-gray-700">{item.name}</p>
                          <p className="text-2xl md:text-3xl font-bold font-mono text-gray-900">{formatToman(data.value)} <span className="text-sm font-normal text-gray-600">تومان</span></p>
                        </div>
                      </div>
                      <div className={`inline-flex items-center gap-1 ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-full px-3 py-1 text-sm font-medium`}>
                        {isPositive ? <FiArrowUp className="text-base" /> : <FiArrowDown className="text-base" />}
                        {formatChange(data.change)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>
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
