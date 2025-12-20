/**
 * File watcher for .todo/*.md bidirectional sync
 * Watches .todo/*.md files for changes and syncs back to beads
 */

import { watch as chokidarWatch } from 'chokidar'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseTodoFile } from './parser.js'
import type { Issue } from './types.js'
import { updateIssue, closeIssue } from 'beads-workflows'

export interface WatchOptions {
  /** Directory containing .todo files */
  todoDir?: string
  /** Debounce delay in milliseconds */
  debounceMs?: number
  /** Callback for watch events */
  onEvent?: (event: WatchEvent) => void
  /** Enable verbose logging */
  verbose?: boolean
}

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  issueId?: string
  action?: 'created' | 'updated' | 'deleted' | 'error'
  error?: string
}

/**
 * Cache of last known state for each file to detect changes
 */
interface FileState {
  issue: Partial<Issue>
  lastModified: number
}

/**
 * Watch .todo/*.md files for changes and sync back to beads
 */
export async function watch(options: WatchOptions = {}): Promise<() => void> {
  const {
    todoDir = '.todo',
    debounceMs = 500,
    onEvent,
    verbose = false,
  } = options

  // Cache of last known file state
  const fileStateCache = new Map<string, FileState>()

  // Debounce map to prevent rapid successive updates
  const debounceTimers = new Map<string, NodeJS.Timeout>()

  const log = (message: string) => {
    if (verbose) {
      console.log(`[watcher] ${message}`)
    }
  }

  /**
   * Process a file change and sync to beads
   */
  async function processFileChange(filepath: string, eventType: 'add' | 'change' | 'unlink') {
    const event: WatchEvent = {
      type: eventType,
      path: filepath,
    }

    try {
      // Handle file deletion
      if (eventType === 'unlink') {
        const cachedState = fileStateCache.get(filepath)
        if (cachedState?.issue.beadsId) {
          log(`File deleted: ${filepath} (issue ${cachedState.issue.beadsId})`)

          // Optionally close the issue in beads
          // For now, just log - user can configure whether to auto-close
          event.issueId = cachedState.issue.beadsId
          event.action = 'deleted'
          log(`Issue ${cachedState.issue.beadsId} file deleted - not auto-closing`)
        }
        fileStateCache.delete(filepath)
        onEvent?.(event)
        return
      }

      // Read and parse the file
      const content = await readFile(filepath, 'utf-8')
      const parsed = parseTodoFile(content)

      // Extract issue ID from beadsId field
      const beadsId = parsed.issue.beadsId
      if (!beadsId) {
        log(`Skipping ${filepath} - no beadsId in frontmatter`)
        return
      }

      event.issueId = beadsId

      // Get cached state
      const cachedState = fileStateCache.get(filepath)

      // For 'add' events, just cache the state without syncing
      if (eventType === 'add') {
        fileStateCache.set(filepath, {
          issue: parsed.issue,
          lastModified: Date.now(),
        })
        log(`Tracking new file: ${filepath} (issue ${beadsId})`)
        event.action = 'created'
        onEvent?.(event)
        return
      }

      // For 'change' events, detect what changed
      if (!cachedState) {
        // First time seeing this file in a change event - cache and skip sync
        fileStateCache.set(filepath, {
          issue: parsed.issue,
          lastModified: Date.now(),
        })
        log(`Cached initial state for ${filepath}`)
        return
      }

      // Compare current vs cached to detect changes
      const changes = detectChanges(cachedState.issue, parsed.issue)
      if (Object.keys(changes).length === 0) {
        log(`No changes detected in ${filepath}`)
        return
      }

      log(`Changes detected in ${filepath}: ${Object.keys(changes).join(', ')}`)

      // Sync changes to beads
      const result = await updateIssue(beadsId, changes)

      if (result.success) {
        log(`Synced changes to beads issue ${beadsId}`)
        event.action = 'updated'

        // Update cache with new state
        fileStateCache.set(filepath, {
          issue: parsed.issue,
          lastModified: Date.now(),
        })
      } else {
        log(`Failed to sync changes to beads: ${result.error}`)
        event.action = 'error'
        event.error = result.error
      }

      onEvent?.(event)
    } catch (error) {
      log(`Error processing ${filepath}: ${error}`)
      event.action = 'error'
      event.error = error instanceof Error ? error.message : String(error)
      onEvent?.(event)
    }
  }

  /**
   * Debounced file change handler
   */
  function handleFileChange(filepath: string, eventType: 'add' | 'change' | 'unlink') {
    // Clear existing timer
    const existingTimer = debounceTimers.get(filepath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      debounceTimers.delete(filepath)
      processFileChange(filepath, eventType).catch((error) => {
        log(`Unhandled error in processFileChange: ${error}`)
      })
    }, debounceMs)

    debounceTimers.set(filepath, timer)
  }

  // Initialize chokidar watcher
  log(`Starting file watcher on ${todoDir}/*.md`)

  const watcher = chokidarWatch(join(todoDir, '*.md'), {
    persistent: true,
    ignoreInitial: false, // Process initial files to build cache
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  watcher
    .on('add', (path) => handleFileChange(path, 'add'))
    .on('change', (path) => handleFileChange(path, 'change'))
    .on('unlink', (path) => handleFileChange(path, 'unlink'))
    .on('error', (error) => {
      log(`Watcher error: ${error}`)
    })

  log('File watcher started')

  // Return cleanup function
  return async () => {
    log('Stopping file watcher')

    // Clear all debounce timers
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer)
    }
    debounceTimers.clear()

    // Close watcher
    await watcher.close()

    log('File watcher stopped')
  }
}

/**
 * Detect which fields changed between cached and current issue
 * Returns only the changed fields suitable for beads updateIssue()
 */
function detectChanges(
  cached: Partial<Issue>,
  current: Partial<Issue>
): Record<string, unknown> {
  const changes: Record<string, unknown> = {}

  // Map Issue.state to beads status
  // Note: 'blocked' is not a beads status - it's tracked via dependencies
  // Map 'blocked' to 'open' when syncing to beads
  if (current.state !== cached.state && current.state) {
    const beadsStatus = current.state === 'blocked' ? 'open' : current.state
    changes.status = beadsStatus
  }

  if (current.priority !== cached.priority && current.priority !== undefined) {
    changes.priority = current.priority
  }

  // assignees array -> single assignee string
  if (JSON.stringify(current.assignees) !== JSON.stringify(cached.assignees)) {
    changes.assignee = current.assignees?.[0] || ''
  }

  if (current.title !== cached.title && current.title) {
    changes.title = current.title
  }

  if (current.body !== cached.body && current.body !== undefined) {
    changes.description = current.body
  }

  if (JSON.stringify(current.labels) !== JSON.stringify(cached.labels)) {
    changes.labels = current.labels || []
  }

  return changes
}
