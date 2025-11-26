'use client'

import { useState, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { generateCalculatorPDF } from '@/lib/utils/pdfGenerator'
import { loadPDFTranslations } from '@/lib/utils/pdfTranslations'
import type { CalculatorItem } from '@/lib/store/slices/calculatorSlice'

interface UsePDFGenerationOptions {
  items: CalculatorItem[]
  totalValue: number
  currentDate: string | undefined
}

interface UsePDFGenerationReturn {
  /** Whether PDF generation is currently in progress */
  isGeneratingPDF: boolean
  /** Error message if PDF generation failed */
  pdfError: string | null
  /** Generate and download PDF, optionally in a specific language */
  handleSaveAsPDF: (pdfLanguage?: string) => Promise<void>
  /** Clear the current error */
  clearPdfError: () => void
}

/** Duration to show error notification before auto-clearing */
const ERROR_AUTO_CLEAR_DURATION = 5000

/**
 * Hook to manage PDF generation state and logic.
 *
 * Handles:
 * - Loading state during generation
 * - Error handling with auto-clear
 * - Dynamic translation loading for multi-language PDFs
 * - Cleanup of error state
 *
 * @param options - Calculator items, total, and date for the PDF
 * @returns PDF generation state and handlers
 */
export function usePDFGeneration({
  items,
  totalValue,
  currentDate,
}: UsePDFGenerationOptions): UsePDFGenerationReturn {
  const locale = useLocale()

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  /**
   * Clear the PDF error
   */
  const clearPdfError = useCallback(() => {
    setPdfError(null)
  }, [])

  /**
   * Generate and download PDF
   * @param pdfLanguage - Optional language override for the PDF content
   */
  const handleSaveAsPDF = useCallback(
    async (pdfLanguage?: string) => {
      // Clear previous error
      setPdfError(null)

      // Set loading state
      setIsGeneratingPDF(true)

      try {
        // Determine target language for PDF (can be different from current UI language)
        const targetLang = pdfLanguage || locale

        // Load translations dynamically for the target language
        const translations = await loadPDFTranslations(targetLang)

        await generateCalculatorPDF({
          items,
          totalValue,
          currentDate,
          locale,
          pdfLanguage: targetLang,
          translations,
        })

        // Success - PDF downloaded (no console.log for production)
      } catch (error) {
        // Set user-friendly error message
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to generate PDF. Please try again.'

        setPdfError(errorMessage)

        // Auto-clear error after delay
        setTimeout(() => setPdfError(null), ERROR_AUTO_CLEAR_DURATION)
      } finally {
        // Clear loading state
        setIsGeneratingPDF(false)
      }
    },
    [items, totalValue, currentDate, locale]
  )

  return {
    isGeneratingPDF,
    pdfError,
    handleSaveAsPDF,
    clearPdfError,
  }
}
