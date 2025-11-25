/**
 * PDF Font Loader for jsPDF
 *
 * This module handles loading custom fonts for Persian and Arabic text in PDFs.
 * Supports both Vazirmatn (Persian) and Amiri (Arabic) fonts.
 */

import type { jsPDF } from 'jspdf'

// Track which fonts have been loaded
const loadedFonts = {
  vazirmatn: false,
  amiri: false,
}

/**
 * Loads custom fonts into jsPDF for Persian/Arabic support
 *
 * @param doc - jsPDF instance
 * @returns Promise that resolves with loaded font info
 */
export async function loadCustomFonts(doc: jsPDF): Promise<{ persian: boolean; arabic: boolean }> {
  // If both fonts already loaded, return early
  if (loadedFonts.vazirmatn && loadedFonts.amiri) {
    return { persian: true, arabic: true }
  }

  try {
    // Load both fonts in parallel
    const [persianResponse, arabicResponse] = await Promise.all([
      fetch('/fonts/Vazirmatn-normal.js').catch(() => null),
      fetch('/fonts/Amiri-normal.js').catch(() => null),
    ])

    // Load Persian font (Vazirmatn)
    if (persianResponse && persianResponse.ok && !loadedFonts.vazirmatn) {
      try {
        const fontScript = await persianResponse.text()
        // Font scripts from jsPDF converter are safe - they only register fonts
        const loadFont = new Function(fontScript)
        loadFont()
        loadedFonts.vazirmatn = true
        console.log('✅ Persian font (Vazirmatn) loaded successfully')
      } catch (error) {
        console.error('Failed to load Persian font:', error)
      }
    }

    // Load Arabic font (Amiri)
    if (arabicResponse && arabicResponse.ok && !loadedFonts.amiri) {
      try {
        const fontScript = await arabicResponse.text()
        const loadFont = new Function(fontScript)
        loadFont()
        loadedFonts.amiri = true
        console.log('✅ Arabic font (Amiri) loaded successfully')
      } catch (error) {
        console.error('Failed to load Arabic font:', error)
      }
    }

    // Show warnings for missing fonts
    if (!loadedFonts.vazirmatn && !loadedFonts.amiri) {
      console.warn('⚠️  No custom fonts found. Persian/Arabic text may not display correctly.')
      console.warn('📖 To fix: Follow instructions in apps/frontend/src/lib/utils/fonts/README.md')
    } else if (!loadedFonts.vazirmatn) {
      console.warn('⚠️  Persian font (Vazirmatn) not found. Persian text may not display correctly.')
    } else if (!loadedFonts.amiri) {
      console.warn('⚠️  Arabic font (Amiri) not found. Arabic text may not display correctly.')
    }

    return { persian: loadedFonts.vazirmatn, arabic: loadedFonts.amiri }
  } catch (error) {
    console.error('Error loading custom fonts:', error)
    return { persian: false, arabic: false }
  }
}

/**
 * Configures jsPDF to use the appropriate font based on locale
 *
 * @param doc - jsPDF instance
 * @param locale - Target locale (fa, ar, en)
 */
export function setFontForLocale(doc: jsPDF, locale: string): void {
  if (locale === 'fa' && loadedFonts.vazirmatn) {
    try {
      doc.setFont('Vazirmatn', 'normal')
    } catch (error) {
      console.warn('Could not set Vazirmatn font, using default')
      doc.setFont('helvetica', 'normal')
    }
  } else if (locale === 'ar' && loadedFonts.amiri) {
    try {
      doc.setFont('Amiri', 'normal')
    } catch (error) {
      console.warn('Could not set Amiri font, using default')
      doc.setFont('helvetica', 'normal')
    }
  } else {
    doc.setFont('helvetica', 'normal')
  }
}

/**
 * Check if custom fonts are available for a specific locale
 *
 * @param locale - Target locale (fa, ar, en)
 * @returns true if appropriate font is loaded
 */
export function areFontsAvailable(locale?: string): boolean {
  if (!locale) {
    return loadedFonts.vazirmatn || loadedFonts.amiri
  }

  if (locale === 'fa') {
    return loadedFonts.vazirmatn
  } else if (locale === 'ar') {
    return loadedFonts.amiri
  }

  return true // English doesn't need custom fonts
}
