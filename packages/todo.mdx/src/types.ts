/**
 * Core types for todo.mdx
 */

export interface TodoConfig {
  /** GitHub owner/org name */
  owner?: string
  /** GitHub repo name */
  repo?: string
  /** Sync with beads */
  beads?: boolean
  /** File naming pattern for .todo files */
  filePattern?: string
  /** Output format */
  format?: 'md' | 'mdx'
}

export interface Issue {
  id: string
  githubId?: number
  githubNumber?: number
  beadsId?: string
  title: string
  body?: string
  state: 'open' | 'in_progress' | 'closed' | 'blocked'
  labels?: string[]
  assignees?: string[]
  priority?: number
  type?: 'task' | 'bug' | 'feature' | 'epic' | 'chore'
  milestone?: string
  createdAt: string
  updatedAt: string
  /** IDs of issues that block this one */
  blockedBy?: string[]
  /** IDs of issues this one blocks */
  blocks?: string[]
  /** Parent epic ID */
  epicId?: string
}

export interface Milestone {
  id: string
  githubId?: number
  githubNumber?: number
  beadsId?: string
  title: string
  description?: string
  state: 'open' | 'closed'
  dueOn?: string
  progress?: {
    open: number
    closed: number
    percent: number
  }
  createdAt: string
  updatedAt: string
}

export interface ParsedTodoFile {
  frontmatter: Record<string, unknown>
  content: string
  issue: Partial<Issue>
}

export interface FilePattern {
  /** Variables in the pattern, e.g., ['id', 'title'] */
  variables: string[]
  /** Separator between variables */
  separator: string
  /** Regex to match and extract variables */
  regex: RegExp
  /** Format function to generate filename */
  format: (issue: Issue) => string
}

export type SyncSource = 'github' | 'beads' | 'file'

export interface SyncResult {
  source: SyncSource
  target: SyncSource
  action: 'created' | 'updated' | 'deleted' | 'skipped'
  issue?: Issue
  error?: string
}
