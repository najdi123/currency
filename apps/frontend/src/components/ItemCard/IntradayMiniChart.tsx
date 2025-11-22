'use client'

import React, { useMemo } from 'react'

interface DataPoint {
  time: string
  price: number
}

interface IntradayMiniChartProps {
  /**
   * Array of intraday data points
   */
  dataPoints: DataPoint[]

  /**
   * Whether the overall trend is positive
   */
  isPositive: boolean

  /**
   * Chart width in pixels
   */
  width?: number

  /**
   * Chart height in pixels
   */
  height?: number

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Compact mode for smaller displays
   */
  compact?: boolean
}

/**
 * IntradayMiniChart - Mini sparkline chart for intraday price movement
 *
 * Features:
 * - SVG-based line chart with gradient fill
 * - Automatically scales to min/max price range
 * - Color-coded: green (positive), red (negative)
 * - Responsive sizing for compact mode
 * - Smooth line rendering with rounded caps
 * - Performance optimized with useMemo
 *
 * Accessibility:
 * - ARIA label describes the chart purpose
 * - Chart is decorative (trend shown in badge)
 * - No interactive elements
 *
 * Design:
 * - Minimal, clean aesthetic
 * - Gradient fill for depth
 * - Consistent with existing sparkline design
 * - Uses inline SVG for performance
 */
export const IntradayMiniChart: React.FC<IntradayMiniChartProps> = ({
  dataPoints,
  isPositive,
  width = 80,
  height = 40,
  className = '',
  compact = false,
}) => {
  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return null

    const prices = dataPoints.map((d) => d.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1 // Avoid division by zero

    // Calculate points for SVG path
    const points = dataPoints.map((d, index) => {
      const x = (index / (dataPoints.length - 1)) * width
      const y = height - ((d.price - min) / range) * height
      return { x, y }
    })

    // Generate SVG path
    const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')

    // Generate area path for gradient fill
    const areaPathD = `${pathD} L ${width} ${height} L 0 ${height} Z`

    return { pathD, areaPathD, points }
  }, [dataPoints, width, height])

  if (!chartData || dataPoints.length < 2) return null

  const actualWidth = compact ? width * 0.75 : width
  const actualHeight = compact ? height * 0.75 : height

  const lineColor = isPositive ? '#10b981' : '#ef4444' // green-500 : red-500
  const gradientId = `gradient-${isPositive ? 'positive' : 'negative'}-${Math.random()}`

  return (
    <div className={`inline-block ${className}`} aria-label="Intraday price chart">
      <svg
        width={actualWidth}
        height={actualHeight}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gradient fill area */}
        <path d={chartData.areaPathD} fill={`url(#${gradientId})`} />

        {/* Line */}
        <path
          d={chartData.pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
        />
      </svg>
    </div>
  )
}
