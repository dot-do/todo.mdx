/**
 * File watcher for bi-directional sync between beads and .todo/*.md files
 *
 * This module provides a file watcher that monitors changes to:
 * - .beads/issues.jsonl (beads issue tracker)
 * - .todo/*.md files (markdown files with YAML frontmatter)
 *
 * Features:
 * - Debounced file watching to avoid sync storms from rapid changes
 * - Cross-platform support via chokidar
 * - Event emission for monitoring
 * - Graceful error handling
 *
 * @example
 * ```ts
 * import { watch } from 'todo.mdx'
 *
 * const watcher = await watch({
 *   todoDir: '.todo',
 *   debounceMs: 300,
 *   onChange: (event) => {
 *     console.log(`File changed: ${event.type} ${event.path}`)
 *   },
 * })
 *
 * // Later, clean up
 * await watcher.close()
 * ```
 */

import chokidar from 'chokidar'
import { sync } from './sync.js'
import type { TodoConfig, WatchEvent } from './types.js'
import { findBeadsDir } from 'beads-workflows'
import { resolve } from 'node:path'

/**
 * Options for watch operation
 */
export interface WatchOptions extends TodoConfig {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number
  /** Callback for file change events (can be async) */
  onChange?: (event: WatchEvent) => void | Promise<void>
  /** Callback for error handling (called when onChange or sync throws) */
  onError?: (error: unknown, event: WatchEvent) => void
}

/**
 * Watcher instance
 */
export interface Watcher {
  /** Close the watcher and clean up resources */
  close(): Promise<void>
}

/**
 * Internal watcher state
 */
interface WatcherState {
  beadsWatcher?: ReturnType<typeof chokidar.watch>
  todoWatcher?: ReturnType<typeof chokidar.watch>
  debounceTimer?: NodeJS.Timeout
  isReady: boolean
  isSyncing: boolean
  pendingEvent?: WatchEvent
}

/**
 * Start watching for file changes and trigger sync
 *
 * @param options - Watch options including config and callbacks
 * @returns Watcher instance with close method
 */
export async function watch(options: WatchOptions = {}): Promise<Watcher> {
  const {
    beadsDir,
    todoDir = '.todo',
    debounceMs = 300,
    onChange,
    onError,
    conflictStrategy = 'newest-wins',
  } = options

  // Resolve beads directory
  const resolvedBeadsDir = beadsDir || (await findBeadsDir(process.cwd()))
  if (!resolvedBeadsDir) {
    throw new Error('No .beads directory found. Run "bd init" first.')
  }

  // Resolve todo directory to absolute path
  const resolvedTodoDir = resolve(process.cwd(), todoDir)

  // State for managing watchers and debouncing
  const state: WatcherState = {
    isReady: false,
    isSyncing: false,
  }

  /**
   * Trigger a sync with debouncing and race condition prevention
   *
   * Race condition handling:
   * - Multiple rapid changes are debounced (only last one fires)
   * - Changes during sync are queued and processed after completion
   * - Overlapping debounce windows are properly handled
   */
  const triggerSync = (event: WatchEvent) => {
    // Clear existing timer to reset debounce window
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer)
    }

    // Set new timer
    state.debounceTimer = setTimeout(async () => {
      // If already syncing, queue this event for later (prevents lost changes)
      if (state.isSyncing) {
        state.pendingEvent = event
        return
      }

      // Skip if not ready
      if (!state.isReady) {
        return
      }

      try {
        state.isSyncing = true

        // Emit change event (await in case callback is async)
        if (onChange) {
          await Promise.resolve(onChange(event))
        }

        // Perform sync
        await sync({
          beadsDir: resolvedBeadsDir,
          todoDir: resolvedTodoDir,
          conflictStrategy,
        })
      } catch (error) {
        // Handle error with custom callback or default to console.error
        if (onError) {
          onError(error, event)
        } else {
          console.error('Watcher callback failed:', error)
        }
      } finally {
        state.isSyncing = false

        // Process any pending event that arrived during sync
        if (state.pendingEvent) {
          const pending = state.pendingEvent
          state.pendingEvent = undefined
          triggerSync(pending)
        }
      }
    }, debounceMs)
  }

  // Watch .beads/issues.jsonl
  const beadsPath = resolve(resolvedBeadsDir, 'issues.jsonl')
  state.beadsWatcher = chokidar.watch(beadsPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  state.beadsWatcher.on('change', (path: string) => {
    triggerSync({
      type: 'beads-change',
      path,
    })
  })

  state.beadsWatcher.on('error', (error: unknown) => {
    console.error('Beads watcher error:', error)
  })

  // Watch .todo/*.md files
  const todoPattern = resolve(resolvedTodoDir, '*.md')
  state.todoWatcher = chokidar.watch(todoPattern, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  state.todoWatcher.on('add', (path: string) => {
    triggerSync({
      type: 'file-change',
      path,
    })
  })

  state.todoWatcher.on('change', (path: string) => {
    triggerSync({
      type: 'file-change',
      path,
    })
  })

  state.todoWatcher.on('unlink', (path: string) => {
    triggerSync({
      type: 'file-change',
      path,
    })
  })

  state.todoWatcher.on('error', (error: unknown) => {
    console.error('Todo watcher error:', error)
  })

  // Wait for both watchers to be ready
  await Promise.all([
    new Promise<void>((resolve) => {
      state.beadsWatcher!.on('ready', () => resolve())
    }),
    new Promise<void>((resolve) => {
      state.todoWatcher!.on('ready', () => resolve())
    }),
  ])

  state.isReady = true

  // Return watcher interface
  return {
    async close() {
      // IMPORTANT: Set isReady to false FIRST to prevent any pending or queued
      // callbacks from processing. This prevents a race condition where:
      // 1. A debounced callback fires and is queued in the event loop
      // 2. close() is called but only sets isReady=false at the end
      // 3. The callback runs while close() is awaiting watcher.close()
      // 4. The callback sees isReady=true and processes the event
      state.isReady = false

      // Clear any pending debounce timer
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer)
      }

      // Clear any pending events
      state.pendingEvent = undefined

      // Close both watchers
      await Promise.all([
        state.beadsWatcher?.close(),
        state.todoWatcher?.close(),
      ])
    },
  }
}
