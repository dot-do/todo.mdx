/**
 * Core types for todo.mdx
 * Compatible with beads-workflows types for bi-directional sync
 */

// Re-export beads-workflows types for consistency
export type { Issue, IssueStatus, IssueType, Priority } from 'beads-workflows'

/**
 * Configuration for todo.mdx compilation and sync
 */
export interface TodoConfig {
  /** Enable beads integration (default: true) */
  beads?: boolean
  /** Path to .beads directory (auto-detected if not specified) */
  beadsDir?: string
  /** Directory for .todo/*.md files (default: '.todo') */
  todoDir?: string
  /** Template directory for issue templates (default: '.mdx') */
  templateDir?: string
  /** File pattern for .todo/*.md files (default: '{id}-{title}.md') */
  filePattern?: string
  /** Watch for changes and auto-sync */
  watch?: boolean
  /** Conflict resolution strategy */
  conflictStrategy?: 'beads-wins' | 'file-wins' | 'newest-wins'
}

/**
 * Parsed content from a .todo/*.md file
 */
export interface ParsedTodoFile {
  /** Frontmatter metadata */
  frontmatter: Record<string, unknown>
  /** Markdown body content */
  content: string
  /** Extracted issue data */
  issue: TodoIssue
}

/**
 * Issue representation in todo.mdx
 * Extends beads Issue with markdown-specific fields
 */
export interface TodoIssue {
  id: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'closed'
  type: 'task' | 'bug' | 'feature' | 'epic'
  priority: 0 | 1 | 2 | 3 | 4
  assignee?: string
  labels?: string[]
  createdAt?: string
  updatedAt?: string
  closedAt?: string
  dependsOn?: string[]
  blocks?: string[]
  parent?: string
  children?: string[]
  /** Source of this issue */
  source?: 'beads' | 'file'
}

/**
 * Template frontmatter configuration
 */
export interface TemplateFrontmatter {
  /** Template title */
  title?: string
  /** Enable beads integration */
  beads?: boolean
  /** Output file paths */
  outputs?: string[]
  /** File pattern for generated files */
  filePattern?: string
  /** Custom variables */
  [key: string]: unknown
}

/**
 * Result of compilation
 */
export interface CompileResult {
  /** Main compiled output (TODO.md content) */
  output: string
  /** List of generated files */
  files: string[]
  /** Issues used in compilation */
  issues: TodoIssue[]
}

/**
 * Result of sync operation
 */
export interface SyncResult {
  /** Issues created in beads */
  created: string[]
  /** Issues updated in beads */
  updated: string[]
  /** Issues deleted from beads */
  deleted: string[]
  /** Files generated/updated */
  filesWritten: string[]
  /** Conflicts detected */
  conflicts: SyncConflict[]
}

/**
 * Conflict during sync
 */
export interface SyncConflict {
  issueId: string
  field: string
  beadsValue: unknown
  fileValue: unknown
  resolution: 'beads-wins' | 'file-wins' | 'manual'
}

/**
 * Watcher event
 */
export interface WatchEvent {
  type: 'file-change' | 'beads-change'
  path?: string
  issueId?: string
}
