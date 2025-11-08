'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAppSelector, useAppDispatch } from '@/lib/hooks'
import { selectUser } from '@/lib/store/slices/authSlice'
import { updateUser } from '@/lib/store/slices/authSlice'
import { useUpdateProfileMutation } from '@/lib/store/services/authApi'
import { Input, Alert } from '@/components/ui'
import { FiUser, FiMail } from 'react-icons/fi'

interface ProfileEditProps {
  onBack: () => void
}

// cn utility for conditional classes
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter((c) => typeof c === 'string' && c.length > 0).join(' ')
}

export function ProfileEdit({ onBack }: ProfileEditProps) {
  const t = useTranslations('Profile')
  const user = useAppSelector(selectUser)
  const dispatch = useAppDispatch()
  const [updateProfile, { isLoading, error, isSuccess }] = useUpdateProfileMutation()

  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  })

  const [validationErrors, setValidationErrors] = useState<{
    firstName?: string
    lastName?: string
  }>({})

  const [successMessage, setSuccessMessage] = useState('')

  // Show success message when update is successful
  useEffect(() => {
    if (isSuccess) {
      setSuccessMessage(t('updateSuccess'))
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
    }
  }, [isSuccess, t])

  const validateForm = () => {
    const errors: { firstName?: string; lastName?: string } = {}

    if (formData.firstName && formData.firstName.length < 2) {
      errors.firstName = t('firstNameMinLength')
    }

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
      return
    }

    try {
      const result = await updateProfile(formData).unwrap()
      dispatch(updateUser(result))
    } catch (err) {
      console.error('Profile update failed:', err)
    }
  }

  const getErrorMessage = () => {
    if (!error) return null

    if ('status' in error) {
      if (error.status === 401) {
        return t('errorUnauthorized')
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
  const hasChanges =
    formData.firstName !== (user?.firstName || '') ||
    formData.lastName !== (user?.lastName || '')

  // Show skeleton loader while loading
  if (isLoading && !user) {
    return (
      <div className="space-y-6" >
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" /> {/* Label */}
          <Skeleton className="h-12 w-full" /> {/* Input */}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-12 w-full" /> {/* Button */}
      </div>
    )
  }

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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email (Read-only) */}
        <Input
          label={t('email')}
          name="email"
          type="email"
          icon={<FiMail className="w-5 h-5" />}
          value={user?.email || ''}
          disabled
          hint={t('emailReadOnly')}
          dir="ltr"
        />

        {/* First Name */}
        <Input
          label={t('firstName')}
          name="firstName"
          type="text"
          icon={<FiUser className="w-5 h-5" />}
          value={formData.firstName}
          onChange={handleChange}
          error={validationErrors.firstName}
          placeholder={t('firstNamePlaceholder')}
          disabled={isLoading}
        />

        {/* Last Name */}
        <Input
          label={t('lastName')}
          name="lastName"
          type="text"
          icon={<FiUser className="w-5 h-5" />}
          value={formData.lastName}
          onChange={handleChange}
          error={validationErrors.lastName}
          placeholder={t('lastNamePlaceholder')}
          disabled={isLoading}
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !hasChanges}
          className="relative w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg text-base font-medium text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-out active-scale-apple"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <span className={`transition-opacity duration-200 ${isLoading ? 'opacity-0' : ''}`}>
            {t('save')}
          </span>
        </button>
      </form>
    </div>
  )
}

// Skeleton component for loading states
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse bg-bg-secondary rounded', className)} />
)
