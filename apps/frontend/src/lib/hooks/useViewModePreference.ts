import { useState, useEffect } from 'react'

export type ViewMode = 'single' | 'dual'

const STORAGE_KEY = 'mobileViewMode'

/**
 * Hook to manage mobile view mode preference with localStorage persistence
 * Handles SSR-safe localStorage access and gracefully handles storage errors
 */
export const useViewModePreference = () => {
  const [mobileViewMode, setMobileViewMode] = useState<ViewMode>('single')

  // Load view mode from localStorage (SSR-safe)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'single' || saved === 'dual') {
        setMobileViewMode(saved as ViewMode)
      }
    } catch (error) {
      // Silently fail and use default 'single' mode
      // This handles Safari Private Browsing and disabled storage
      console.warn('Failed to load view mode preference:', error)
    }
  }, [])

  // Save view mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mobileViewMode)
    } catch (error) {
      // Silently fail - preference won't persist but app still works
      console.warn('Failed to save view mode preference:', error)
    }
  }, [mobileViewMode])

  return {
    mobileViewMode,
    setMobileViewMode,
  }
}
