import { useEffect, useRef } from 'react'

/**
 * Hook to preload the chart component when user scrolls near item cards
 * Uses Intersection Observer to detect when cards are in viewport
 * Preloads only once for better performance
 */
export const useChartPreload = () => {
  const hasPreloadedChart = useRef(false)

  useEffect(() => {
    // Only preload once
    if (hasPreloadedChart.current) return

    // SSR guard - only run in browser
    if (typeof window === 'undefined') return

    // Use requestAnimationFrame to ensure DOM is painted
    const rafId = requestAnimationFrame(() => {
      // Query for item cards
      const cards = document.querySelectorAll('[role="listitem"]')

      // If no cards found, DOM might not be ready yet - skip preload
      // Chart will load on demand when user clicks
      if (cards.length === 0) {
        console.debug('Chart preload: No item cards found, skipping preload')
        return
      }

      // Create intersection observer to detect when cards enter viewport
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            // Preload the chart component
            import('@/components/ChartBottomSheet')
              .then(() => {
                hasPreloadedChart.current = true
                console.debug('Chart preloaded successfully')
              })
              .catch((err) => {
                // Don't set hasPreloadedChart on error, allow retry on click
                console.warn('Chart preload failed (will load on demand):', err)
              })
            observer.disconnect()
          }
        },
        {
          rootMargin: '100px', // Start loading 100px before visible
          threshold: 0.1,
        }
      )

      // Observe all item cards
      cards.forEach((card) => observer.observe(card))
    })

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, []) // Empty deps - run once after mount
}
