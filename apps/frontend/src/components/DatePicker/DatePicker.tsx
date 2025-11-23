'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FiChevronLeft, FiChevronRight, FiCalendar, FiX } from 'react-icons/fi'
import { getTehranToday } from '@/lib/utils/dateUtils'
import jalaali from 'jalaali-js'

interface DatePickerProps {
  /**
   * Currently selected date
   */
  selectedDate: Date | null

  /**
   * Callback when a date is selected
   */
  onDateSelect: (date: Date) => void

  /**
   * Callback when picker is closed
   */
  onClose: () => void

  /**
   * Is the picker open?
   */
  isOpen: boolean

  /**
   * Calendar type: 'persian' or 'gregorian'
   */
  calendarType: 'persian' | 'gregorian'

  /**
   * Maximum date (defaults to today - cannot select future dates)
   */
  maxDate?: Date

  /**
   * Minimum date (optional - no restriction by default)
   */
  minDate?: Date
}

/**
 * DatePicker Component
 *
 * A beautiful, accessible date picker with:
 * - Persian calendar support (Jalali/Shamsi)
 * - Gregorian calendar support
 * - RTL support for Persian
 * - Past-only date selection
 * - Keyboard navigation
 * - Screen reader support
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onDateSelect,
  onClose,
  isOpen,
  calendarType,
  maxDate = new Date(),
  minDate, // No default minimum - allow access to any past date
}) => {
  const locale = useLocale()
  const t = useTranslations('DatePicker')
  const pickerRef = useRef<HTMLDivElement>(null)

  // Current month being displayed (defaults to selected date or today)
  const [viewDate, setViewDate] = useState<Date>(selectedDate || new Date())

  // Manual input state
  const [manualInput, setManualInput] = useState('')
  const [inputError, setInputError] = useState('')

  // Update viewDate when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate)
    }
  }, [selectedDate])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Get calendar formatter based on calendar type
  const isPersian = calendarType === 'persian'
  const localeCode = isPersian ? 'fa-IR' : 'en-US'

  // Month navigation
  const goToPreviousMonth = () => {
    const newDate = new Date(viewDate)
    newDate.setMonth(newDate.getMonth() - 1)
    setViewDate(newDate)
  }

  const goToNextMonth = () => {
    const newDate = new Date(viewDate)
    newDate.setMonth(newDate.getMonth() + 1)
    // Don't go beyond current month
    if (newDate <= maxDate) {
      setViewDate(newDate)
    }
  }

  // Get month and year in the appropriate calendar
  const monthFormatter = new Intl.DateTimeFormat(localeCode, {
    calendar: isPersian ? 'persian' : 'gregory',
    month: 'long',
    year: 'numeric',
  })

  const monthYearDisplay = monthFormatter.format(viewDate)

  // Get days in month
  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const days: Date[] = []

    // Add empty cells for days before month starts
    const firstDayOfWeek = firstDay.getDay()
    // In Persian calendar, week starts on Saturday (6), not Sunday (0)
    const startOffset = isPersian ? (firstDayOfWeek + 1) % 7 : firstDayOfWeek

    for (let i = 0; i < startOffset; i++) {
      days.push(new Date(0)) // Placeholder for empty cells
    }

    // Add all days in month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const daysInMonth = getDaysInMonth(viewDate)

  // Check if a date is selectable
  const isDateSelectable = (date: Date): boolean => {
    if (date.getTime() === 0) return false // Empty cell
    if (date > maxDate) return false // No future dates
    if (minDate && date < minDate) return false // Check minDate if provided
    return true
  }

  // Check if date is today (using Tehran timezone)
  const isToday = (date: Date): boolean => {
    const today = getTehranToday()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Check if date is selected
  const isSelected = (date: Date): boolean => {
    if (!selectedDate) return false
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  // Format day number
  const formatDay = (date: Date): string => {
    if (date.getTime() === 0) return ''

    const dayFormatter = new Intl.DateTimeFormat(localeCode, {
      calendar: isPersian ? 'persian' : 'gregory',
      day: 'numeric',
    })

    return dayFormatter.format(date)
  }

  // Weekday names
  const weekdays = isPersian
    ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] // شنبه to جمعه
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  // Handle manual input
  const handleManualInput = (value: string) => {
    setManualInput(value)
    setInputError('')

    // Expected format: YYYY-MM-DD for Gregorian, YYYY/MM/DD for Persian
    const separator = isPersian ? '/' : '-'
    const formatHint = isPersian ? 'YYYY/MM/DD' : 'YYYY-MM-DD'

    if (!value.trim()) {
      setInputError('')
      return
    }

    // Basic validation
    const parts = value.split(separator)
    if (parts.length !== 3) {
      setInputError(t('invalidFormat'))
      return
    }

    const [yearStr, monthStr, dayStr] = parts
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const day = parseInt(dayStr, 10)

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      setInputError(t('invalidDate'))
      return
    }

    // For Gregorian calendar, create date directly
    if (!isPersian) {
      if (month < 1 || month > 12) {
        setInputError(t('invalidMonth'))
        return
      }

      const date = new Date(year, month - 1, day)

      // Check if date is valid
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        setInputError(t('invalidDate'))
        return
      }

      // Check date range
      if (date > maxDate) {
        setInputError(t('futureDate'))
        return
      }

      if (minDate && date < minDate) {
        setInputError(t('tooOld'))
        return
      }

      // Valid date - update selection
      onDateSelect(date)
      onClose()
    } else {
      // For Persian calendar, convert to Gregorian using jalaali-js
      if (month < 1 || month > 12) {
        setInputError(t('invalidMonth'))
        return
      }

      // Convert Persian date to Gregorian using jalaali-js
      try {
        const gregorian = jalaali.toGregorian(year, month, day)
        const date = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd)

        if (date > maxDate) {
          setInputError(t('futureDate'))
          return
        }

        if (minDate && date < minDate) {
          setInputError(t('tooOld'))
          return
        }

        onDateSelect(date)
        onClose()
      } catch (error) {
        setInputError(t('invalidDate'))
        return
      }
    }
  }

  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleManualInput(manualInput)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={pickerRef}
        className="bg-bg-elevated rounded-2xl shadow-2xl border border-border-light max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={isPersian ? t('titlePersian') : t('titleGregorian')}
      >
        {/* Header */}
        <div className="bg-accent text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiCalendar className="text-xl" aria-hidden="true" />
            <h2 className="text-lg font-semibold">
              {isPersian ? t('titlePersian') : t('titleGregorian')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label={t('close')}
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Manual Input Section */}
        <div className="p-4 border-b border-border-light bg-bg-base">
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t('manualInput')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyPress={handleInputKeyPress}
              placeholder={isPersian ? 'YYYY/MM/DD (مثال: 1404/08/03)' : 'YYYY-MM-DD (e.g., 2025-11-23)'}
              className="flex-1 px-3 py-2 border border-border-light rounded-lg bg-bg-elevated text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
              dir="ltr"
            />
            <button
              onClick={() => handleManualInput(manualInput)}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              {t('go')}
            </button>
          </div>
          {inputError && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {inputError}
            </div>
          )}
        </div>

        {/* Month Navigation */}
        <div className="p-4 flex items-center justify-between border-b border-border-light bg-bg-base">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label={t('previousMonth')}
          >
            {isPersian ? (
              <FiChevronRight className="text-xl" />
            ) : (
              <FiChevronLeft className="text-xl" />
            )}
          </button>

          <div className="text-base font-semibold text-text-primary" dir={isPersian ? 'rtl' : 'ltr'} aria-live="polite">
            {monthYearDisplay}
          </div>

          <button
            onClick={goToNextMonth}
            disabled={viewDate.getMonth() === maxDate.getMonth() && viewDate.getFullYear() === maxDate.getFullYear()}
            className="p-2 rounded-lg hover:bg-bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label={t('nextMonth')}
          >
            {isPersian ? (
              <FiChevronLeft className="text-xl" />
            ) : (
              <FiChevronRight className="text-xl" />
            )}
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekdays.map((day, index) => (
              <div
                key={index}
                className="text-center text-xs font-medium text-text-tertiary py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((date, index) => {
              const isEmpty = date.getTime() === 0
              const selectable = isDateSelectable(date)
              const today = isToday(date)
              const selected = isSelected(date)

              return (
                <button
                  key={index}
                  onClick={() => {
                    if (selectable) {
                      onDateSelect(date)
                      onClose()
                    }
                  }}
                  disabled={!selectable || isEmpty}
                  className={`
                    aspect-square rounded-lg text-sm font-medium transition-all
                    ${isEmpty ? 'invisible' : ''}
                    ${!selectable && !isEmpty ? 'text-text-tertiary opacity-30 cursor-not-allowed' : ''}
                    ${selectable && !selected ? 'hover:bg-bg-secondary text-text-primary' : ''}
                    ${selected ? 'bg-accent text-white ring-2 ring-accent ring-offset-2' : ''}
                    ${today && !selected ? 'ring-2 ring-accent/30' : ''}
                    focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2
                  `}
                  aria-label={isEmpty ? undefined : formatDay(date)}
                  aria-current={today ? 'date' : undefined}
                  aria-pressed={selected}
                >
                  {formatDay(date)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-light bg-bg-base flex justify-between items-center">
          <button
            onClick={() => {
              onDateSelect(new Date())
              onClose()
            }}
            className="px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {t('today')}
          </button>

          <div className="text-xs text-text-tertiary">
            {t('pastOnly')}
          </div>
        </div>
      </div>
    </div>
  )
}
