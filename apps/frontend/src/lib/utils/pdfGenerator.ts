import { formatToman } from './formatters'
import type { CalculatorItem } from '@/lib/store/slices/calculatorSlice'

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
}

export const generateCalculatorPDF = async ({
  items,
  totalValue,
  currentDate,
  locale,
  translations,
}: GeneratePDFOptions) => {
  // Dynamic import of jsPDF to reduce bundle size
  const { default: jsPDF } = await import('jspdf')

  // Determine if RTL language
  const isRTL = locale === 'fa' || locale === 'ar'

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Add font support for Persian/Arabic
  // Note: For production, you'd want to embed custom fonts for proper RTL rendering
  // For now, we'll use built-in fonts and handle RTL text reversal manually

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

  // Page margins
  const marginLeft = 20
  const marginRight = 20
  const marginTop = 20
  const pageWidth = 210
  let currentY = marginTop

  // Helper function to reverse text for RTL (simple approach)
  const processText = (text: string): string => {
    if (!isRTL) return text
    // For RTL, we reverse the string
    // Note: This is a basic approach. For production, use a proper RTL library or embedded fonts
    return text.split('').reverse().join('')
  }

  // Helper function to get x position for RTL
  const getX = (x: number, align?: 'left' | 'center' | 'right'): number => {
    if (!isRTL) return x

    // For RTL, flip horizontal positions
    if (align === 'center') return x
    if (align === 'right') return marginLeft + (x - marginLeft)
    // Default left becomes right in RTL
    return pageWidth - x
  }

  // Helper function to get alignment for RTL
  const getAlign = (align?: 'left' | 'center' | 'right'): 'left' | 'center' | 'right' => {
    if (!isRTL || align === 'center') return align || 'left'
    // Flip left/right for RTL
    if (align === 'left') return 'right'
    if (align === 'right') return 'left'
    return 'right' // default left becomes right in RTL
  }

  // Helper function to add text
  const addText = (
    text: string,
    x: number,
    y: number,
    options?: { fontSize?: number; fontStyle?: string; color?: string; align?: 'left' | 'center' | 'right' }
  ) => {
    if (options?.fontSize) doc.setFontSize(options.fontSize)
    if (options?.fontStyle) doc.setFont('helvetica', options.fontStyle)
    if (options?.color) doc.setTextColor(options.color)

    const processedText = processText(text)
    const actualX = getX(x, options?.align)
    const actualAlign = getAlign(options?.align)

    doc.text(processedText, actualX, y, { align: actualAlign })

    // Reset defaults
    doc.setTextColor(textColor)
    doc.setFont('helvetica', 'normal')
  }

  // Title
  addText(translations.title, isRTL ? pageWidth - marginLeft : marginLeft, currentY, {
    fontSize: 24,
    fontStyle: 'bold',
    color: primaryColor,
    align: isRTL ? 'right' : 'left',
  })
  currentY += 15

  // Date and Time
  const dateStr = currentDate
    ? new Date(currentDate).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

  const timeStr = new Date().toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tehran',
  })

  addText(`${translations.date}: ${dateStr}`, isRTL ? pageWidth - marginLeft : marginLeft, currentY, {
    fontSize: 12,
    color: secondaryTextColor,
    align: isRTL ? 'right' : 'left',
  })
  currentY += 7

  addText(`${translations.time}: ${timeStr} ${translations.tehranTime}`, isRTL ? pageWidth - marginLeft : marginLeft, currentY, {
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
  addText(translations.items, isRTL ? pageWidth - marginLeft : marginLeft, currentY, {
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
    addText(translations.total, pageWidth - marginLeft - 2, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
    addText(translations.unitPrice, pageWidth - marginLeft - 40, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
    addText(translations.qty, pageWidth - marginLeft - 90, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
    addText(translations.item, pageWidth - marginLeft - 110, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
  } else {
    // LTR table headers (left to right)
    addText(translations.item, marginLeft + 2, currentY, { fontSize: 10, fontStyle: 'bold' })
    addText(translations.qty, marginLeft + 80, currentY, { fontSize: 10, fontStyle: 'bold' })
    addText(translations.unitPrice, marginLeft + 100, currentY, { fontSize: 10, fontStyle: 'bold' })
    addText(translations.total, pageWidth - marginRight - 2, currentY, { fontSize: 10, fontStyle: 'bold', align: 'right' })
  }
  currentY += 10

  // Items
  items.forEach((item, index) => {
    // Check if we need a new page
    if (currentY > 270) {
      doc.addPage()
      currentY = marginTop
    }

    const itemName = item.name.length > 30 ? item.name.substring(0, 27) + '...' : item.name
    const qtyText = `${item.quantity} ${item.type === 'gold' ? translations.grams : translations.piece}`
    const unitPriceText = formatToman(item.unitPrice)
    const totalText = formatToman(item.totalValue)

    if (isRTL) {
      // RTL item row (right to left)
      addText(totalText, pageWidth - marginLeft - 2, currentY, { fontSize: 10, align: 'right' })
      addText(unitPriceText, pageWidth - marginLeft - 40, currentY, { fontSize: 10, align: 'right' })
      addText(qtyText, pageWidth - marginLeft - 90, currentY, { fontSize: 10, align: 'right' })
      addText(itemName, pageWidth - marginLeft - 110, currentY, { fontSize: 10, align: 'right' })
    } else {
      // LTR item row (left to right)
      addText(itemName, marginLeft + 2, currentY, { fontSize: 10 })
      addText(qtyText, marginLeft + 80, currentY, { fontSize: 10 })
      addText(unitPriceText, marginLeft + 100, currentY, { fontSize: 10 })
      addText(totalText, pageWidth - marginRight - 2, currentY, { fontSize: 10, align: 'right' })
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
  const filename = `calculator-${timestamp}.pdf`

  // Save PDF
  doc.save(filename)
}
