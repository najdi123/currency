'use client'

import React, { useEffect } from 'react'
import { useAppSelector } from '@/lib/hooks'
import { selectUser } from '@/lib/store/slices/authSlice'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FiArrowLeft } from 'react-icons/fi'
import { AuthGuard } from '@/components/AuthGuard'
import { UserWalletManagement } from '@/components/UserWalletManagement'
import { useGetUserByIdQuery } from '@/lib/store/services/walletApi'
import { Alert } from '@/components/ui/Alert'

export default function UserManagementPage({
  params
}: {
  params: Promise<{ userId: string; locale: string }>
}) {
  const user = useAppSelector(selectUser)
  const router = useRouter()
  const t = useTranslations('Admin')

  // Unwrap params for client component
  const [userId, setUserId] = React.useState<string>('')

  React.useEffect(() => {
    params.then(p => setUserId(p.userId))
  }, [params])

  // Fetch user details
  const {
    data: targetUser,
    isLoading: isUserLoading,
    isError: isUserError,
    error: userError,
  } = useGetUserByIdQuery(userId, {
    skip: !user || user.role !== 'admin' || !userId,
  })

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/')
    }
  }, [user, router])

  const handleBack = () => {
    router.push('/admin/users')
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-bg-base">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {user?.role === 'admin' ? (
            <div className="space-y-6" >
              {/* Back Button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 rotate-180" />
                <span className="text-sm font-medium">{t('backToUserList')}</span>
              </button>

              {/* Error State */}
              {isUserError && (
                <Alert variant="error" title={t('errorLoadingUser')}>
                  {(userError as any)?.data?.message || t('errorOccurred')}
                </Alert>
              )}

              {/* Loading State */}
              {isUserLoading && (
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-bg-secondary rounded w-1/3" />
                  <div className="h-4 bg-bg-secondary rounded w-1/2" />
                </div>
              )}

              {/* User Wallet Management */}
              {targetUser && (
                <UserWalletManagement
                  userId={userId}
                  userEmail={targetUser.email}
                  userName={
                    targetUser.firstName && targetUser.lastName
                      ? `${targetUser.firstName} ${targetUser.lastName}`
                      : undefined
                  }
                />
              )}
            </div>
          ) : (
            <div >
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
