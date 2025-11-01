/**
 * Mock Sparkline Data Generator
 *
 * Generates consistent, realistic-looking 7-day trend data for each item.
 * Uses the item code as a seed to ensure the same item always gets the
 * same pattern, but different items get different patterns.
 *
 * This creates stable, deterministic mock data that won't change across
 * re-renders, providing a smooth user experience.
 */

/**
 * Simple seeded random number generator
 * Uses a linear congruential generator (LCG) algorithm
 * Same seed always produces the same sequence of numbers
 */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    // LCG parameters (same as Java's Random)
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

/**
 * Convert a string to a numeric seed
 * Same string always produces the same seed
 */
function stringToSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate 7-day mock trend data for an item
 *
 * @param itemCode - Unique identifier for the item (e.g., 'usd_sell', 'btc', 'sekkeh')
 * @param currentValue - Current price value (used as the baseline)
 * @returns Array of 7 numbers representing daily values
 *
 * @example
 * const trendData = generateSparklineData('usd_sell', 106850)
 * // Returns something like: [104200, 104800, 105100, 105500, 105900, 106200, 106850]
 *
 * Features:
 * - Deterministic: Same itemCode always produces the same pattern
 * - Realistic: Creates smooth trends with slight variations
 * - Ends at current value: Last point is always the current price
 * - Varied patterns: Different items get different trend shapes
 */
export function generateSparklineData(itemCode: string, currentValue: number): number[] {
  // Create seeded random generator from item code
  const seed = stringToSeed(itemCode)
  const random = seededRandom(seed)

  // Determine overall trend direction for this item
  // Some items will trend up, some down, some sideways
  const trendType = random()
  let trendDirection: 'up' | 'down' | 'sideways'

  if (trendType < 0.4) {
    trendDirection = 'up'
  } else if (trendType < 0.8) {
    trendDirection = 'down'
  } else {
    trendDirection = 'sideways'
  }

  // Generate 7 data points (one per day)
  const numPoints = 7
  const data: number[] = []

  // Calculate starting value based on trend direction
  // For upward trends, start lower; for downward, start higher
  let startValue: number

  switch (trendDirection) {
    case 'up':
      // Start 3-7% below current value
      startValue = currentValue * (1 - (0.03 + random() * 0.04))
      break
    case 'down':
      // Start 3-7% above current value
      startValue = currentValue * (1 + (0.03 + random() * 0.04))
      break
    case 'sideways':
      // Start near current value (±2%)
      startValue = currentValue * (1 + (random() - 0.5) * 0.04)
      break
  }

  // Generate intermediate points with smooth progression
  for (let i = 0; i < numPoints; i++) {
    if (i === numPoints - 1) {
      // Last point is always the current value
      data.push(currentValue)
    } else {
      // Calculate progress through the week (0 to 1)
      const progress = i / (numPoints - 1)

      // Linear interpolation from start to current value
      const baseValue = startValue + (currentValue - startValue) * progress

      // Add some realistic noise (±1.5%)
      const noise = (random() - 0.5) * 0.03
      const value = baseValue * (1 + noise)

      data.push(Math.round(value))
    }
  }

  return data
}

/**
 * Get cached sparkline data for an item
 *
 * This function memoizes the generated data to ensure consistent
 * results across re-renders. The cache is module-scoped and persists
 * for the lifetime of the application session.
 *
 * @param itemCode - Unique identifier for the item
 * @param currentValue - Current price value
 * @returns Array of 7 numbers representing the trend
 */
const sparklineCache = new Map<string, { value: number; data: number[] }>()

export function getSparklineData(itemCode: string, currentValue: number): number[] {
  const cacheKey = itemCode

  // Check if we have cached data for this item
  const cached = sparklineCache.get(cacheKey)

  // If cached data exists and the current value matches, return cached data
  if (cached && cached.value === currentValue) {
    return cached.data
  }

  // Generate new data
  const data = generateSparklineData(itemCode, currentValue)

  // Cache it
  sparklineCache.set(cacheKey, { value: currentValue, data })

  return data
}

/**
 * Clear the sparkline data cache
 * Useful for testing or when you need to regenerate all data
 */
export function clearSparklineCache(): void {
  sparklineCache.clear()
}
