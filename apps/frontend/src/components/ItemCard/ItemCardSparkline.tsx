import React from 'react'
import { MiniSparkline } from '../MiniSparkline'
import { useTranslations } from 'next-intl'

interface ItemCardSparklineProps {
  /**
   * Array of data points for the sparkline
   */
  data: number[]

  /**
   * Color for the sparkline (RGB format)
   */
  color: string

  /**
   * Whether the trend is positive
   */
  isPositive: boolean

  /**
   * Compact mode flag
   */
  compact?: boolean

  /**
   * Whether to show the sparkline (default: true)
   */
  show?: boolean
}

/**
 * ItemCardSparkline - Displays a mini trend sparkline chart
 *
 * Features:
 * - 7-day trend visualization
 * - Color-coded based on positive/negative trend
 * - Responsive sizing for compact mode
 * - Optimized SVG rendering
 * - Conditional rendering based on show prop
 *
 * Accessibility:
 * - Screen reader text describes the trend direction in Persian
 * - Chart marked as decorative (aria-hidden) since trend is described in text
 * - Persian labels for upward and downward trends
 */
export const ItemCardSparkline: React.FC<ItemCardSparklineProps> = ({
  data,
  color,
  isPositive,
  compact = false,
  show = true,
}) => {
  const t = useTranslations('Chart')

  // Don't render if show is false
  if (!show) return null
  return (
    <div className="flex-shrink-0 self-center">
      {/* Screen reader description for sparkline */}
      <span className="sr-only">
        {isPositive ? 'روند هفت روزه صعودی' : 'روند هفت روزه نزولی'}
      </span>
      <MiniSparkline
        data={data}
        color={color}
        width={compact ? 60 : 80}
        height={compact ? 24 : 32}
        strokeWidth={compact ? 1.2 : 1.5}
        className="opacity-70"
        aria-hidden="true"
      />
      <div className='flex w-full justify-center'>
        {/* <p className='text-xs'>1 week</p>//todo replace with t('week') */}
        <p className='text-xs'>{t('1w')}</p>
      </div>
    </div>
  )
}
