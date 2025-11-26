'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useAppSelector } from '@/lib/hooks'
import { selectUser, selectIsAuthenticated } from '@/lib/store/slices/authSlice'
import { useLogoutMutation } from '@/lib/store/services/authApi'
import { FiArrowRight, FiUser, FiLock, FiLogOut, FiShield } from 'react-icons/fi'
import { ProfileEdit } from '@/components/ProfileEdit'
import { ChangePassword } from '@/components/ChangePassword'
import { RateLimitMeter } from '@/components/RateLimit'

type SettingsView = 'main' | 'profile' | 'password'

export default function SettingsPage() {
  const router = useRouter()
  const t = useTranslations('Settings')
  const tProfile = useTranslations('Profile')
  const tPassword = useTranslations('ChangePassword')
  const locale = useLocale()
  const user = useAppSelector(selectUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation()
  const [currentView, setCurrentView] = useState<SettingsView>('main')

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    router.push(`/${locale}/login`)
    return null
  }

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try {
        await logout({ refreshToken }).unwrap()
      } catch (error) {
        console.error('Logout failed:', error)
      }
    }
    router.push(`/${locale}/login`)
  }

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <div className="min-h-screen bg-bg-base" >
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              if (currentView !== 'main') {
                setCurrentView('main')
              } else {
                router.push('/')
              }
            }}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
          >
            <FiArrowRight className="w-5 h-5" />
            <span className="text-sm font-medium">
              {currentView !== 'main' ? t('back') : t('backToHome')}
            </span>
          </button>
          <h1 className="text-apple-large-title text-text-primary">
            {currentView === 'main' && t('pageTitle')}
            {currentView === 'profile' && tProfile('firstName')}
            {currentView === 'password' && tPassword('title')}
          </h1>
        </div>

        {/* Main View */}
        {currentView === 'main' && (
          <div className="space-y-6">
            {/* User Info Card */}
            <div className="bg-bg-elevated rounded-3xl border border-border-light p-6">
              <h2 className="text-sm font-semibold text-text-secondary mb-4">
                {t('accountInfo')}
              </h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-2xl flex-shrink-0">
                  {getUserInitials()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold text-text-primary mb-1">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.email}
                  </h3>
                  <p className="text-sm text-text-secondary mb-1">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-2">
                    <FiShield className="w-4 h-4 text-text-tertiary" />
                    <span className="text-xs text-text-tertiary">
                      {user.role === 'admin' ? t('admin') : t('regularUser')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => setCurrentView('profile')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-base hover:bg-bg-secondary rounded-xl border border-border-light transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FiUser className="w-5 h-5 text-text-secondary" />
                    <span className="text-sm font-medium text-text-primary">
                      {t('editProfile')}
                    </span>
                  </div>
                  <FiArrowRight className="w-4 h-4 text-text-tertiary rotate-180" />
                </button>

                <button
                  onClick={() => setCurrentView('password')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-base hover:bg-bg-secondary rounded-xl border border-border-light transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FiLock className="w-5 h-5 text-text-secondary" />
                    <span className="text-sm font-medium text-text-primary">
                      {t('changePassword')}
                    </span>
                  </div>
                  <FiArrowRight className="w-4 h-4 text-text-tertiary rotate-180" />
                </button>
              </div>
            </div>

            {/* Logout Card */}
            <div className="bg-bg-elevated rounded-3xl border border-border-light p-6">
              <h2 className="text-sm font-semibold text-text-secondary mb-4">
                {t('logout')}
              </h2>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-error-bg hover:bg-error-text/20 rounded-xl border border-error-text/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiLogOut className="w-5 h-5 text-error-text" />
                <span className="text-sm font-medium text-error-text">
                  {isLoggingOut ? t('loggingOut') : t('logoutButton')}
                </span>
              </button>
              <p className="text-xs text-text-tertiary text-center mt-3">
                {t('logoutPrompt')}
              </p>
            </div>

            {/* Account Info */}
            <div className="bg-bg-elevated rounded-3xl border border-border-light p-6">
              <h2 className="text-sm font-semibold text-text-secondary mb-4">
                {t('accountDetails')}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-text-secondary">{t('accountStatus')}</span>
                  <span className="text-sm font-medium text-success-text">{t('active')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-border-light">
                  <span className="text-sm text-text-secondary">{t('userRole')}</span>
                  <span className="text-sm font-medium text-text-primary">
                    {user.role === 'admin' ? t('admin') : t('regularUser')}
                  </span>
                </div>
                {(user as any).createdAt && (
                  <div className="flex justify-between items-center py-2 border-t border-border-light">
                    <span className="text-sm text-text-secondary">{t('joinDate')}</span>
                    <span className="text-sm font-medium text-text-primary">
                      {new Date((user as any).createdAt).toLocaleDateString(locale)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* API Usage Section */}
            <RateLimitMeter />
          </div>
        )}

        {/* Profile Edit View */}
        {currentView === 'profile' && (
          <div className="bg-bg-elevated rounded-3xl border border-border-light p-6">
            <ProfileEdit onBack={() => setCurrentView('main')} />
          </div>
        )}

        {/* Change Password View */}
        {currentView === 'password' && (
          <div className="bg-bg-elevated rounded-3xl border border-border-light p-6">
            <ChangePassword onBack={() => setCurrentView('main')} />
          </div>
        )}
      </div>
    </div>
  )
}
