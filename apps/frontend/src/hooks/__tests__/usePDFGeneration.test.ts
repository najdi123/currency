import { renderHook, waitFor, act } from '@testing-library/react'

// Mock the locale hook
jest.mock('next-intl', () => ({
  useLocale: jest.fn(() => 'en'),
}))

// Mock the PDF utilities
const mockGenerateCalculatorPDF = jest.fn()
const mockLoadPDFTranslations = jest.fn()

jest.mock('@/lib/utils/pdfGenerator', () => ({
  generateCalculatorPDF: (...args: unknown[]) => mockGenerateCalculatorPDF(...args),
}))

jest.mock('@/lib/utils/pdfTranslations', () => ({
  loadPDFTranslations: (...args: unknown[]) => mockLoadPDFTranslations(...args),
}))

// Import after mocking
import { usePDFGeneration } from '../usePDFGeneration'
import { useLocale } from 'next-intl'
import type { CalculatorItem } from '@/lib/store/slices/calculatorSlice'

describe('usePDFGeneration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockLoadPDFTranslations.mockResolvedValue({
      title: 'Test Title',
      items: 'Items',
    })
    mockGenerateCalculatorPDF.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  const mockItems: CalculatorItem[] = [
    {
      id: '1',
      type: 'currency',
      subType: 'USD',
      unitPrice: 50000,
      quantity: 10,
      name: 'US Dollar',
      totalValue: 500000,
    },
  ]

  const defaultOptions = {
    items: mockItems,
    totalValue: 500000,
    currentDate: '2025-01-15' as string | undefined,
  }

  describe('Initial State', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      expect(result.current.isGeneratingPDF).toBe(false)
      expect(result.current.pdfError).toBeNull()
      expect(typeof result.current.handleSaveAsPDF).toBe('function')
      expect(typeof result.current.clearPdfError).toBe('function')
    })

    it('should have correct return type structure', () => {
      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      expect(result.current).toHaveProperty('isGeneratingPDF')
      expect(result.current).toHaveProperty('pdfError')
      expect(result.current).toHaveProperty('handleSaveAsPDF')
      expect(result.current).toHaveProperty('clearPdfError')
    })
  })

  describe('PDF Generation - Success', () => {
    it('should set loading state during PDF generation', async () => {
      mockGenerateCalculatorPDF.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      expect(result.current.isGeneratingPDF).toBe(false)

      let generatePromise: Promise<void>
      act(() => {
        generatePromise = result.current.handleSaveAsPDF()
      })

      expect(result.current.isGeneratingPDF).toBe(true)

      await act(async () => {
        jest.advanceTimersByTime(100)
        await generatePromise
      })

      expect(result.current.isGeneratingPDF).toBe(false)
    })

    it('should load translations for the current locale', async () => {
      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(mockLoadPDFTranslations).toHaveBeenCalledWith('en')
    })

    it('should load translations for a custom language when specified', async () => {
      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF('fa')
      })

      expect(mockLoadPDFTranslations).toHaveBeenCalledWith('fa')
    })

    it('should call generateCalculatorPDF with correct parameters', async () => {
      const translations = { title: 'Test', items: 'Items' }
      mockLoadPDFTranslations.mockResolvedValue(translations)

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(mockGenerateCalculatorPDF).toHaveBeenCalledWith({
        items: mockItems,
        totalValue: 500000,
        currentDate: '2025-01-15',
        locale: 'en',
        pdfLanguage: 'en',
        translations,
      })
    })

    it('should call generateCalculatorPDF with custom language', async () => {
      const translations = { title: 'Test', items: 'Items' }
      mockLoadPDFTranslations.mockResolvedValue(translations)

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF('ar')
      })

      expect(mockGenerateCalculatorPDF).toHaveBeenCalledWith({
        items: mockItems,
        totalValue: 500000,
        currentDate: '2025-01-15',
        locale: 'en',
        pdfLanguage: 'ar',
        translations,
      })
    })

    it('should clear previous error before generating', async () => {
      mockGenerateCalculatorPDF.mockRejectedValueOnce(new Error('First error'))

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      // First call - should fail
      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(result.current.pdfError).toBe('First error')

      // Reset mock for success
      mockGenerateCalculatorPDF.mockResolvedValue(undefined)

      // Second call - should clear error
      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(result.current.pdfError).toBeNull()
    })
  })

  describe('PDF Generation - Error Handling', () => {
    it('should set error message when generation fails with Error', async () => {
      mockGenerateCalculatorPDF.mockRejectedValue(new Error('PDF generation failed'))

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(result.current.pdfError).toBe('PDF generation failed')
      expect(result.current.isGeneratingPDF).toBe(false)
    })

    it('should set default error message when generation fails with non-Error', async () => {
      mockGenerateCalculatorPDF.mockRejectedValue('Unknown error')

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(result.current.pdfError).toBe('Failed to generate PDF. Please try again.')
    })

    it('should auto-clear error after 5 seconds', async () => {
      mockGenerateCalculatorPDF.mockRejectedValue(new Error('Test error'))

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(result.current.pdfError).toBe('Test error')

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      expect(result.current.pdfError).toBeNull()
    })

    it('should not auto-clear error before 5 seconds', async () => {
      mockGenerateCalculatorPDF.mockRejectedValue(new Error('Test error'))

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(result.current.pdfError).toBe('Test error')

      act(() => {
        jest.advanceTimersByTime(4999)
      })

      expect(result.current.pdfError).toBe('Test error')
    })

    it('should handle translation loading errors', async () => {
      mockLoadPDFTranslations.mockRejectedValue(new Error('Translation load failed'))

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(result.current.pdfError).toBe('Translation load failed')
      expect(result.current.isGeneratingPDF).toBe(false)
    })
  })

  describe('Error Clearing', () => {
    it('should clear error when clearPdfError is called', async () => {
      mockGenerateCalculatorPDF.mockRejectedValue(new Error('Test error'))

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(result.current.pdfError).toBe('Test error')

      act(() => {
        result.current.clearPdfError()
      })

      expect(result.current.pdfError).toBeNull()
    })

    it('should handle clearing when no error exists', () => {
      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      expect(result.current.pdfError).toBeNull()

      act(() => {
        result.current.clearPdfError()
      })

      expect(result.current.pdfError).toBeNull()
    })
  })

  describe('Dependencies', () => {
    it('should use updated items when they change', async () => {
      const { result, rerender } = renderHook(
        (props) => usePDFGeneration(props),
        { initialProps: defaultOptions }
      )

      const newItems: CalculatorItem[] = [
        {
          id: '2',
          type: 'gold',
          subType: '18ayar',
          unitPrice: 3000000,
          quantity: 5,
          name: '18K Gold',
          totalValue: 15000000,
        },
      ]

      rerender({ ...defaultOptions, items: newItems, totalValue: 15000000 })

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(mockGenerateCalculatorPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          items: newItems,
          totalValue: 15000000,
        })
      )
    })

    it('should use updated currentDate when it changes', async () => {
      const { result, rerender } = renderHook(
        (props) => usePDFGeneration(props),
        { initialProps: defaultOptions }
      )

      rerender({ ...defaultOptions, currentDate: '2025-01-20' })

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(mockGenerateCalculatorPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          currentDate: '2025-01-20',
        })
      )
    })

    it('should handle undefined currentDate', async () => {
      const { result } = renderHook(() =>
        usePDFGeneration({
          ...defaultOptions,
          currentDate: undefined,
        })
      )

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(mockGenerateCalculatorPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          currentDate: undefined,
        })
      )
    })
  })

  describe('Locale Handling', () => {
    it('should use locale from next-intl hook', async () => {
      ;(useLocale as jest.Mock).mockReturnValue('fa')

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF()
      })

      expect(mockGenerateCalculatorPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'fa',
          pdfLanguage: 'fa',
        })
      )
    })

    it('should allow overriding pdfLanguage while keeping locale', async () => {
      ;(useLocale as jest.Mock).mockReturnValue('fa')

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      await act(async () => {
        await result.current.handleSaveAsPDF('en')
      })

      expect(mockGenerateCalculatorPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'fa',
          pdfLanguage: 'en',
        })
      )
    })
  })

  describe('Concurrent Calls', () => {
    it('should handle rapid consecutive calls', async () => {
      let resolveFirst: (() => void) | undefined
      let resolveSecond: (() => void) | undefined

      mockGenerateCalculatorPDF
        .mockImplementationOnce(
          () => new Promise<void>((resolve) => { resolveFirst = resolve })
        )
        .mockImplementationOnce(
          () => new Promise<void>((resolve) => { resolveSecond = resolve })
        )

      const { result } = renderHook(() => usePDFGeneration(defaultOptions))

      let promise1: Promise<void>
      let promise2: Promise<void>

      act(() => {
        promise1 = result.current.handleSaveAsPDF()
      })

      expect(result.current.isGeneratingPDF).toBe(true)

      act(() => {
        promise2 = result.current.handleSaveAsPDF()
      })

      // Should still be generating
      expect(result.current.isGeneratingPDF).toBe(true)

      // Resolve both
      await act(async () => {
        resolveFirst?.()
        await promise1
      })

      await act(async () => {
        resolveSecond?.()
        await promise2
      })

      expect(result.current.isGeneratingPDF).toBe(false)
    })
  })
})
