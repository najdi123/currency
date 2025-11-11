import React, { useMemo } from 'react'

export interface MiniSparklineProps {
  /**
   * Array of data points to plot (e.g., [100, 105, 103, 108, 107, 110, 112])
   */
  data: number[]

  /**
   * Color for the sparkline path
   * Use Tailwind color classes or CSS custom properties
   */
  color: string

  /**
   * Width of the SVG in pixels
   * @default 80
   */
  width?: number

  /**
   * Height of the SVG in pixels
   * @default 32
   */
  height?: number

  /**
   * Stroke width for the line
   * @default 1.5
   */
  strokeWidth?: number

  /**
   * Optional class name for the SVG element
   */
  className?: string
}

/**
 * MiniSparkline - A lightweight SVG-based sparkline component for trend visualization
 *
 * This component creates a smooth curve through the provided data points using
 * SVG paths. It's designed to be subtle and performant, perfect for inline
 * trend indicators in cards.
 *
 * Features:
 * - Pure SVG implementation (no external chart libraries)
 * - Smooth curve interpolation
 * - Automatic scaling to fit data range
 * - Handles empty/invalid data gracefully
 * - Optimized with useMemo for path calculations
 * - Dark mode compatible
 *
 * Design Philosophy (Apple-inspired):
 * - Minimal and subtle
 * - Smooth, flowing curves
 * - Appropriate use of whitespace
 * - Performance-optimized
 *
 * Accessibility:
 * - Sparkline is decorative (aria-hidden="true")
 * - Trend information should be conveyed through adjacent text/percentage
 */
const MiniSparklineComponent: React.FC<MiniSparklineProps> = ({
  data,
  color,
  width = 80,
  height = 32,
  strokeWidth = 1.5,
  className = '',
}) => {
  // Generate SVG path from data points
  const path = useMemo(() => {
    // Handle invalid or empty data
    if (!data || data.length === 0) {
      // Return a flat line in the middle
      const y = height / 2
      return `M 0 ${y} L ${width} ${y}`
    }

    if (data.length === 1) {
      // Single point - draw a horizontal line
      const y = height / 2
      return `M 0 ${y} L ${width} ${y}`
    }

    // Find min and max values for scaling
    const minValue = Math.min(...data)
    const maxValue = Math.max(...data)
    const valueRange = maxValue - minValue

    // If all values are the same, draw a flat line
    if (valueRange === 0) {
      const y = height / 2
      return `M 0 ${y} L ${width} ${y}`
    }

    // Calculate points
    const points = data.map((value, index) => {
      // X position: evenly distribute points across width
      const x = (index / (data.length - 1)) * width

      // Y position: map value to height (inverted because SVG Y goes down)
      // Add 10% padding on top and bottom
      const padding = height * 0.1
      const availableHeight = height - padding * 2
      const normalizedValue = (value - minValue) / valueRange
      const y = height - padding - normalizedValue * availableHeight

      return { x, y }
    })

    // Create smooth curve using quadratic Bezier curves
    // This creates a more natural, flowing line than straight segments
    let pathData = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i]
      const next = points[i + 1]

      // Calculate control point for smooth curve
      // Place it at the midpoint between current and next
      const controlX = (current.x + next.x) / 2
      const controlY = (current.y + next.y) / 2

      // Use quadratic curve to next point
      pathData += ` Q ${controlX} ${current.y}, ${controlX} ${controlY}`
      pathData += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`
    }

    return pathData
  }, [data, width, height])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="none"
      dir="ltr"
      style={{ direction: 'ltr' }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Memoized MiniSparkline component
 * Only re-renders when data, color, or dimensions change
 */
export const MiniSparkline = React.memo(
  MiniSparklineComponent,
  (prevProps, nextProps) =>
    prevProps.data === nextProps.data &&
    prevProps.color === nextProps.color &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.strokeWidth === nextProps.strokeWidth &&
    prevProps.className === nextProps.className
)

MiniSparkline.displayName = 'MiniSparkline'
