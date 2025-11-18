'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { useAppSelector } from '@/lib/hooks'
import { selectUser, selectIsAuthenticated } from '@/lib/store/slices/authSlice'
import { SegmentedControl } from '@/components/ui'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { RateLimitMeter } from '@/components/RateLimit/RateLimitMeter'
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

// Spacing constants following 4px grid
const MODAL_SPACING = {
  header: 'p-6', // 24px (space-6 token)
  content: 'p-6', // 24px (space-6 token)
  sectionGap: 'space-y-6', // 24px between sections
  sectionTitleMargin: 'mb-3', // 12px (space-3 token)
  itemGap: 'space-y-3', // 12px between items (space-3 token)
} as const

// Icon sizing constants
const ICON_SIZES = {
  sm: 'w-4 h-4', // 16px - for inline/decorative icons
  md: 'w-5 h-5', // 20px - for primary actions (default)
  lg: 'w-6 h-6', // 24px - for prominent actions
} as const

// Divider component for section separation
const Divider = () => (
  <div
    className="border-t border-border-light"
    role="separator"
    aria-orientation="horizontal"
  />
)

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const t = useTranslations('SettingsModal')

  const user = useAppSelector(selectUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  // Refs for focus management
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Animation state management
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
    } else {
      setIsAnimating(false)
    }
  }, [isOpen])

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement

      // Focus the close button after animation completes
      setTimeout(() => {
        closeButtonRef.current?.focus()
      }, 100)
    } else {
      // Restore focus when modal closes
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen || !modalRef.current) return

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = modalRef.current?.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )

      if (!focusableElements || focusableElements.length === 0) return

      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen])

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
    return role === 'admin' ? t('admin') : t('regularUser')
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
        className={cn(
          "fixed inset-0 transition-all duration-300",
          "backdrop-blur-2xl backdrop-saturate-150",
          "bg-gradient-to-b from-black/40 via-black/50 to-black/60",
          "dark:from-black/60 dark:via-black/70 dark:to-black/80",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className={cn(
            "relative bg-bg-elevated rounded-2xl shadow-apple-card border border-border-light",
            "w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col",
            "transition-all duration-300 ease-out",
            isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn("flex items-center justify-between border-b border-border-light", MODAL_SPACING.header)}>
            <h2 id="settings-title" className="text-apple-title text-text-primary">
              {t('title')}
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className={cn(
                "p-3 rounded-lg",
                "text-text-secondary hover:text-text-primary",
                "hover:bg-bg-secondary transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
                "active-scale-apple"
              )}
              aria-label={t('close')}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className={cn("flex-1 overflow-y-auto", MODAL_SPACING.content)}>
            <div className={MODAL_SPACING.sectionGap}>
                {/* Theme Section */}
                <section>
                  <h3 className={cn("text-apple-caption text-text-secondary font-medium uppercase tracking-wide", MODAL_SPACING.sectionTitleMargin)}>
                    {t('appearance')}
                  </h3>
                  <div className="space-y-2">
                    {!mounted ? (
                      <div
                        className="shimmer-bg h-[44px] rounded-lg"
                        role="status"
                        aria-label="Loading theme settings"
                      />
                    ) : (
                      <SegmentedControl
                        value={theme || 'system'}
                        onChange={setTheme}
                        options={[
                          { value: 'light', label: t('light'), icon: <FiSun className="w-4 h-4" /> },
                          { value: 'dark', label: t('dark'), icon: <FiMoon className="w-4 h-4" /> },
                          { value: 'system', label: t('system'), icon: <FiMonitor className="w-4 h-4" /> },
                        ]}
                        fullWidth
                        aria-label={t('selectTheme')}
                      />
                    )}
                  </div>
                </section>

                <Divider />

                {/* Language Section */}
                <section>
                  <h3 className={cn("text-apple-caption text-text-secondary font-medium uppercase tracking-wide", MODAL_SPACING.sectionTitleMargin)}>
                    {t('language')}
                  </h3>
                  <LanguageSwitcher />
                </section>

                <Divider />

                {/* API Usage Section */}
                <section>
                  <h3 className={cn("text-apple-caption text-text-secondary font-medium uppercase tracking-wide", MODAL_SPACING.sectionTitleMargin)}>
                    {t('apiUsage')}
                  </h3>
                  <RateLimitMeter />
                </section>

                <Divider />

                {/* User Management Section - Admin Only */}
                {isAuthenticated && user && user.role === 'admin' && (
                  <>
                    <section>
                      <h3 className={cn("text-apple-caption text-text-secondary font-medium uppercase tracking-wide", MODAL_SPACING.sectionTitleMargin)}>
                        {t('management')}
                      </h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            onClose()
                            router.push('/admin/users')
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3.5",
                            "bg-bg-base hover:bg-bg-secondary rounded-lg border border-border-light",
                            "transition-colors text-right active-scale-apple",
                            "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                          )}
                        >
                          <FiUsers className={cn(ICON_SIZES.md, "text-text-secondary")} />
                          <span className="text-apple-body font-medium text-text-primary">
                            {t('manageUsers')}
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            onClose()
                            router.push('/admin/users/create')
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3.5",
                            "bg-bg-base hover:bg-bg-secondary rounded-lg border border-border-light",
                            "transition-colors text-right active-scale-apple",
                            "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                          )}
                        >
                          <FiUserPlus className={cn(ICON_SIZES.md, "text-text-secondary")} />
                          <span className="text-apple-body font-medium text-text-primary">
                            {t('createUser')}
                          </span>
                        </button>
                      </div>
                    </section>

                    <Divider />
                  </>
                )}

                {/* Account Section */}
                <section>
                  <h3 className={cn("text-apple-caption text-text-secondary font-medium uppercase tracking-wide", MODAL_SPACING.sectionTitleMargin)}>
                    {t('account')}
                  </h3>
                  <div className={MODAL_SPACING.itemGap}>
                    {isAuthenticated && user ? (
                      <>
                        {/* User Info */}
                        <div className="flex items-center gap-3 p-4 bg-bg-base rounded-lg border border-border-light">
                          <div
                            className={cn(
                              "w-12 h-12 rounded-full flex items-center justify-center",
                              "text-white font-semibold text-lg flex-shrink-0",
                              "bg-gradient-to-br from-accent to-accent-hover",
                              "shadow-sm"
                            )}
                            role="img"
                            aria-label={user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}'s avatar`
                              : `${user.email}'s avatar`}
                          >
                            {getUserInitials()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-apple-body text-text-primary truncate font-medium">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.email}
                            </p>
                            <p className="text-apple-caption text-text-tertiary truncate">
                              {user.email}
                            </p>
                            <p className="text-apple-caption text-text-tertiary mt-1">
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
                          className={cn(
                            "w-full flex items-center justify-between",
                            "px-4 py-3.5",
                            "bg-accent hover:bg-accent-hover text-white",
                            "rounded-lg transition-colors",
                            "active-scale-apple",
                            "focus:outline-none focus:ring-2 focus:ring-accent-hover focus:ring-offset-2 focus:ring-offset-bg-elevated"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <FiUser className={ICON_SIZES.md} />
                            <span className="text-apple-body font-medium">
                              {t('manageAccount')}
                            </span>
                          </div>
                          <FiArrowRight className={ICON_SIZES.sm} />
                        </button>

                        {/* View My Wallet Button */}
                        <button
                          onClick={() => {
                            onClose()
                            router.push('/wallet')
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3.5",
                            "bg-bg-base hover:bg-bg-secondary rounded-lg border border-border-light",
                            "transition-colors text-right active-scale-apple",
                            "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                          )}
                        >
                          <FiDollarSign className={cn(ICON_SIZES.md, "text-text-secondary")} />
                          <span className="text-apple-body font-medium text-text-primary">
                            {t('viewWallet')}
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Login Button */}
                        <button
                          onClick={handleLogin}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 px-4 py-3.5",
                            "bg-accent hover:bg-accent-hover text-white rounded-lg",
                            "transition-colors active-scale-apple",
                            "focus:outline-none focus:ring-2 focus:ring-accent-hover focus:ring-offset-2"
                          )}
                        >
                          <FiLogIn className={ICON_SIZES.md} />
                          <span className="text-apple-body font-medium">
                            {t('login')}
                          </span>
                        </button>
                        <p className="text-apple-caption text-text-tertiary text-center">
                          {t('loginPrompt')}
                        </p>
                      </>
                    )}
                  </div>
                </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
