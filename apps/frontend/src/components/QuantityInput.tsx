'use client'

import React from 'react'

interface QuantityInputProps {
  value?: number
  onChange?: (value: number) => void
  placeholder?: string
  compact?: boolean
}

export const QuantityInput: React.FC<QuantityInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  compact = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value

    // Allow empty string for clearing
    if (inputValue === '') {
      onChange?.(0)
      return
    }

    // Parse and validate number
    const numValue = parseFloat(inputValue)
    if (!isNaN(numValue) && numValue >= 0) {
      onChange?.(numValue)
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all text on focus for easy replacement
    e.target.select()
  }

  return (
    <div className="h-full ">
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        min="0"
        step="any"
        className={`
          ${compact ? 'w-16 text-2xl' : 'w-24 text-3xl'}
          
          font-semibold
          bg-surface-elevated
          border-2
          rounded-lg
          px-2
          py-4
          text-center
          text-text-primary
          placeholder:text-text-tertiary
          focus:outline-none
          focus:ring-2
          focus:ring-accent
          focus:border-accent
          transition-colors
          [appearance:textfield]
          [&::-webkit-outer-spin-button]:appearance-none
          [&::-webkit-inner-spin-button]:appearance-none
        `}
      />
    </div>
  )
}
