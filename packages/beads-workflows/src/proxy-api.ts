/**
 * Proxy API Types
 * Defines the global objects available in workflow code
 *
 * These are available via globalThis when executing workflows:
 * - claude: Agent spawning and interaction
 * - github: GitHub API operations
 * - git: Local git operations
 * - beads: Issue tracking
 * - todo: Context rendering
 * - slack: Notifications
 */

import type { BeadsIssue } from './types.js'

// =============================================================================
// Claude API - Agent Spawning
// =============================================================================

export interface ClaudeSpawnOptions {
  /** Repository to work in */
  repo: string
  /** Task description for the agent */
  task: string
  /** Additional context (e.g., TODO.md content) */
  context?: string
  /** Branch to work on (optional) */
  branch?: string
}

export interface ClaudeSpawnResult {
  /** Whether the task succeeded */
  success: boolean
  /** Summary of what was done */
  summary: string
  /** Git diff of changes */
  diff?: string
  /** Error message if failed */
  error?: string
}

export interface ClaudeApi {
  /** Spawn a Claude agent to work on a task */
  spawn(options: ClaudeSpawnOptions): Promise<ClaudeSpawnResult>
  /** Request code review on a PR */
  review(pr: PullRequest): Promise<ReviewResult>
  /** Ask Claude a question */
  ask(question: string): Promise<string>
}

// =============================================================================
// GitHub API
// =============================================================================

export interface PullRequest {
  number: number
  title: string
  body: string
  head: string
  base: string
  url: string
  state: 'open' | 'closed' | 'merged'
}

export interface CreatePROptions {
  /** Branch with changes */
  branch: string
  /** PR title */
  title: string
  /** PR body/description */
  body: string
  /** Issue to close (optional) */
  issue?: string | number
  /** Git diff to apply (optional, for cloud execution) */
  diff?: string
}

export interface ReviewResult {
  /** Whether review approved */
  approved: boolean
  /** Review comments */
  comments: string[]
}

export interface GitHubPrApi {
  create(options: CreatePROptions): Promise<PullRequest>
  merge(pr: PullRequest): Promise<void>
  comment(pr: PullRequest, message: string): Promise<void>
  review(pr: PullRequest, options: { approve: boolean; body?: string }): Promise<void>
}

export interface CreateIssueOptions {
  title: string
  body: string
  labels?: string[]
}

export interface GitHubIssue {
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  url: string
}

export interface GitHubIssuesApi {
  create(options: CreateIssueOptions): Promise<GitHubIssue>
  comment(issue: GitHubIssue | number, message: string): Promise<void>
}

export interface GitHubApi {
  /** Current repository (owner/repo) */
  repo: string
  /** Pull request operations */
  pr: GitHubPrApi
  /** Issue operations */
  issues: GitHubIssuesApi
}

// =============================================================================
// Git API - Local Operations
// =============================================================================

export interface GitWorktreeApi {
  create(name: string): Promise<string>
  remove(name: string): Promise<void>
  list(): Promise<string[]>
}

export interface GitApi {
  worktree: GitWorktreeApi
  commit(message: string): Promise<void>
  push(branch?: string): Promise<void>
  pull(): Promise<void>
  checkout(branch: string): Promise<void>
  branch: {
    create(name: string): Promise<void>
    delete(name: string): Promise<void>
    current(): Promise<string>
  }
}

// =============================================================================
// Beads API - Issue Tracking
// =============================================================================

export interface BeadsListFilter {
  status?: 'open' | 'in_progress' | 'blocked' | 'closed'
  type?: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  assignee?: string
  labels?: string[]
  priority?: number
}

export interface BeadsCreateOptions {
  title: string
  type?: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  priority?: number
  description?: string
  labels?: string[]
}

export interface BeadsIssuesApi {
  list(filter?: BeadsListFilter): Promise<BeadsIssue[]>
  ready(): Promise<BeadsIssue[]>
  blocked(): Promise<BeadsIssue[]>
  create(options: BeadsCreateOptions): Promise<BeadsIssue>
  update(id: string, fields: Partial<BeadsIssue>): Promise<BeadsIssue>
  close(id: string, reason?: string): Promise<void>
  show(id: string): Promise<BeadsIssue>
}

export interface BeadsEpicsApi {
  progress(id: string): Promise<{ completed: number; total: number; percentage: number }>
}

export interface BeadsApi {
  issues: BeadsIssuesApi
  epics: BeadsEpicsApi
  /** Shorthand for issues.close */
  close(id: string, reason?: string): Promise<void>
  /** Shorthand for issues.update */
  update(id: string, fields: Partial<BeadsIssue>): Promise<BeadsIssue>
}

// =============================================================================
// Todo API - Context Rendering
// =============================================================================

export interface TodoApi {
  /** Render full TODO.md content */
  render(): Promise<string>
  /** Render ready issues as markdown */
  ready(limit?: number): Promise<string>
  /** Render blocked issues as markdown */
  blocked(): Promise<string>
  /** Render in-progress issues as markdown */
  inProgress(): Promise<string>
}

// =============================================================================
// Slack API - Notifications
// =============================================================================

export interface SlackApi {
  notify(channel: string, message: string): Promise<void>
  thread(channel: string, message: string, replies: string[]): Promise<void>
}

// =============================================================================
// Event Triggers
// =============================================================================

export interface OnIssueHandlers {
  ready(handler: (issue: BeadsIssue) => Promise<void>): void
  created(handler: (issue: BeadsIssue) => Promise<void>): void
  updated(handler: (issue: BeadsIssue, changes: Partial<BeadsIssue>) => Promise<void>): void
  closed(handler: (issue: BeadsIssue) => Promise<void>): void
  blocked(handler: (issue: BeadsIssue, blockedBy: string[]) => Promise<void>): void
  reopened(handler: (issue: BeadsIssue) => Promise<void>): void
}

export interface OnEpicHandlers {
  completed(handler: (epic: BeadsIssue) => Promise<void>): void
  progress(handler: (epic: BeadsIssue, progress: { completed: number; total: number }) => Promise<void>): void
}

export interface OnTriggers {
  issue: OnIssueHandlers
  epic: OnEpicHandlers
}

export interface EverySchedule {
  day(time: string, handler: () => Promise<void>): void
  hour(handler: () => Promise<void>): void
  minute(handler: () => Promise<void>): void
  week(day: string, time: string, handler: () => Promise<void>): void
}

// =============================================================================
// Workflow Context - All globals available in workflow code
// =============================================================================

export interface WorkflowContext {
  claude: ClaudeApi
  github: GitHubApi
  git: GitApi
  beads: BeadsApi
  todo: TodoApi
  slack: SlackApi
  on: OnTriggers
  every: EverySchedule
}

/**
 * Extend globalThis types for workflow code
 */
declare global {
  var claude: ClaudeApi
  var github: GitHubApi
  var git: GitApi
  var beads: BeadsApi
  var todo: TodoApi
  var slack: SlackApi
  var on: OnTriggers
  var every: EverySchedule
}
