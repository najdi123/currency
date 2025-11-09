'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRegisterMutation } from '@/lib/store/services/authApi'
import { useAppSelector } from '@/lib/hooks'
import { selectUser } from '@/lib/store/slices/authSlice'
import { Input, Alert, SegmentedControl } from '@/components/ui'
import { FiMail, FiLock, FiUser, FiShield, FiCheck, FiAlertTriangle, FiArrowRight } from 'react-icons/fi'
import { useCapsLock } from '@/hooks/useCapsLock'

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

interface UserFormData {
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  role: 'user' | 'admin'
}

interface ValidationErrors {
  email?: string
  password?: string
  confirmPassword?: string
  firstName?: string
  lastName?: string
}

export default function RegisterUserPage() {
  const router = useRouter()
  const t = useTranslations('Admin')
  const tCommon = useTranslations('Common')
  const tChangePassword = useTranslations('ChangePassword')
  const user = useAppSelector(selectUser)
  const [register, { isLoading, error, isSuccess }] = useRegisterMutation()
  const capsLockOn = useCapsLock()

  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'user',
  })

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [shouldShake, setShouldShake] = useState(false)

  // Admin role guard - redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/')
    }
  }, [user, router])

  // Handle success - show message, wait, then reset form
  useEffect(() => {
    if (isSuccess) {
      setSuccessMessage(t('userCreatedSuccess', { email: formData.email }))

      setTimeout(() => {
        setSuccessMessage('')
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          firstName: '',
          lastName: '',
          role: 'user',
        })
        // Focus on email field
        const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement
        if (emailInput) {
          emailInput.focus()
        }
      }, 2000)
    }
  }, [isSuccess, formData.email])

  const validateForm = () => {
    const errors: ValidationErrors = {}

    // Email validation
    if (!formData.email) {
      errors.email = t('emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('emailInvalid')
    }

    // Password validation
    if (!formData.password) {
      errors.password = t('passwordRequired')
    } else if (formData.password.length < 8) {
      errors.password = t('passwordMinLength')
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = t('passwordComplexity')
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = t('confirmPasswordRequired')
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t('passwordsDoNotMatch')
    }

    // First name validation (optional, but if provided must be valid)
    if (formData.firstName && formData.firstName.length < 2) {
      errors.firstName = t('firstNameMinLength')
    }

    // Last name validation (optional, but if provided must be valid)
    if (formData.lastName && formData.lastName.length < 2) {
      errors.lastName = t('lastNameMinLength')
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
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 400)
      return
    }

    try {
      // Build request body (exclude confirmPassword, include only provided optional fields)
      const requestBody: {
        email: string
        password: string
        firstName?: string
        lastName?: string
        role: 'user' | 'admin'
      } = {
        email: formData.email,
        password: formData.password,
        role: formData.role,
      }

      if (formData.firstName) {
        requestBody.firstName = formData.firstName
      }
      if (formData.lastName) {
        requestBody.lastName = formData.lastName
      }

      await register(requestBody).unwrap()
    } catch (err) {
      setShouldShake(true)
      setTimeout(() => setShouldShake(false), 400)
      console.error('Registration failed:', err)
    }
  }

  const getErrorMessage = () => {
    if (!error) return null

    if ('status' in error) {
      if (error.status === 400) {
        return t('invalidData')
      }
      if (error.status === 401) {
        return t('notAuthorized')
      }
      if (error.status === 403) {
        return t('accessForbidden')
      }
      if (error.status === 409) {
        return t('emailAlreadyExists')
      }
      if (error.status === 500) {
        return t('serverError')
      }
      if ('data' in error && typeof error.data === 'object' && error.data !== null) {
        const data = error.data as any
        if (data.message) {
          return data.message
        }
      }
      return t('registrationError')
    }

    return t('unexpectedError')
  }

  const errorMessage = getErrorMessage()

  // Password strength indicator (reused from ChangePassword)
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

  const passwordStrength = getPasswordStrength(formData.password)

  // Password match indicator
  const passwordsMatch =
    formData.confirmPassword &&
    formData.password &&
    formData.confirmPassword === formData.password &&
    !validationErrors.confirmPassword

  // Don't render if user is not an admin
  if (user && user.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-background-base">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8" >
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
          >
            <FiArrowRight className="w-5 h-5" />
            <span className="text-sm font-medium">{t('back')}</span>
          </button>
          <h1 className="text-apple-large-title text-text-primary mb-2">
            {t('registerNewUser')}
          </h1>
          <p className="text-apple-body text-text-secondary">
            {t('createUserAccount')}
          </p>
        </div>

        {/* Form Card */}
        <div
          className={cn(
            'bg-bg-elevated rounded-3xl border border-border-light p-8',
            shouldShake && 'animate-shake'
          )}
        >
          {/* Success Message */}
          {successMessage && (
            <Alert variant="success" className="mb-6 animate-slide-down-fade">
              {successMessage}
            </Alert>
          )}

          {/* Error Message */}
          {errorMessage && (
            <Alert variant="error" className="mb-6">
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" >
            {/* Email Field */}
            <Input
              label={t('email')}
              name="email"
              type="email"
              icon={<FiMail className="w-5 h-5" />}
              value={formData.email}
              onChange={handleChange}
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
                label={t('password')}
                name="password"
                type="password"
                icon={<FiLock className="w-5 h-5" />}
                showPasswordToggle
                value={formData.password}
                onChange={handleChange}
                error={validationErrors.password}
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
                  <span>{tChangePassword('capsLockWarning')}</span>
                </div>
              )}

              {/* Password Strength Indicator */}
              {formData.password && (
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
                      met={formData.password.length >= 8}
                      label={t('requirement8chars')}
                    />
                    <RequirementItem
                      met={/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password)}
                      label={t('requirementUpperLower')}
                    />
                    <RequirementItem
                      met={/\d/.test(formData.password)}
                      label={t('requirementNumber')}
                    />
                    <RequirementItem
                      met={/[^a-zA-Z0-9]/.test(formData.password)}
                      label={t('requirementSpecial')}
                      optional
                      optionalLabel={t('optional')}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
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
              {passwordsMatch && (
                <div className="absolute top-1/2 -translate-y-1/2 left-12 pointer-events-none">
                  <div className="flex items-center gap-1.5 text-success-text">
                    <FiCheck className="w-4 h-4" />
                    <span className="text-xs font-medium">{t('passwordMatch')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* First Name Field (Optional) */}
            <Input
              label={`${t('firstName')} ${t('optional')}`}
              name="firstName"
              type="text"
              icon={<FiUser className="w-5 h-5" />}
              value={formData.firstName}
              onChange={handleChange}
              error={validationErrors.firstName}
              placeholder={t('firstName')}
              autoComplete="given-name"
              disabled={isLoading}
            />

            {/* Last Name Field (Optional) */}
            <Input
              label={`${t('lastName')} ${t('optional')}`}
              name="lastName"
              type="text"
              icon={<FiUser className="w-5 h-5" />}
              value={formData.lastName}
              onChange={handleChange}
              error={validationErrors.lastName}
              placeholder={t('lastName')}
              autoComplete="family-name"
              disabled={isLoading}
            />

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-3">
                {t('userRole')}
              </label>
              <SegmentedControl
                value={formData.role}
                onChange={(value) => setFormData((prev) => ({ ...prev, role: value as 'user' | 'admin' }))}
                options={[
                  { value: 'user', label: t('regularUser'), icon: <FiUser className="w-4 h-4" /> },
                  { value: 'admin', label: t('admin'), icon: <FiShield className="w-4 h-4" /> },
                ]}
                fullWidth
              />
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
                {t('createUserButton')}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// RequirementItem component for password checklist
interface RequirementItemProps {
  met: boolean
  label: string
  optional?: boolean
  optionalLabel?: string
}

const RequirementItem: React.FC<RequirementItemProps> = ({ met, label, optional, optionalLabel }) => (
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
      {optional && optionalLabel && (
        <span className="text-text-tertiary mr-1"> {optionalLabel}</span>
      )}
    </span>
  </div>
)
