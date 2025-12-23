import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Custom hook that calls a refresh function every N milliseconds.
 * Returns current data, refresh state, and manual refresh function.
 *
 * @param fetchFn - Function that returns data (sync or async)
 * @param intervalMs - Interval in milliseconds (default: 2000)
 * @returns Object with data, isRefreshing, and refresh function
 */
export function useAutoRefresh<T>(
  fetchFn: () => T | Promise<T>,
  intervalMs: number = 2000
): {
  data: T | null
  isRefreshing: boolean
  refresh: () => void
} {
  const [data, setData] = useState<T | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(true)
  const fetchFnRef = useRef(fetchFn)

  // Keep fetchFn ref up to date without re-creating callbacks
  useEffect(() => {
    fetchFnRef.current = fetchFn
  }, [fetchFn])

  const doFetch = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const result = await Promise.resolve(fetchFnRef.current())
      setData(result)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // Perform initial fetch and set up interval
  useEffect(() => {
    // Immediate fetch on mount
    doFetch()

    // Set up interval for subsequent fetches
    const intervalId = setInterval(() => {
      doFetch()
    }, intervalMs)

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId)
    }
  }, [doFetch, intervalMs])

  const refresh = useCallback(() => {
    doFetch()
  }, [doFetch])

  return {
    data,
    isRefreshing,
    refresh,
  }
}
