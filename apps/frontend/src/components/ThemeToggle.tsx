'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { FiSun, FiMoon, FiMonitor } from 'react-icons/fi'

/**
 * ThemeToggle - Three-state theme switcher component (Light/Dark/System)
 *
 * Features:
 * - Three theme options: Light, Dark, System
 * - Visual active state indicators
 * - Persian ARIA labels for accessibility
 * - Mounted state check to prevent hydration issues
 * - Smooth transitions between states
 * - RTL-friendly design
 */
export const ThemeToggle: React.FC = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="inline-flex rounded-lg border border-border-light bg-bg-elevated p-1 gap-1">
        <div className="w-9 h-9 rounded-lg bg-transparent" />
        <div className="w-9 h-9 rounded-lg bg-transparent" />
        <div className="w-9 h-9 rounded-lg bg-transparent" />
      </div>
    )
  }

  const buttonBaseClasses = `
    w-9 h-9
    rounded-lg
    flex items-center justify-center
    transition-apple-fast active-scale-apple
    focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-gray-900
  `

  const activeClasses = 'bg-accent text-white'
  const inactiveClasses = 'bg-transparent text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'

  return (
    <div
      className="inline-flex rounded-lg border border-border-light bg-bg-elevated p-1 gap-1 shadow-sm"
      role="group"
      aria-label="انتخاب تم"
    >
      {/* Light Theme Button */}
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`${buttonBaseClasses} ${theme === 'light' ? activeClasses : inactiveClasses}`}
        aria-label="تم روشن"
        aria-pressed={theme === 'light'}
        title="تم روشن"
      >
        <FiSun className="text-lg" aria-hidden="true" />
        <span className="sr-only">تم روشن</span>
      </button>

      {/* Dark Theme Button */}
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`${buttonBaseClasses} ${theme === 'dark' ? activeClasses : inactiveClasses}`}
        aria-label="تم تیره"
        aria-pressed={theme === 'dark'}
        title="تم تیره"
      >
        <FiMoon className="text-lg" aria-hidden="true" />
        <span className="sr-only">تم تیره</span>
      </button>

      {/* System Theme Button */}
      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`${buttonBaseClasses} ${theme === 'system' ? activeClasses : inactiveClasses}`}
        aria-label="تم سیستم"
        aria-pressed={theme === 'system'}
        title="تم سیستم"
      >
        <FiMonitor className="text-lg" aria-hidden="true" />
        <span className="sr-only">تم سیستم</span>
      </button>
    </div>
  )
}

ThemeToggle.displayName = 'ThemeToggle'
