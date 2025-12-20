/**
 * Watcher for beads database changes
 * Monitors .beads/issues.jsonl and emits events on changes
 */

import { watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import type { BeadsIssue, IssueWithReadyState } from './types.js'
import {
  readIssuesFromJsonl,
  readDependenciesFromJsonl,
  getIssuesWithReadyState,
  getEpicProgress,
} from './beads.js'
import { WorkflowEventEmitter, detectChanges, createEventFactories } from './events.js'

const ISSUES_FILE = 'issues.jsonl'
const DEPS_FILE = 'dependencies.jsonl'

export interface WatcherOptions {
  /** Debounce interval in milliseconds */
  debounceMs?: number
}

/**
 * Beads database watcher
 * Monitors for changes and emits workflow events
 */
export class BeadsWatcher {
  private beadsDir: string
  private emitter: WorkflowEventEmitter
  private watcher: FSWatcher | null = null
  private options: Required<WatcherOptions>

  private issueSnapshot = new Map<string, IssueWithReadyState>()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  private events = createEventFactories()

  constructor(
    beadsDir: string,
    emitter: WorkflowEventEmitter,
    options: WatcherOptions = {}
  ) {
    this.beadsDir = beadsDir
    this.emitter = emitter
    this.options = {
      debounceMs: options.debounceMs ?? 100,
    }
  }

  /**
   * Start watching for changes
   */
  async start(): Promise<void> {
    // Take initial snapshot
    await this.refreshSnapshot()

    // Start watching
    this.watcher = watch(this.beadsDir, { persistent: true }, (eventType, filename) => {
      if (filename === ISSUES_FILE || filename === DEPS_FILE) {
        this.handleChange()
      }
    })
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  /**
   * Handle a file change event (debounced)
   */
  private handleChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.processChanges().catch(console.error)
    }, this.options.debounceMs)
  }

  /**
   * Process changes and emit events
   */
  private async processChanges(): Promise<void> {
    const oldSnapshot = this.issueSnapshot
    const newIssues = await getIssuesWithReadyState(this.beadsDir)
    const newSnapshot = new Map(newIssues.map(i => [i.id, i]))

    // Detect created, updated, and deleted issues
    for (const [id, newIssue] of newSnapshot) {
      const oldIssue = oldSnapshot.get(id)

      if (!oldIssue) {
        // New issue created
        await this.emitter.emit(this.events.issueCreated(newIssue))

        // Check if it's immediately ready
        if (newIssue.isReady) {
          await this.emitter.emit(this.events.issueReady(newIssue))
        }
      } else {
        // Check for changes
        const changes = detectChanges(oldIssue, newIssue)

        if (changes) {
          // Emit generic update event
          await this.emitter.emit(this.events.issueUpdated(newIssue, oldIssue, changes))

          // Check for specific state transitions
          await this.handleStateTransitions(oldIssue, newIssue)
        }
      }
    }

    // Check for deleted issues (less common but possible)
    for (const [id, oldIssue] of oldSnapshot) {
      if (!newSnapshot.has(id)) {
        // Issue was deleted - treat as closed
        await this.emitter.emit(this.events.issueClosed(oldIssue, 'deleted'))
      }
    }

    // Update snapshot
    this.issueSnapshot = newSnapshot
  }

  /**
   * Handle state transitions and emit appropriate events
   */
  private async handleStateTransitions(
    oldIssue: IssueWithReadyState,
    newIssue: IssueWithReadyState
  ): Promise<void> {
    // Status transitions
    if (oldIssue.status !== newIssue.status) {
      // Closed
      if (newIssue.status === 'closed') {
        await this.emitter.emit(this.events.issueClosed(newIssue))

        // Check if this unblocks other issues
        await this.checkUnblockedIssues(newIssue.id)

        // Check if this completes an epic
        await this.checkEpicCompletion(newIssue.id)
      }

      // Reopened
      if (oldIssue.status === 'closed' && newIssue.status !== 'closed') {
        await this.emitter.emit(this.events.issueReopened(newIssue, oldIssue))
      }
    }

    // Ready state transitions
    if (!oldIssue.isReady && newIssue.isReady) {
      // Became ready
      await this.emitter.emit(this.events.issueReady(newIssue))
    } else if (oldIssue.isReady && !newIssue.isReady) {
      // Became blocked
      if (newIssue.blockedBy.length > 0) {
        await this.emitter.emit(this.events.issueBlocked(newIssue, newIssue.blockedBy))
      }
    }
  }

  /**
   * Check if closing an issue unblocked others
   */
  private async checkUnblockedIssues(closedIssueId: string): Promise<void> {
    const newIssues = await getIssuesWithReadyState(this.beadsDir)

    for (const issue of newIssues) {
      const oldIssue = this.issueSnapshot.get(issue.id)

      // If the issue was blocked before but is ready now
      if (oldIssue && !oldIssue.isReady && issue.isReady) {
        // Check if it was blocked by the closed issue
        if (oldIssue.blockedBy.includes(closedIssueId)) {
          await this.emitter.emit(this.events.issueReady(issue, closedIssueId))
        }
      }
    }
  }

  /**
   * Check if closing an issue completed an epic
   */
  private async checkEpicCompletion(closedIssueId: string): Promise<void> {
    const deps = await readDependenciesFromJsonl(this.beadsDir)
    const issues = await readIssuesFromJsonl(this.beadsDir)
    const issueMap = new Map(issues.map(i => [i.id, i]))

    // Find parent epics of the closed issue
    const parentEpicIds = deps
      .filter(d => d.dep_type === 'parent-child' && d.issue_id === closedIssueId)
      .map(d => d.depends_on_id)

    for (const epicId of parentEpicIds) {
      const epic = issueMap.get(epicId)
      if (!epic || epic.issue_type !== 'epic') continue

      const progress = await getEpicProgress(this.beadsDir, epicId)

      // Emit progress event
      await this.emitter.emit(
        this.events.epicProgress(epic, progress.completed, progress.total)
      )

      // Check if completed
      if (progress.total > 0 && progress.completed === progress.total) {
        const childIds = progress.children.map(c => c.id)
        await this.emitter.emit(this.events.epicCompleted(epic, childIds))
      }
    }
  }

  /**
   * Refresh the snapshot without emitting events
   * Useful for initialization
   */
  async refreshSnapshot(): Promise<void> {
    const issues = await getIssuesWithReadyState(this.beadsDir)
    this.issueSnapshot = new Map(issues.map(i => [i.id, i]))
  }

  /**
   * Get current snapshot for debugging
   */
  getSnapshot(): Map<string, IssueWithReadyState> {
    return new Map(this.issueSnapshot)
  }
}

/**
 * Create and start a watcher
 */
export async function createWatcher(
  beadsDir: string,
  emitter: WorkflowEventEmitter,
  options?: WatcherOptions
): Promise<BeadsWatcher> {
  const watcher = new BeadsWatcher(beadsDir, emitter, options)
  await watcher.start()
  return watcher
}
