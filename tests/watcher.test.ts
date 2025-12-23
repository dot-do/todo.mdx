/**
 * Tests for watcher.ts - file watching and auto-sync
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { watch } from '../src/watcher.js'
import type { WatchEvent, SyncResult } from '../src/types.js'

// Mock chokidar
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(),
  },
}))

// Mock sync function
vi.mock('../src/sync.js', () => ({
  sync: vi.fn(),
}))

// Mock beads-workflows
vi.mock('beads-workflows', () => ({
  findBeadsDir: vi.fn(),
}))

import { findBeadsDir } from 'beads-workflows'
import { sync } from '../src/sync.js'
import chokidar from 'chokidar'

// Mock FSWatcher
class MockFSWatcher {
  private handlers: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  on(event: string, handler: (...args: unknown[]) => void) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return this
  }

  emit(event: string, ...args: unknown[]) {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(...args))
    }
  }

  async close() {
    this.handlers.clear()
  }
}

describe('watch', () => {
  let beadsWatcher: MockFSWatcher
  let todoWatcher: MockFSWatcher
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock watchers
    beadsWatcher = new MockFSWatcher()
    todoWatcher = new MockFSWatcher()

    // Mock chokidar.watch to return different watchers based on path and emit ready immediately
    let callCount = 0
    vi.mocked(chokidar.watch).mockImplementation((path: string | string[]) => {
      // First call is beads watcher, second is todo watcher
      const watcher = callCount === 0 ? beadsWatcher : todoWatcher
      callCount++
      // Emit ready asynchronously on next microtask
      queueMicrotask(() => watcher.emit('ready'))
      return watcher as unknown as ReturnType<typeof chokidar.watch>
    })

    // Mock findBeadsDir
    vi.mocked(findBeadsDir).mockResolvedValue('/test/project/.beads')

    // Spy on console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('should create watchers for beads and todo directories', async () => {
    const watcherPromise = watch({
      todoDir: '.todo',
    })

    const watcher = await watcherPromise

    expect(chokidar.watch).toHaveBeenCalledTimes(2)
    expect(chokidar.watch).toHaveBeenCalledWith(
      expect.stringContaining('issues.jsonl'),
      expect.objectContaining({
        persistent: true,
        ignoreInitial: true,
      })
    )
    expect(chokidar.watch).toHaveBeenCalledWith(
      expect.stringContaining('*.md'),
      expect.objectContaining({
        persistent: true,
        ignoreInitial: true,
      })
    )

    await watcher.close()
  })

  it('should debounce rapid file changes', async () => {
    vi.useFakeTimers()

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 300,
    })

    const watcher = await watcherPromise

    // Trigger multiple rapid changes
    todoWatcher.emit('change', '/test/.todo/task-1.md')
    todoWatcher.emit('change', '/test/.todo/task-2.md')
    todoWatcher.emit('change', '/test/.todo/task-3.md')

    // Advance time by less than debounce
    vi.advanceTimersByTime(200)

    // Sync should not have been called yet
    expect(sync).not.toHaveBeenCalled()

    // Advance past debounce
    vi.advanceTimersByTime(150)

    // Wait for any pending promises
    await vi.runAllTimersAsync()

    // Sync should have been called once
    expect(sync).toHaveBeenCalledTimes(1)

    await watcher.close()
    vi.useRealTimers()
  })

  it('should trigger sync on beads file change', async () => {
    vi.useFakeTimers()

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
    })

    const watcher = await watcherPromise

    // Trigger beads change
    beadsWatcher.emit('change', '/test/.beads/issues.jsonl')

    // Advance time past debounce
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called
    expect(sync).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenCalledWith(
      expect.objectContaining({
        beadsDir: '/test/project/.beads',
        conflictStrategy: 'newest-wins',
      })
    )

    await watcher.close()
    vi.useRealTimers()
  })

  it('should trigger sync on todo file add', async () => {
    vi.useFakeTimers()

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
    })

    const watcher = await watcherPromise

    // Trigger file add
    todoWatcher.emit('add', '/test/.todo/new-task.md')

    // Advance time past debounce
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called
    expect(sync).toHaveBeenCalledTimes(1)

    await watcher.close()
    vi.useRealTimers()
  })

  it('should trigger sync on todo file change', async () => {
    vi.useFakeTimers()

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
    })

    const watcher = await watcherPromise

    // Trigger file change
    todoWatcher.emit('change', '/test/.todo/task-1.md')

    // Advance time past debounce
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called
    expect(sync).toHaveBeenCalledTimes(1)

    await watcher.close()
    vi.useRealTimers()
  })

  it('should trigger sync on todo file unlink', async () => {
    vi.useFakeTimers()

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
    })

    const watcher = await watcherPromise

    // Trigger file unlink
    todoWatcher.emit('unlink', '/test/.todo/deleted-task.md')

    // Advance time past debounce
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called
    expect(sync).toHaveBeenCalledTimes(1)

    await watcher.close()
    vi.useRealTimers()
  })

  it('should emit onChange events', async () => {
    vi.useFakeTimers()

    const events: WatchEvent[] = []
    const onChange = (event: WatchEvent) => {
      events.push(event)
    }

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
      onChange,
    })

    const watcher = await watcherPromise

    // Trigger changes
    beadsWatcher.emit('change', '/test/.beads/issues.jsonl')
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    todoWatcher.emit('change', '/test/.todo/task-1.md')
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Check events
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({
      type: 'beads-change',
      path: '/test/.beads/issues.jsonl',
    })
    expect(events[1]).toEqual({
      type: 'file-change',
      path: '/test/.todo/task-1.md',
    })

    await watcher.close()
    vi.useRealTimers()
  })

  it('should handle sync errors gracefully', async () => {
    vi.useFakeTimers()

    // Make sync throw an error
    vi.mocked(sync).mockRejectedValueOnce(new Error('Sync failed'))

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
    })

    const watcher = await watcherPromise

    // Trigger change
    todoWatcher.emit('change', '/test/.todo/task-1.md')

    // Advance time past debounce
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called and error logged
    expect(sync).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Sync failed:', expect.any(Error))

    // Watcher should still be functional
    vi.mocked(sync).mockResolvedValueOnce({
      created: [],
      updated: [],
      deleted: [],
      filesWritten: [],
      conflicts: [],
    })

    todoWatcher.emit('change', '/test/.todo/task-2.md')
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called again
    expect(sync).toHaveBeenCalledTimes(2)

    await watcher.close()
    vi.useRealTimers()
  })

  it('should handle watcher errors gracefully', async () => {
    const watcherPromise = watch({
      todoDir: '.todo',
    })

    const watcher = await watcherPromise

    // Emit errors
    beadsWatcher.emit('error', new Error('Beads watcher error'))
    todoWatcher.emit('error', new Error('Todo watcher error'))

    // Errors should be logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Beads watcher error:', expect.any(Error))
    expect(consoleErrorSpy).toHaveBeenCalledWith('Todo watcher error:', expect.any(Error))

    await watcher.close()
  })

  it('should clean up on close', async () => {
    vi.useFakeTimers()

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
    })

    const watcher = await watcherPromise

    // Trigger a change but don't wait for debounce
    todoWatcher.emit('change', '/test/.todo/task-1.md')
    vi.advanceTimersByTime(50) // Only advance halfway

    // Close watcher
    await watcher.close()

    // Advance past debounce
    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    // Sync should not have been called (timer was cleared)
    expect(sync).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('should not sync while already syncing', async () => {
    vi.useFakeTimers()

    // Make sync take some time
    let syncResolve: () => void
    const syncPromise = new Promise<SyncResult>((resolve) => {
      syncResolve = () => resolve({
        created: [],
        updated: [],
        deleted: [],
        filesWritten: [],
        conflicts: [],
      })
    })
    vi.mocked(sync).mockImplementation(() => syncPromise)

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
    })

    const watcher = await watcherPromise

    // Trigger first change
    todoWatcher.emit('change', '/test/.todo/task-1.md')
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called once
    expect(sync).toHaveBeenCalledTimes(1)

    // Trigger second change while first sync is still running
    todoWatcher.emit('change', '/test/.todo/task-2.md')
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should still only have been called once
    expect(sync).toHaveBeenCalledTimes(1)

    // Resolve first sync
    syncResolve!()
    await syncPromise

    // Now trigger another change
    vi.mocked(sync).mockResolvedValueOnce({
      created: [],
      updated: [],
      deleted: [],
      filesWritten: [],
      conflicts: [],
    })
    todoWatcher.emit('change', '/test/.todo/task-3.md')
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called again
    expect(sync).toHaveBeenCalledTimes(2)

    await watcher.close()
    vi.useRealTimers()
  })

  it('should use custom debounce time', async () => {
    vi.useFakeTimers()

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 500,
    })

    const watcher = await watcherPromise

    // Trigger change
    todoWatcher.emit('change', '/test/.todo/task-1.md')

    // Advance by less than custom debounce
    vi.advanceTimersByTime(400)

    // Sync should not have been called yet
    expect(sync).not.toHaveBeenCalled()

    // Advance past custom debounce
    vi.advanceTimersByTime(150)

    // Wait for promises to resolve
    await Promise.resolve()

    // Sync should have been called
    expect(sync).toHaveBeenCalledTimes(1)

    await watcher.close()
    vi.useRealTimers()
  })

  it('should throw error if beads directory not found', async () => {
    vi.mocked(findBeadsDir).mockResolvedValue(null)

    await expect(watch({ todoDir: '.todo' })).rejects.toThrow(
      'No .beads directory found. Run "bd init" first.'
    )
  })

  it('should pass conflict strategy to sync', async () => {
    vi.useFakeTimers()

    const watcherPromise = watch({
      todoDir: '.todo',
      debounceMs: 100,
      conflictStrategy: 'file-wins',
    })

    const watcher = await watcherPromise

    // Trigger change
    todoWatcher.emit('change', '/test/.todo/task-1.md')

    // Advance time past debounce
    vi.advanceTimersByTime(150)
    await vi.runAllTimersAsync()

    // Sync should have been called with custom conflict strategy
    expect(sync).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictStrategy: 'file-wins',
      })
    )

    await watcher.close()
    vi.useRealTimers()
  })

  // Race condition tests
  describe('race condition handling', () => {
    it('should queue changes that arrive during sync', async () => {
      vi.useFakeTimers()

      // Make sync take some time
      let syncResolve: () => void
      const syncPromise = new Promise<SyncResult>((resolve) => {
        syncResolve = () =>
          resolve({
            created: [],
            updated: [],
            deleted: [],
            filesWritten: [],
            conflicts: [],
          })
      })
      vi.mocked(sync).mockImplementationOnce(() => syncPromise)

      const watcherPromise = watch({
        todoDir: '.todo',
        debounceMs: 100,
      })

      const watcher = await watcherPromise

      // Trigger first change
      todoWatcher.emit('change', '/test/.todo/task-1.md')
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      // Sync should have been called once
      expect(sync).toHaveBeenCalledTimes(1)

      // While sync is running, trigger more changes
      todoWatcher.emit('change', '/test/.todo/task-2.md')
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      // Mock second sync
      vi.mocked(sync).mockResolvedValueOnce({
        created: [],
        updated: [],
        deleted: [],
        filesWritten: [],
        conflicts: [],
      })

      // Resolve first sync
      syncResolve!()
      await syncPromise

      // Wait a bit for the queued sync to trigger
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      // The change that arrived during sync should trigger another sync
      expect(sync).toHaveBeenCalledTimes(2)

      await watcher.close()
      vi.useRealTimers()
    })

    it('should only process last change when multiple rapid changes occur', async () => {
      vi.useFakeTimers()

      const events: WatchEvent[] = []
      const onChange = (event: WatchEvent) => {
        events.push(event)
      }

      const watcherPromise = watch({
        todoDir: '.todo',
        debounceMs: 300,
        onChange,
      })

      const watcher = await watcherPromise

      // Trigger multiple rapid changes with different paths
      todoWatcher.emit('change', '/test/.todo/task-1.md')
      vi.advanceTimersByTime(50)

      todoWatcher.emit('change', '/test/.todo/task-2.md')
      vi.advanceTimersByTime(50)

      todoWatcher.emit('change', '/test/.todo/task-3.md')
      vi.advanceTimersByTime(50)

      todoWatcher.emit('change', '/test/.todo/task-4.md')

      // None should have fired yet (only 150ms passed)
      expect(sync).not.toHaveBeenCalled()
      expect(events).toHaveLength(0)

      // Advance past debounce (need 300ms from last event)
      vi.advanceTimersByTime(350)
      await vi.runAllTimersAsync()

      // Sync should have been called exactly once
      expect(sync).toHaveBeenCalledTimes(1)

      // Only the LAST event should have been emitted
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        type: 'file-change',
        path: '/test/.todo/task-4.md',
      })

      await watcher.close()
      vi.useRealTimers()
    })

    it('should not lose changes that arrive just after debounce fires', async () => {
      vi.useFakeTimers()

      const watcherPromise = watch({
        todoDir: '.todo',
        debounceMs: 100,
      })

      const watcher = await watcherPromise

      // First change
      todoWatcher.emit('change', '/test/.todo/task-1.md')
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      expect(sync).toHaveBeenCalledTimes(1)

      // Second change arrives immediately
      todoWatcher.emit('change', '/test/.todo/task-2.md')
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      // Should trigger second sync
      expect(sync).toHaveBeenCalledTimes(2)

      await watcher.close()
      vi.useRealTimers()
    })

    it('should handle overlapping debounce windows correctly', async () => {
      vi.useFakeTimers()

      const watcherPromise = watch({
        todoDir: '.todo',
        debounceMs: 200,
      })

      const watcher = await watcherPromise

      // First change
      todoWatcher.emit('change', '/test/.todo/task-1.md')

      // Wait 150ms (not enough to trigger)
      vi.advanceTimersByTime(150)
      expect(sync).not.toHaveBeenCalled()

      // Second change resets the timer
      todoWatcher.emit('change', '/test/.todo/task-2.md')

      // Wait another 150ms (total 300ms from first, but only 150ms from second)
      vi.advanceTimersByTime(150)
      expect(sync).not.toHaveBeenCalled()

      // Wait the remaining 50ms to complete debounce from second change
      vi.advanceTimersByTime(100)
      await vi.runAllTimersAsync()

      // Should have called sync exactly once with the last change
      expect(sync).toHaveBeenCalledTimes(1)

      await watcher.close()
      vi.useRealTimers()
    })

    it('should serialize multiple overlapping sync operations', async () => {
      vi.useFakeTimers()

      let firstSyncResolve: () => void
      let secondSyncResolve: () => void

      const firstSyncPromise = new Promise<SyncResult>((resolve) => {
        firstSyncResolve = () =>
          resolve({
            created: [],
            updated: [],
            deleted: [],
            filesWritten: [],
            conflicts: [],
          })
      })

      const secondSyncPromise = new Promise<SyncResult>((resolve) => {
        secondSyncResolve = () =>
          resolve({
            created: [],
            updated: [],
            deleted: [],
            filesWritten: [],
            conflicts: [],
          })
      })

      let callCount = 0
      vi.mocked(sync).mockImplementation(() => {
        callCount++
        if (callCount === 1) return firstSyncPromise
        if (callCount === 2) return secondSyncPromise
        return Promise.resolve({
          created: [],
          updated: [],
          deleted: [],
          filesWritten: [],
          conflicts: [],
        })
      })

      const watcherPromise = watch({
        todoDir: '.todo',
        debounceMs: 100,
      })

      const watcher = await watcherPromise

      // First change
      todoWatcher.emit('change', '/test/.todo/task-1.md')
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      expect(sync).toHaveBeenCalledTimes(1)

      // Second change while first is still syncing
      todoWatcher.emit('change', '/test/.todo/task-2.md')
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      // Should still be 1 (second is queued)
      expect(sync).toHaveBeenCalledTimes(1)

      // Resolve first sync
      firstSyncResolve!()
      await firstSyncPromise

      // Wait for queued sync to trigger
      vi.advanceTimersByTime(150)
      await vi.runAllTimersAsync()

      // Now second sync should have started
      expect(sync).toHaveBeenCalledTimes(2)

      // Resolve second sync
      secondSyncResolve!()
      await secondSyncPromise

      await watcher.close()
      vi.useRealTimers()
    })
  })
})
