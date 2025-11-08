'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLoginMutation } from '@/lib/store/services/authApi'
import { useAppDispatch } from '@/lib/hooks'
import { setUser } from '@/lib/store/slices/authSlice'
import { Input, Alert } from '@/components/ui'
import { FiMail, FiLock, FiAlertTriangle } from 'react-icons/fi'
import { useCapsLock } from '@/hooks/useCapsLock'

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

export default function LoginPage() {
  const t = useTranslations('Login')
  const router = useRouter()
  const dispatch = useAppDispatch()
  const [login, { isLoading, error }] = useLoginMutation()

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [validationErrors, setValidationErrors] = useState<{
    email?: string
    password?: string
  }>({})
  const [shouldShake, setShouldShake] = useState(false)
  const capsLockOn = useCapsLock()

  // Check if already logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken')
      if (token) {
        router.push('/')
      }
    }
  }, [router])

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {}

    if (!formData.email) {
      errors.email = t('validation.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('validation.emailInvalid')
    }

    if (!formData.password) {
      errors.password = t('validation.passwordRequired')
    } else if (formData.password.length < 6) {
      errors.password = t('validation.passwordMinLength')
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear validation error for this field
    setValidationErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target
    const errors: { email?: string; password?: string } = {}

    if (name === 'email' && formData.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = t('validation.emailInvalid')
      }
    }

    if (name === 'password' && formData.password) {
      if (formData.password.length < 6) {
        errors.password = t('validation.passwordMinLength')
      }
    }

    setValidationErrors((prev) => ({ ...prev, ...errors }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      const result = await login(formData).unwrap()
      dispatch(setUser(result.user))
      router.push('/')
    } catch (err: any) {
      // Trigger shake animation on error
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 400)

      console.error('Login failed:', err)
      // Error handling is done via RTK Query error state
    }
  }

  // Parse error message from API
  const getErrorMessage = () => {
    if (!error) return null

    if ('status' in error) {
      if (error.status === 401) {
        return t('errors.invalidCredentials')
      }
      if (error.status === 423) {
        return t('errors.accountLocked')
      }
      if (error.status === 403) {
        return t('errors.unauthorized')
      }
      if ('data' in error && typeof error.data === 'object' && error.data !== null) {
        const data = error.data as any
        if (data.message) {
          return data.message
        }
      }
      return t('errors.loginFailed')
    }

    return t('errors.networkError')
  }

  const errorMessage = getErrorMessage()

  return (
    <div className="min-h-screen bg-background-base flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Title Section */}
        <div className="text-center" >
          <h1 className="text-apple-large-title text-text-primary mb-2">
            {t('title')}
          </h1>
          <p className="text-apple-body text-text-secondary">
            {t('subtitle')}
          </p>
        </div>

        {/* Login Form Card */}
        <div
          className={cn(
            'bg-bg-elevated rounded-2xl shadow-apple-card border border-border-light p-8',
            shouldShake && 'animate-shake'
          )}
        >
          <form onSubmit={handleSubmit} className="space-y-6" >
            {/* Global Error Message */}
            {errorMessage && (
              <Alert variant="error">
                {errorMessage}
              </Alert>
            )}

            {/* Email Field */}
            <Input
              label={t('form.email')}
              name="email"
              type="email"
              icon={<FiMail className="w-5 h-5" />}
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={validationErrors.email}
              placeholder="example@domain.com"
              autoComplete="email"
              required
              disabled={isLoading}
              dir="ltr"
            />

            {/* Password Field */}
            <div>
              <Input
                label={t('form.password')}
                name="password"
                type="password"
                icon={<FiLock className="w-5 h-5" />}
                showPasswordToggle
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={validationErrors.password}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={isLoading}
                dir="ltr"
              />

              {/* Caps Lock Warning */}
              {capsLockOn && (
                <div className="flex items-center gap-2 text-warning-text text-sm mt-2" >
                  <FiAlertTriangle className="w-4 h-4" />
                  <span>{t('capsLockWarning')}</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-out active-scale-apple"
            >
              {/* Loading spinner overlay */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Button text - hide when loading to prevent layout shift */}
              <span className={`transition-opacity duration-200 ${isLoading ? 'opacity-0' : ''}`}>
                {t('form.submit')}
              </span>
            </button>
          </form>
        </div>

        {/* Back to Home Link */}
        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="text-accent hover:text-accent-hover text-sm font-medium transition-colors"
          >
            {t('backToHome')}
          </button>
        </div>
      </div>
    </div>
  )
}
