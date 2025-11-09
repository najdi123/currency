import { useState, useEffect } from 'react'

/**
 * Debounce hook - delays updating a value until after a specified delay
 * Useful for search inputs to reduce unnecessary operations
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 *
 * @example
 * const [query, setQuery] = useState('')
 * const debouncedQuery = useDebounce(query, 300)
 * // debouncedQuery updates 300ms after user stops typing
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
