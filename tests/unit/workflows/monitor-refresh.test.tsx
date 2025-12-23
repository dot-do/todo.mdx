/**
 * Unit Tests: useAutoRefresh Hook
 *
 * TDD RED PHASE: Tests for auto-refresh behavior using React hooks with intervals.
 * These tests verify the hook properly fetches data on mount and at intervals.
 *
 * The useAutoRefresh hook should:
 * 1. Call fetchFn immediately on mount
 * 2. Call fetchFn again at specified intervals
 * 3. Return current data, isRefreshing state, and manual refresh function
 * 4. Clean up interval on unmount
 *
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoRefresh } from '../../../src/workflows/monitor/hooks/useAutoRefresh'

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches data immediately on mount', async () => {
    const fetchFn = vi.fn().mockReturnValue({ count: 1 })
    renderHook(() => useAutoRefresh(fetchFn))

    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('refetches after interval', async () => {
    const fetchFn = vi.fn().mockReturnValue({ count: 1 })
    renderHook(() => useAutoRefresh(fetchFn, 2000))

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('returns data from fetchFn', async () => {
    const fetchFn = vi.fn().mockReturnValue({ count: 42 })
    const { result } = renderHook(() => useAutoRefresh(fetchFn))

    // Wait for the useEffect to complete and update state
    await act(async () => {
      // Allow microtasks to flush (the Promise.resolve() in doFetch)
      await Promise.resolve()
    })

    expect(result.current.data).toEqual({ count: 42 })
  })

  it('updates data after each fetch', async () => {
    let counter = 0
    const fetchFn = vi.fn().mockImplementation(() => ({ count: ++counter }))
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 1000))

    // Wait for initial fetch to complete
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.data).toEqual({ count: 1 })

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(result.current.data).toEqual({ count: 2 })
  })

  it('uses default interval of 2000ms', async () => {
    const fetchFn = vi.fn().mockReturnValue({ count: 1 })
    renderHook(() => useAutoRefresh(fetchFn))

    // Should not have been called again before 2000ms
    await act(async () => {
      vi.advanceTimersByTime(1999)
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Should be called after 2000ms
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('cleans up interval on unmount', async () => {
    const fetchFn = vi.fn().mockReturnValue({ count: 1 })
    const { unmount } = renderHook(() => useAutoRefresh(fetchFn, 1000))

    expect(fetchFn).toHaveBeenCalledTimes(1)

    unmount()

    // Advance timer after unmount - should not trigger additional calls
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('provides manual refresh function', async () => {
    const fetchFn = vi.fn().mockReturnValue({ count: 1 })
    const { result } = renderHook(() => useAutoRefresh(fetchFn, 5000))

    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Manually trigger refresh
    await act(async () => {
      result.current.refresh()
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('sets isRefreshing to true during async fetch', async () => {
    let resolvePromise: (value: { count: number }) => void
    const fetchFn = vi.fn().mockImplementation(
      () => new Promise<{ count: number }>((resolve) => {
        resolvePromise = resolve
      })
    )

    const { result } = renderHook(() => useAutoRefresh(fetchFn, 2000))

    // Initially loading (first fetch in progress)
    expect(result.current.isRefreshing).toBe(true)

    // Resolve the promise
    await act(async () => {
      resolvePromise!({ count: 1 })
      await Promise.resolve()
    })

    expect(result.current.isRefreshing).toBe(false)
    expect(result.current.data).toEqual({ count: 1 })
  })

  it('handles async fetchFn', async () => {
    vi.useRealTimers() // Use real timers for waitFor

    const fetchFn = vi.fn().mockResolvedValue({ count: 99 })
    const { result } = renderHook(() => useAutoRefresh(fetchFn))

    // Wait for async resolution
    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 99 })
    }, { timeout: 1000 })
  })

  it('continues interval after async fetch completes', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ count: 1 })
    renderHook(() => useAutoRefresh(fetchFn, 1000))

    // First call on mount
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // Advance to trigger interval
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
