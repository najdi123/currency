'use client'

import { memo } from 'react'
import { CalculatorBottomNav } from '@/components/CalculatorBottomNav'
import { CalculatorDetailsModal } from '@/components/CalculatorDetailsModal'
import type { CalculatorItem } from '@/lib/store/slices/calculatorSlice'

interface CalculatorLayerProps {
  /** Whether calculator mode is active */
  isCalculatorMode: boolean
  /** Calculator items */
  calculatorItems: CalculatorItem[]
  /** Total value of all calculator items */
  calculatorTotal: number
  /** Current date for the calculator */
  calculatorDate: string | undefined
  /** Whether the details modal is open */
  detailsModalOpen: boolean
  /** Whether PDF is being generated */
  isGeneratingPDF: boolean
  /** Handlers */
  onSeeDetails: () => void
  onCloseDetails: () => void
  onSaveAsPDF: (pdfLanguage?: string) => Promise<void>
  onRemoveItem: (id: string) => void
  onClearAll: () => void
}

/**
 * Calculator layer component containing the bottom nav and details modal.
 * Only renders when calculator mode is active.
 */
function CalculatorLayerComponent({
  isCalculatorMode,
  calculatorItems,
  calculatorTotal,
  calculatorDate,
  detailsModalOpen,
  isGeneratingPDF,
  onSeeDetails,
  onCloseDetails,
  onSaveAsPDF,
  onRemoveItem,
  onClearAll,
}: CalculatorLayerProps) {
  return (
    <>
      {/* Calculator Bottom Navigation - Only shown in calculator mode */}
      {isCalculatorMode && (
        <CalculatorBottomNav
          totalValue={calculatorTotal}
          itemCount={calculatorItems.length}
          onSeeDetails={onSeeDetails}
          onSaveAsPDF={onSaveAsPDF}
          isGeneratingPDF={isGeneratingPDF}
        />
      )}

      {/* Calculator Details Modal */}
      <CalculatorDetailsModal
        isOpen={detailsModalOpen}
        onClose={onCloseDetails}
        items={calculatorItems}
        totalValue={calculatorTotal}
        currentDate={calculatorDate}
        onRemoveItem={onRemoveItem}
        onClearAll={onClearAll}
      />
    </>
  )
}

export const CalculatorLayer = memo(CalculatorLayerComponent)
