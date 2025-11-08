'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { useAppSelector } from '@/lib/hooks'
import { selectUser, selectIsAuthenticated } from '@/lib/store/slices/authSlice'
import { SegmentedControl } from '@/components/ui'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { FiX, FiSun, FiMoon, FiMonitor, FiUser, FiLogIn, FiUserPlus, FiArrowRight, FiDollarSign, FiUsers, FiGlobe } from 'react-icons/fi'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsView = 'main'

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const t = useTranslations('SettingsModal')

  const user = useAppSelector(selectUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleLogin = () => {
    onClose()
    router.push('/login')
  }

  const getRoleText = (role: string) => {
    return role === 'admin' ? t('account.role.admin') : t('account.role.user')
  }

  if (!isOpen) return null

  // Get user initials for avatar
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
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xl transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-bg-elevated rounded-2xl shadow-apple-card border border-border-light w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-light" >
            <h2 id="settings-title" className="text-xl font-semibold text-text-primary">
              {t('title')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label={t('close')}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6" >
                {/* Theme Section */}
                <section>
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('appearance.title')}
                  </h3>
                  <div className="space-y-2">
                    {mounted && (
                      <SegmentedControl
                        value={theme || 'system'}
                        onChange={setTheme}
                        options={[
                          { value: 'light', label: t('appearance.light'), icon: <FiSun className="w-4 h-4" /> },
                          { value: 'dark', label: t('appearance.dark'), icon: <FiMoon className="w-4 h-4" /> },
                          { value: 'system', label: t('appearance.system'), icon: <FiMonitor className="w-4 h-4" /> },
                        ]}
                        fullWidth
                      />
                    )}
                  </div>
                </section>

                {/* Divider */}
                <div className="border-t border-border-light" />

                {/* Language Section */}
                <section>
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('language.title')}
                  </h3>
                  <LanguageSwitcher />
                </section>

                {/* Divider */}
                <div className="border-t border-border-light" />

                {/* Account Section */}
                <section>
                  <h3 className="text-sm font-medium text-text-secondary mb-3">
                    {t('account.title')}
                  </h3>
                  <div className="space-y-3">
                    {isAuthenticated && user ? (
                      <>
                        {/* User Info */}
                        <div className="flex items-center gap-3 p-4 bg-bg-base rounded-lg border border-border-light">
                          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                            {getUserInitials()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.email}
                            </p>
                            <p className="text-xs text-text-tertiary truncate">
                              {user.email}
                            </p>
                            <p className="text-xs text-text-tertiary mt-0.5">
                              {getRoleText(user.role)}
                            </p>
                          </div>
                        </div>

                        {/* Go to Settings Page Button */}
                        <button
                          onClick={() => {
                            onClose()
                            router.push('/settings')
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FiUser className="w-5 h-5" />
                            <span className="text-sm font-medium">
                              {t('account.manageAccount')}
                            </span>
                          </div>
                          <FiArrowRight className="w-4 h-4 rotate-180" />
                        </button>

                        {/* View My Wallet Button */}
                        <button
                          onClick={() => {
                            onClose()
                            router.push('/wallet')
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-bg-base hover:bg-bg-secondary rounded-lg border border-border-light transition-colors text-right"
                        >
                          <FiDollarSign className="w-5 h-5 text-text-secondary" />
                          <span className="text-sm font-medium text-text-primary">
                            {t('account.viewWallet')}
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Login Button */}
                        <button
                          onClick={handleLogin}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors active-scale-apple"
                        >
                          <FiLogIn className="w-5 h-5" />
                          <span className="text-sm font-medium">
                            {t('account.login')}
                          </span>
                        </button>
                        <p className="text-xs text-text-tertiary text-center">
                          {t('account.loginPrompt')}
                        </p>
                      </>
                    )}
                  </div>
                </section>

                {/* User Management Section - Admin Only */}
                {isAuthenticated && user && user.role === 'admin' && (
                  <>
                    {/* Divider */}
                    <div className="border-t border-border-light" />

                    <section>
                      <h3 className="text-sm font-medium text-text-secondary mb-3">
                        {t('management.title')}
                      </h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            onClose()
                            router.push('/admin/users')
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-bg-base hover:bg-bg-secondary rounded-lg border border-border-light transition-colors text-right"
                        >
                          <FiUsers className="w-5 h-5 text-text-secondary" />
                          <span className="text-sm font-medium text-text-primary">
                            {t('management.manageUsers')}
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            onClose()
                            router.push('/admin/users/create')
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-bg-base hover:bg-bg-secondary rounded-lg border border-border-light transition-colors text-right"
                        >
                          <FiUserPlus className="w-5 h-5 text-text-secondary" />
                          <span className="text-sm font-medium text-text-primary">
                            {t('management.createUser')}
                          </span>
                        </button>
                      </div>
                    </section>
                  </>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
