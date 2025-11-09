'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ShowMoreButton } from './ShowMoreButton'

interface ExpandableSectionProps {
  mainContent: React.ReactNode
  additionalContent: React.ReactNode
  additionalItemCount: number
}

/**
 * ExpandableSection - Wrapper component that handles expand/collapse animation
 * for additional currencies/items
 *
 * Features:
 * - Smooth expand/collapse animation using CSS transitions
 * - Shows ShowMoreButton automatically
 * - If no additional items, only shows main content
 * - Accessible with proper ARIA attributes
 * - Performance optimized with CSS-only transitions
 *
 * Design:
 * - Uses max-height transition for smooth animation
 * - Overflow hidden during collapse
 * - Automatic height calculation
 * - Respects motion-reduce preferences
 */
export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  mainContent,
  additionalContent,
  additionalItemCount,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [maxHeight, setMaxHeight] = useState<number>(0)
  const contentRef = useRef<HTMLDivElement>(null)

  // Calculate the max height when content changes
  useEffect(() => {
    if (contentRef.current && isExpanded) {
      setMaxHeight(contentRef.current.scrollHeight)
    }
  }, [isExpanded, additionalContent])

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  // If no additional items, just show main content
  if (additionalItemCount === 0) {
    return <>{mainContent}</>
  }

  return (
    <div>
      {/* Main content - always visible */}
      <div>{mainContent}</div>

      {/* Additional content - expandable */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-500 ease-in-out motion-reduce:transition-none"
        style={{
          maxHeight: isExpanded ? `${maxHeight}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
        aria-hidden={!isExpanded}
      >
        <div className="pt-4 sm:pt-6 lg:pt-8">{additionalContent}</div>
      </div>

      {/* Show More/Less button */}
      <ShowMoreButton
        isExpanded={isExpanded}
        onToggle={handleToggle}
        itemCount={additionalItemCount}
      />
    </div>
  )
}
