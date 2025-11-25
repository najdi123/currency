import { formatToman } from './formatters'
import type { CalculatorItem } from '@/lib/store/slices/calculatorSlice'
import { loadCustomFonts, setFontForLocale, areFontsAvailable } from './pdfFonts'

interface GeneratePDFOptions {
  items: CalculatorItem[]
  totalValue: number
  currentDate?: string
  locale: string
  translations: {
    title: string
    date: string
    time: string
    items: string
    item: string
    qty: string
    unitPrice: string
    total: string
    grandTotal: string
    toman: string
    grams: string
    piece: string
    generatedBy: string
    tehranTime: string
  }
  pdfLanguage?: string // Optional: specify PDF language different from current locale
}

export const generateCalculatorPDF = async ({
  items,
  totalValue,
  currentDate,
  locale,
  translations,
  pdfLanguage,
}: GeneratePDFOptions) => {
  // Dynamic import of jsPDF to reduce bundle size
  const { default: jsPDF } = await import('jspdf')

  // Determine the target language for PDF (can be different from current locale)
  const targetLocale = pdfLanguage || locale

  // Determine if RTL language
  const isRTL = targetLocale === 'fa' || targetLocale === 'ar'

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Try to load custom fonts for Persian/Arabic
  if (isRTL) {
    await loadCustomFonts(doc)
    setFontForLocale(doc, targetLocale)

    if (!areFontsAvailable(targetLocale)) {
      const langName = targetLocale === 'fa' ? 'Persian' : 'Arabic'
      console.warn(`⚠️  Custom ${langName} font not available. Text may not display correctly.`)
      console.warn('📖 To fix: Follow instructions in apps/frontend/src/lib/utils/fonts/README.md')
    }
  }

  // Set document properties
  doc.setProperties({
    title: translations.title,
    subject: 'Price Calculation',
    author: 'Currency Exchange Calculator',
    creator: 'Currency Exchange App',
  })

  // Colors
  const primaryColor = '#007AFF' // Accent blue
  const textColor = '#000000'
  const secondaryTextColor = '#666666'
  const borderColor = '#E5E5E5'

  // Page layout constants
  const marginLeft = 20
  const marginRight = 20
  const marginTop = 20
  const pageWidth = 210
  const pageBreakThreshold = 270

  // Table column layout (LTR)
  const TABLE_COLS_LTR = {
    item: { x: marginLeft + 2, width: 75 },
    qty: { x: marginLeft + 80, width: 18 },
    unitPrice: { x: marginLeft + 100, width: 40 },
    total: { x: pageWidth - marginRight - 2, align: 'right' as const },
  }

  // Table column layout (RTL) - measured from right edge
  const TABLE_COLS_RTL = {
    total: { x: pageWidth - marginLeft - 2, width: 35 },
    unitPrice: { x: pageWidth - marginLeft - 40, width: 45 },
    qty: { x: pageWidth - marginLeft - 90, width: 18 },
    item: { x: pageWidth - marginLeft - 110, width: 75 },
  }

  let currentY = marginTop

  // Helper function to add text with proper RTL support
  const addText = (
    text: string,
    x: number,
    y: number,
    options?: { fontSize?: number; fontStyle?: string; color?: string; align?: 'left' | 'center' | 'right' }
  ) => {
    if (options?.fontSize) doc.setFontSize(options.fontSize)

    // Set font with locale support
    if (options?.fontStyle) {
      if (isRTL && areFontsAvailable(targetLocale)) {
        setFontForLocale(doc, targetLocale)
        // Custom fonts might not have bold/italic variants
        doc.setFont(doc.getFont().fontName, options.fontStyle === 'bold' ? 'normal' : options.fontStyle)
      } else {
        doc.setFont('helvetica', options.fontStyle)
      }
    } else if (isRTL) {
      setFontForLocale(doc, targetLocale)
    }

    if (options?.color) doc.setTextColor(options.color)

    // For RTL languages, jsPDF handles BiDi algorithm automatically
    const actualAlign = options?.align || (isRTL ? 'right' : 'left')

    doc.text(text, x, y, {
      align: actualAlign,
      renderingMode: 'fill',
      baseline: 'alphabetic',
      // jsPDF 3.0+ has built-in RTL support through BiDi algorithm
      isInputVisual: false, // Text is in logical order
    })

    // Reset defaults
    doc.setTextColor(textColor)
    if (isRTL) {
      setFontForLocale(doc, targetLocale)
    } else {
      doc.setFont('helvetica', 'normal')
    }
  }

  // Title
  const titleX = isRTL ? pageWidth - marginLeft : marginLeft
  addText(translations.title, titleX, currentY, {
    fontSize: 24,
    fontStyle: 'bold',
    color: primaryColor,
    align: isRTL ? 'right' : 'left',
  })
  currentY += 15

  // Date and Time
  const dateStr = currentDate
    ? new Date(currentDate).toLocaleDateString(targetLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString(targetLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

  const timeStr = new Date().toLocaleTimeString(targetLocale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tehran',
  })

  const dateX = isRTL ? pageWidth - marginLeft : marginLeft
  addText(`${translations.date}: ${dateStr}`, dateX, currentY, {
    fontSize: 12,
    color: secondaryTextColor,
    align: isRTL ? 'right' : 'left',
  })
  currentY += 7

  addText(`${translations.time}: ${timeStr} ${translations.tehranTime}`, dateX, currentY, {
    fontSize: 12,
    color: secondaryTextColor,
    align: isRTL ? 'right' : 'left',
  })
  currentY += 15

  // Draw separator line
  doc.setDrawColor(borderColor)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY)
  currentY += 10

  // Items header
  addText(translations.items, dateX, currentY, {
    fontSize: 16,
    fontStyle: 'bold',
    align: isRTL ? 'right' : 'left',
  })
  currentY += 10

  // Table header
  doc.setFillColor(240, 240, 240)
  doc.rect(marginLeft, currentY - 6, pageWidth - marginLeft - marginRight, 8, 'F')

  if (isRTL) {
    // RTL table headers (right to left)
    addText(translations.total, TABLE_COLS_RTL.total.x, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
    addText(translations.unitPrice, TABLE_COLS_RTL.unitPrice.x, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
    addText(translations.qty, TABLE_COLS_RTL.qty.x, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
    addText(translations.item, TABLE_COLS_RTL.item.x, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
  } else {
    // LTR table headers (left to right)
    addText(translations.item, TABLE_COLS_LTR.item.x, currentY, { fontSize: 10, fontStyle: 'bold' })
    addText(translations.qty, TABLE_COLS_LTR.qty.x, currentY, { fontSize: 10, fontStyle: 'bold' })
    addText(translations.unitPrice, TABLE_COLS_LTR.unitPrice.x, currentY, { fontSize: 10, fontStyle: 'bold' })
    addText(translations.total, TABLE_COLS_LTR.total.x, currentY, { fontSize: 10, fontStyle: 'bold', align: TABLE_COLS_LTR.total.align })
  }
  currentY += 10

  // Items
  items.forEach((item, index) => {
    // Check if we need a new page
    if (currentY > pageBreakThreshold) {
      doc.addPage()
      currentY = marginTop
    }

    const itemName = item.name.length > 30 ? item.name.substring(0, 27) + '...' : item.name
    const qtyText = `${item.quantity} ${item.type === 'gold' ? translations.grams : translations.piece}`
    const unitPriceText = formatToman(item.unitPrice)
    const totalText = formatToman(item.totalValue)

    if (isRTL) {
      // RTL item row (right to left)
      addText(totalText, TABLE_COLS_RTL.total.x, currentY, { fontSize: 10, align: 'right' })
      addText(unitPriceText, TABLE_COLS_RTL.unitPrice.x, currentY, { fontSize: 10, align: 'right' })
      addText(qtyText, TABLE_COLS_RTL.qty.x, currentY, { fontSize: 10, align: 'right' })
      addText(itemName, TABLE_COLS_RTL.item.x, currentY, { fontSize: 10, align: 'right' })
    } else {
      // LTR item row (left to right)
      addText(itemName, TABLE_COLS_LTR.item.x, currentY, { fontSize: 10 })
      addText(qtyText, TABLE_COLS_LTR.qty.x, currentY, { fontSize: 10 })
      addText(unitPriceText, TABLE_COLS_LTR.unitPrice.x, currentY, { fontSize: 10 })
      addText(totalText, TABLE_COLS_LTR.total.x, currentY, { fontSize: 10, align: TABLE_COLS_LTR.total.align })
    }

    currentY += 8

    // Draw separator line (light)
    if (index < items.length - 1) {
      doc.setDrawColor(230, 230, 230)
      doc.setLineWidth(0.1)
      doc.line(marginLeft, currentY - 2, pageWidth - marginRight, currentY - 2)
    }
  })

  currentY += 5

  // Draw separator line
  doc.setDrawColor(borderColor)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, currentY, pageWidth - marginRight, currentY)
  currentY += 10

  // Total
  doc.setFillColor(245, 250, 255) // Light blue background
  doc.rect(marginLeft, currentY - 6, pageWidth - marginLeft - marginRight, 12, 'F')

  if (isRTL) {
    addText(`${formatToman(totalValue)} ${translations.toman}`, pageWidth - marginLeft - 2, currentY + 2, {
      fontSize: 14,
      fontStyle: 'bold',
      color: primaryColor,
      align: 'right',
    })
    addText(`${translations.grandTotal}:`, marginLeft + 2, currentY + 2, {
      fontSize: 14,
      fontStyle: 'bold',
    })
  } else {
    addText(`${translations.grandTotal}:`, marginLeft + 2, currentY + 2, {
      fontSize: 14,
      fontStyle: 'bold',
    })
    addText(`${formatToman(totalValue)} ${translations.toman}`, pageWidth - marginRight - 2, currentY + 2, {
      fontSize: 14,
      fontStyle: 'bold',
      color: primaryColor,
      align: 'right',
    })
  }
  currentY += 20

  // Footer
  const pageHeight = doc.internal.pageSize.height
  addText(
    translations.generatedBy,
    pageWidth / 2,
    pageHeight - 10,
    {
      fontSize: 8,
      color: secondaryTextColor,
      align: 'center',
    }
  )

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0]
  const langSuffix = targetLocale !== locale ? `-${targetLocale}` : ''
  const filename = `calculator-${timestamp}${langSuffix}.pdf`

  // Save PDF
  doc.save(filename)
}
