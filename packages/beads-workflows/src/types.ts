/**
 * Types for beads-workflows
 */

/** Issue status */
export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'closed'

/** Issue type */
export type IssueType = 'bug' | 'feature' | 'task' | 'epic' | 'chore'

/** Dependency type */
export type DependencyType = 'blocks' | 'related' | 'parent-child' | 'discovered-from'

/** Issue from beads database */
export interface BeadsIssue {
  id: string
  title: string
  description: string
  design?: string | null
  acceptance_criteria?: string | null
  notes?: string | null
  external_ref?: string | null
  status: IssueStatus
  priority: number
  issue_type: IssueType
  created_at: string
  updated_at: string
  closed_at?: string | null
  assignee?: string | null
  labels: string[]
}

/** Dependency between issues */
export interface Dependency {
  issue_id: string
  depends_on_id: string
  dep_type: DependencyType
}

/** Issue with computed ready state */
export interface IssueWithReadyState extends BeadsIssue {
  isReady: boolean
  blockedBy: string[]
}

/** Event types for workflow triggers */
export type WorkflowEventType =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.ready'
  | 'issue.blocked'
  | 'issue.closed'
  | 'issue.reopened'
  | 'epic.completed'
  | 'epic.progress'

/** Base event payload */
export interface WorkflowEvent<T extends WorkflowEventType = WorkflowEventType> {
  type: T
  timestamp: Date
  issue: BeadsIssue
  previousState?: Partial<BeadsIssue>
}

/** Event: Issue became ready (no blockers) */
export interface IssueReadyEvent extends WorkflowEvent<'issue.ready'> {
  type: 'issue.ready'
  unblockedBy?: string // Issue ID that was closed to unblock this one
}

/** Event: Issue became blocked */
export interface IssueBlockedEvent extends WorkflowEvent<'issue.blocked'> {
  type: 'issue.blocked'
  blockedBy: string[] // Issue IDs blocking this one
}

/** Event: Issue was closed */
export interface IssueClosedEvent extends WorkflowEvent<'issue.closed'> {
  type: 'issue.closed'
  reason?: string
}

/** Event: Issue was created */
export interface IssueCreatedEvent extends WorkflowEvent<'issue.created'> {
  type: 'issue.created'
}

/** Event: Issue was updated */
export interface IssueUpdatedEvent extends WorkflowEvent<'issue.updated'> {
  type: 'issue.updated'
  changes: Partial<BeadsIssue>
}

/** Event: Issue was reopened */
export interface IssueReopenedEvent extends WorkflowEvent<'issue.reopened'> {
  type: 'issue.reopened'
}

/** Event: Epic completed (all children closed) */
export interface EpicCompletedEvent extends WorkflowEvent<'epic.completed'> {
  type: 'epic.completed'
  childIssues: string[]
}

/** Event: Epic progress changed */
export interface EpicProgressEvent extends WorkflowEvent<'epic.progress'> {
  type: 'epic.progress'
  completed: number
  total: number
  percentage: number
}

/** Union of all workflow events */
export type AnyWorkflowEvent =
  | IssueReadyEvent
  | IssueBlockedEvent
  | IssueClosedEvent
  | IssueCreatedEvent
  | IssueUpdatedEvent
  | IssueReopenedEvent
  | EpicCompletedEvent
  | EpicProgressEvent

/** Event handler function */
export type EventHandler<T extends AnyWorkflowEvent = AnyWorkflowEvent> = (event: T) => void | Promise<void>

/** Unsubscribe function */
export type Unsubscribe = () => void
