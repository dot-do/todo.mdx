/**
 * API request/response types
 */

import type { Issue, Milestone } from './env'

// Issue API types
export interface CreateIssueRequest {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
  milestoneId?: string
  priority?: number
}

export interface UpdateIssueRequest {
  title?: string
  body?: string
  status?: 'open' | 'in_progress' | 'closed'
  labels?: string[]
  assignees?: string[]
  milestoneId?: string
  priority?: number
}

export interface IssueResponse extends Issue {
  repo?: string
  milestone?: Milestone
}

export interface IssuesListResponse {
  issues: IssueResponse[]
  total: number
  page: number
  limit: number
}

// Milestone API types
export interface CreateMilestoneRequest {
  title: string
  description?: string
  dueOn?: string
}

export interface UpdateMilestoneRequest {
  title?: string
  description?: string
  state?: 'open' | 'closed'
  dueOn?: string
}

export interface MilestoneResponse extends Milestone {
  repo?: string
  issueCount?: number
  closedIssueCount?: number
  progress?: number
}

export interface MilestonesListResponse {
  milestones: MilestoneResponse[]
  total: number
  page: number
  limit: number
}

// Repo API types
export interface RepoResponse {
  id: string
  githubId: number
  name: string
  fullName: string
  owner: string
  private: boolean
  installation: string
  issueCount?: number
  milestoneCount?: number
}

export interface ReposListResponse {
  repos: RepoResponse[]
  total: number
}

// Search API types
export interface SearchRequest {
  query: string
  repo?: string
  type?: 'issue' | 'milestone' | 'all'
  limit?: number
  offset?: number
}

export interface SearchResult {
  type: 'issue' | 'milestone'
  id: string
  title: string
  body?: string
  repo: string
  url: string
  score: number
  highlights?: string[]
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
  took: number
}

// Installation API types
export interface InstallationResponse {
  id: string
  installationId: number
  accountType: string
  accountId: number
  accountLogin: string
  accountAvatarUrl: string
  repositorySelection: string
  repoCount?: number
}

// Sync status types
export interface SyncStatusResponse {
  state: string
  lastSyncAt?: string
  error?: string
  pendingEvents: number
  repoFullName?: string
  issuesSynced?: number
  milestonesSynced?: number
}

// Project API types
export interface ProjectResponse {
  nodeId: string
  number: number
  title: string
  shortDescription?: string
  public: boolean
  closed: boolean
  owner: string
  createdAt: string
  updatedAt: string
  itemCount?: number
  repos?: string[]
}

export interface ProjectItemResponse {
  nodeId: string
  id: number
  contentNodeId: string
  contentType: 'Issue' | 'PullRequest' | 'DraftIssue'
  creator?: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  isArchived: boolean
  fields?: Record<string, string | number | null>
}

export interface ProjectFieldResponse {
  nodeId: string
  name: string
  dataType: string
  options?: Array<{
    id: string
    name: string
    color?: string
  }>
}

// Error response
export interface ErrorResponse {
  error: string
  message?: string
  details?: Record<string, unknown>
}
