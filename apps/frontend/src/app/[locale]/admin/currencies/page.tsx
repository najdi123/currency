'use client'

import { useAppSelector } from '@/lib/hooks'
import { selectUser } from '@/lib/store/slices/authSlice'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AuthGuard } from '@/components/AuthGuard'
import { CurrencyManagement } from '@/components/CurrencyManagement'
import { Alert } from '@/components/ui/Alert'

export default function AdminCurrenciesPage() {
  const user = useAppSelector(selectUser)
  const router = useRouter()
  const t = useTranslations('Admin')
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/')
    }
  }, [user, router])

  // Show nothing during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <main className="min-h-screen bg-bg-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-bg-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {user?.role === 'admin' ? (
            <CurrencyManagement />
          ) : (
            <div>
              <Alert variant="error" title={t('unauthorizedAccess')}>
                {t('noAccessPermission')}
              </Alert>
            </div>
          )}
        </div>
      </main>
    </AuthGuard>
  )
}
