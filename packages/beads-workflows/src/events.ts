/**
 * Event emitter for beads workflow events
 */

import type {
  WorkflowEventType,
  AnyWorkflowEvent,
  EventHandler,
  Unsubscribe,
  BeadsIssue,
  IssueReadyEvent,
  IssueBlockedEvent,
  IssueClosedEvent,
  IssueCreatedEvent,
  IssueUpdatedEvent,
  IssueReopenedEvent,
  EpicCompletedEvent,
  EpicProgressEvent,
} from './types.js'

type EventMap = {
  'issue.created': IssueCreatedEvent
  'issue.updated': IssueUpdatedEvent
  'issue.ready': IssueReadyEvent
  'issue.blocked': IssueBlockedEvent
  'issue.closed': IssueClosedEvent
  'issue.reopened': IssueReopenedEvent
  'epic.completed': EpicCompletedEvent
  'epic.progress': EpicProgressEvent
}

/**
 * Workflow event emitter
 */
export class WorkflowEventEmitter {
  private handlers = new Map<WorkflowEventType, Set<EventHandler>>()
  private allHandlers = new Set<EventHandler>()

  /**
   * Subscribe to a specific event type
   */
  on<T extends WorkflowEventType>(
    eventType: T,
    handler: EventHandler<EventMap[T]>
  ): Unsubscribe {
    let handlers = this.handlers.get(eventType)
    if (!handlers) {
      handlers = new Set()
      this.handlers.set(eventType, handlers)
    }
    handlers.add(handler as EventHandler)

    return () => {
      handlers?.delete(handler as EventHandler)
    }
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: EventHandler<AnyWorkflowEvent>): Unsubscribe {
    this.allHandlers.add(handler)
    return () => {
      this.allHandlers.delete(handler)
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit<T extends WorkflowEventType>(event: EventMap[T]): Promise<void> {
    const handlers = this.handlers.get(event.type) || new Set()

    const promises: Promise<void>[] = []

    // Call specific handlers
    for (const handler of handlers) {
      const result = handler(event)
      if (result instanceof Promise) {
        promises.push(result)
      }
    }

    // Call all-event handlers
    for (const handler of this.allHandlers) {
      const result = handler(event)
      if (result instanceof Promise) {
        promises.push(result)
      }
    }

    await Promise.all(promises)
  }

  /**
   * Remove all handlers
   */
  clear(): void {
    this.handlers.clear()
    this.allHandlers.clear()
  }

  /**
   * Get count of handlers for debugging
   */
  get handlerCount(): number {
    let count = this.allHandlers.size
    for (const handlers of this.handlers.values()) {
      count += handlers.size
    }
    return count
  }
}

/**
 * Compare two issues and detect changes
 */
export function detectChanges(
  oldIssue: BeadsIssue,
  newIssue: BeadsIssue
): Partial<BeadsIssue> | null {
  const changes: Partial<BeadsIssue> = {}
  let hasChanges = false

  const keys: (keyof BeadsIssue)[] = [
    'title',
    'description',
    'design',
    'acceptance_criteria',
    'notes',
    'external_ref',
    'status',
    'priority',
    'issue_type',
    'assignee',
  ]

  for (const key of keys) {
    if (oldIssue[key] !== newIssue[key]) {
      ;(changes as Record<string, unknown>)[key] = newIssue[key]
      hasChanges = true
    }
  }

  // Check labels array
  const oldLabels = JSON.stringify(oldIssue.labels?.sort() || [])
  const newLabels = JSON.stringify(newIssue.labels?.sort() || [])
  if (oldLabels !== newLabels) {
    changes.labels = newIssue.labels
    hasChanges = true
  }

  return hasChanges ? changes : null
}

/**
 * Create event factory functions
 */
export function createEventFactories() {
  return {
    issueCreated(issue: BeadsIssue): IssueCreatedEvent {
      return {
        type: 'issue.created',
        timestamp: new Date(),
        issue,
      }
    },

    issueUpdated(
      issue: BeadsIssue,
      previousState: Partial<BeadsIssue>,
      changes: Partial<BeadsIssue>
    ): IssueUpdatedEvent {
      return {
        type: 'issue.updated',
        timestamp: new Date(),
        issue,
        previousState,
        changes,
      }
    },

    issueReady(issue: BeadsIssue, unblockedBy?: string): IssueReadyEvent {
      return {
        type: 'issue.ready',
        timestamp: new Date(),
        issue,
        unblockedBy,
      }
    },

    issueBlocked(issue: BeadsIssue, blockedBy: string[]): IssueBlockedEvent {
      return {
        type: 'issue.blocked',
        timestamp: new Date(),
        issue,
        blockedBy,
      }
    },

    issueClosed(issue: BeadsIssue, reason?: string): IssueClosedEvent {
      return {
        type: 'issue.closed',
        timestamp: new Date(),
        issue,
        reason,
      }
    },

    issueReopened(
      issue: BeadsIssue,
      previousState: Partial<BeadsIssue>
    ): IssueReopenedEvent {
      return {
        type: 'issue.reopened',
        timestamp: new Date(),
        issue,
        previousState,
      }
    },

    epicCompleted(issue: BeadsIssue, childIssues: string[]): EpicCompletedEvent {
      return {
        type: 'epic.completed',
        timestamp: new Date(),
        issue,
        childIssues,
      }
    },

    epicProgress(
      issue: BeadsIssue,
      completed: number,
      total: number
    ): EpicProgressEvent {
      return {
        type: 'epic.progress',
        timestamp: new Date(),
        issue,
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      }
    },
  }
}
