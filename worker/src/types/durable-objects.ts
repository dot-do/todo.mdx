/**
 * Durable Object types and context interfaces
 */

import type { Env } from './env'

// Base DO context type
export interface DurableObjectContext {
  id: DurableObjectId
  storage: DurableObjectStorage
  env: Env
  ctx: ExecutionContext
}

// RepoDO types
export interface RepoDOState {
  repoFullName?: string
  installationId?: number
  lastSyncAt?: number
  syncInProgress?: boolean
}

export interface RepoDOContext {
  repoFullName: string
  installationId: number
}

export interface GitHubIssueWebhook {
  action: 'opened' | 'edited' | 'closed' | 'reopened' | 'deleted' | 'transferred' | 'labeled' | 'unlabeled' | 'assigned' | 'unassigned'
  issue: {
    id: number
    number: number
    title: string
    body: string | null
    state: 'open' | 'closed'
    labels: Array<{ id: number; name: string; color: string; description: string | null }>
    assignee: { login: string; id: number } | null
    created_at: string
    updated_at: string
    closed_at: string | null
  }
}

export interface BeadsWebhook {
  commit: string
  files: string[]
  repoFullName: string
  installationId: number
}

// ProjectDO types
export interface ProjectDOState {
  projectNodeId?: string
  number?: number
  title?: string
  owner?: string
  repos?: string[]
  items?: ProjectItem[]
  fields?: ProjectField[]
  milestoneMapping?: Record<string, string>
}

export interface ProjectInfo {
  nodeId: string
  number: number
  title: string
  shortDescription?: string | null
  public: boolean
  closed: boolean
  owner: string
  createdAt: string
  updatedAt: string
}

export interface ProjectItem {
  nodeId: string
  id: number
  contentNodeId: string
  contentType: 'Issue' | 'PullRequest' | 'DraftIssue'
  creator?: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  isArchived: boolean
}

export interface ProjectField {
  nodeId: string
  name: string
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION'
  options?: Array<{
    id: string
    name: string
    color?: string
  }>
}

export interface ProjectItemFieldValue {
  type: string
  from: string | number | null
  to: string | number | null
}

// PRDO types
export interface PRDOState {
  repoFullName?: string
  prNumber?: number
  installationId?: number
  machineState?: string
  author?: string
  base?: string
  head?: string
  lastEventAt?: number
}

export type PRDOEventType =
  | 'PR_OPENED'
  | 'REVIEW_COMPLETE'
  | 'FIX_COMPLETE'
  | 'CLOSE'

export interface PRDOEvent {
  type: PRDOEventType
  // PR_OPENED fields
  prNumber?: number
  repoFullName?: string
  author?: string
  base?: string
  head?: string
  installationId?: number
  // REVIEW_COMPLETE fields
  reviewer?: string
  decision?: 'approved' | 'changes_requested'
  body?: string
  // FIX_COMPLETE fields
  commits?: Array<{
    id: string
    message: string
    author: { name: string; email: string }
    timestamp: string
  }>
  // CLOSE fields
  merged?: boolean
}

// SessionDO types
export interface SessionDOState {
  userId?: string
  email?: string
  workosUserId?: string
  createdAt?: number
  expiresAt?: number
  lastAccessedAt?: number
}

export interface SessionData {
  userId: string
  email: string
  workosUserId: string
  createdAt: number
  expiresAt: number
}
