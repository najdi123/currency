'use client'

import { useGetCurrenciesQuery } from '@/lib/store/services/api'
import { formatToman } from '@/lib/utils/formatters'
import { getUserErrorMessage } from '@/lib/utils/errorMessages'

export default function DevPage() {
  const { data, error, isLoading, isFetching, refetch } = useGetCurrenciesQuery()

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Currencies smoke test</h1>

      <div className="text-sm text-gray-500">
        loading: {String(isLoading)} | fetching: {String(isFetching)}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => refetch()}
          className="px-3 py-1 rounded bg-blue-600 text-white"
        >
          Manual refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700">
          {getUserErrorMessage(error).title}
        </div>
      )}

      {data && (
        <div className="rounded border p-4">
          <div className="text-xs text-gray-500 mb-2">
            _metadata: {JSON.stringify(data._metadata ?? {}, null, 2)}
          </div>
          <ul className="space-y-1">
            {['usd_sell', 'eur', 'gbp'].map((k) => (
              <li key={k} className="flex items-center justify-between">
                <span className="font-medium">{k}</span>
                <span>{formatToman(data?.[k]?.value ?? 0)} تومان</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
