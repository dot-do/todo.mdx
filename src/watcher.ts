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
  /** Callback for file change events */
  onChange?: (event: WatchEvent) => void
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
   * Trigger a sync with debouncing
   */
  const triggerSync = (event: WatchEvent) => {
    // Clear existing timer
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer)
    }

    // Set new timer
    state.debounceTimer = setTimeout(async () => {
      // Skip if already syncing or not ready
      if (state.isSyncing || !state.isReady) {
        return
      }

      try {
        state.isSyncing = true

        // Emit change event
        if (onChange) {
          onChange(event)
        }

        // Perform sync
        await sync({
          beadsDir: resolvedBeadsDir,
          todoDir: resolvedTodoDir,
          conflictStrategy,
        })
      } catch (error) {
        // Log error but don't crash
        console.error('Sync failed:', error)
      } finally {
        state.isSyncing = false
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
      // Clear any pending debounce timer
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer)
      }

      // Close both watchers
      await Promise.all([
        state.beadsWatcher?.close(),
        state.todoWatcher?.close(),
      ])

      state.isReady = false
    },
  }
}
