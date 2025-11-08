'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useChangePasswordMutation } from '@/lib/store/services/authApi'
import { Input, Alert } from '@/components/ui'
import { FiLock, FiCheck, FiAlertTriangle } from 'react-icons/fi'
import { useCapsLock } from '@/hooks/useCapsLock'

interface ChangePasswordProps {
  onBack: () => void
}

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

export function ChangePassword({ onBack }: ChangePasswordProps) {
  const t = useTranslations('ChangePassword')
  const [changePassword, { isLoading, error, isSuccess }] = useChangePasswordMutation()
  const capsLockOn = useCapsLock()

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [validationErrors, setValidationErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})

  const [successMessage, setSuccessMessage] = useState('')

  // Show success message and reset form when password change is successful
  useEffect(() => {
    if (isSuccess) {
      setSuccessMessage(t('success'))
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setTimeout(() => {
        setSuccessMessage('')
        onBack()
      }, 2000)
    }
  }, [isSuccess, onBack, t])

  const validateForm = () => {
    const errors: {
      currentPassword?: string
      newPassword?: string
      confirmPassword?: string
    } = {}

    if (!formData.currentPassword) {
      errors.currentPassword = t('currentPasswordRequired')
    }

    if (!formData.newPassword) {
      errors.newPassword = t('newPasswordRequired')
    } else if (formData.newPassword.length < 8) {
      errors.newPassword = t('newPasswordMinLength')
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      errors.newPassword = t('newPasswordComplexity')
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = t('confirmPasswordRequired')
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = t('passwordsDoNotMatch')
    }

    if (formData.currentPassword && formData.newPassword) {
      if (formData.currentPassword === formData.newPassword) {
        errors.newPassword = t('sameAsCurrentPassword')
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setValidationErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      }).unwrap()
    } catch (err) {
      console.error('Password change failed:', err)
    }
  }

  const getErrorMessage = () => {
    if (!error) return null

    if ('status' in error) {
      if (error.status === 401) {
        return t('errorIncorrectPassword')
      }
      if (error.status === 400) {
        return t('errorInvalidPassword')
      }
      if ('data' in error && typeof error.data === 'object' && error.data !== null) {
        const data = error.data as any
        if (data.message) {
          return data.message
        }
      }
      return t('errorGeneric')
    }

    return t('errorNetwork')
  }

  const errorMessage = getErrorMessage()

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '' }

    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++

    const labels = [
      t('passwordStrengthWeak'),
      t('passwordStrengthFair'),
      t('passwordStrengthGood'),
      t('passwordStrengthStrong'),
      t('passwordStrengthExcellent')
    ]
    return { strength, label: labels[strength - 1] || '' }
  }

  const passwordStrength = getPasswordStrength(formData.newPassword)

  return (
    <div className="space-y-6" >
      {/* Success Message */}
      {successMessage && (
        <Alert variant="success" className="animate-success-pulse">
          {successMessage}
        </Alert>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="error">
          {errorMessage}
        </Alert>
      )}

      {/* Password Requirements */}
      <div className="bg-bg-base rounded-lg border border-border-light p-4">
        <h4 className="text-sm font-medium text-text-primary mb-2">
          {t('requirementsTitle')}
        </h4>
        <ul className="space-y-1 text-xs text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="text-text-tertiary">•</span>
            {t('requirement8chars')}
          </li>
          <li className="flex items-center gap-2">
            <span className="text-text-tertiary">•</span>
            {t('requirementUpperLower')}
          </li>
          <li className="flex items-center gap-2">
            <span className="text-text-tertiary">•</span>
            {t('requirementNumber')}
          </li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <Input
            label={t('currentPassword')}
            name="currentPassword"
            type="password"
            icon={<FiLock className="w-5 h-5" />}
            showPasswordToggle
            value={formData.currentPassword}
            onChange={handleChange}
            error={validationErrors.currentPassword}
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

        {/* New Password */}
        <div>
          <Input
            label={t('newPassword')}
            name="newPassword"
            type="password"
            icon={<FiLock className="w-5 h-5" />}
            showPasswordToggle
            value={formData.newPassword}
            onChange={handleChange}
            error={validationErrors.newPassword}
            placeholder="••••••••"
            autoComplete="new-password"
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

          {/* Password Strength Indicator - Enhanced */}
          {formData.newPassword && (
            <div className="space-y-3 animate-slide-down-fade mt-3" >
              {/* Strength Bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300 ease-out',
                      passwordStrength.strength === 1 && 'bg-red-500',
                      passwordStrength.strength === 2 && 'bg-orange-500',
                      passwordStrength.strength === 3 && 'bg-yellow-500',
                      passwordStrength.strength === 4 && 'bg-green-500',
                      passwordStrength.strength === 5 && 'bg-green-600'
                    )}
                    style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs font-semibold min-w-[3rem] text-right',
                    passwordStrength.strength === 1 && 'text-red-600 dark:text-red-400',
                    passwordStrength.strength === 2 && 'text-orange-600 dark:text-orange-400',
                    passwordStrength.strength === 3 && 'text-yellow-600 dark:text-yellow-500',
                    passwordStrength.strength === 4 && 'text-green-600 dark:text-green-500',
                    passwordStrength.strength === 5 && 'text-green-700 dark:text-green-400'
                  )}
                >
                  {passwordStrength.label}
                </span>
              </div>

              {/* Requirements Checklist */}
              <div className="space-y-2 text-xs">
                <RequirementItem
                  met={formData.newPassword.length >= 8}
                  label={t('requirement8chars')}
                />
                <RequirementItem
                  met={/[a-z]/.test(formData.newPassword) && /[A-Z]/.test(formData.newPassword)}
                  label={t('requirementUpperLower')}
                />
                <RequirementItem
                  met={/\d/.test(formData.newPassword)}
                  label={t('requirementNumber')}
                />
                <RequirementItem
                  met={/[^a-zA-Z0-9]/.test(formData.newPassword)}
                  label={t('requirementSpecial')}
                  optional={t('optional')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Confirm New Password */}
        <div className="relative">
          <Input
            label={t('confirmPassword')}
            name="confirmPassword"
            type="password"
            icon={<FiLock className="w-5 h-5" />}
            showPasswordToggle
            value={formData.confirmPassword}
            onChange={handleChange}
            error={validationErrors.confirmPassword}
            placeholder="••••••••"
            autoComplete="new-password"
            required
            disabled={isLoading}
            dir="ltr"
          />

          {/* Password match indicator */}
          {formData.confirmPassword &&
           formData.newPassword &&
           formData.confirmPassword === formData.newPassword &&
           !validationErrors.confirmPassword && (
            <div className="absolute top-1/2 -translate-y-1/2 left-12 pointer-events-none">
              <div className="flex items-center gap-1.5 text-success-text">
                <FiCheck className="w-4 h-4" />
                <span className="text-xs font-medium">{t('passwordMatch')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="relative w-full flex justify-center items-center py-3 px-4 rounded-lg text-base font-medium text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-out active-scale-apple"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <span className={`transition-opacity duration-200 ${isLoading ? 'opacity-0' : ''}`}>
            {t('submit')}
          </span>
        </button>
      </form>
    </div>
  )
}

// RequirementItem component for password checklist
interface RequirementItemProps {
  met: boolean
  label: string
  optional?: string
}

const RequirementItem: React.FC<RequirementItemProps> = ({ met, label, optional }) => (
  <div className="flex items-center gap-2">
    <div
      className={cn(
        'w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200',
        met
          ? 'bg-success-text text-white'
          : 'bg-bg-secondary text-text-tertiary'
      )}
    >
      {met ? (
        <FiCheck className="w-2.5 h-2.5" />
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      )}
    </div>
    <span
      className={cn(
        'transition-colors duration-200',
        met ? 'text-text-primary' : 'text-text-secondary'
      )}
    >
      {label}
      {optional && (
        <span className="text-text-tertiary mr-1">{optional}</span>
      )}
    </span>
  </div>
)
