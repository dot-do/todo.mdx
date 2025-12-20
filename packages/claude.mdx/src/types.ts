/**
 * claude.mdx - Types for AI-Assisted Development Orchestrator
 *
 * Orchestrates Claude Code sessions to work on beads issues
 */

// ============================================================================
// Issue Types (from beads)
// ============================================================================

export interface Issue {
  id: string
  title: string
  description: string
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
  type: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  priority?: number
  assignee?: string
  created_at: string
  updated_at: string
  closed_at?: string
  design?: string
  acceptance_criteria?: string
  notes?: string
  dependencies?: Dependency[]
  dependents?: Dependency[]
}

export interface Dependency {
  id: string
  title: string
  description: string
  status: string
  dependency_type: 'blocks' | 'related' | 'parent-child' | 'discovered-from'
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  /** Session ID (same as issue ID) */
  id: string
  /** Issue being worked on */
  issue: Issue
  /** Process spawned for Claude Code */
  process: any
  /** When session started */
  startedAt: Date
  /** Session status */
  status: 'running' | 'completed' | 'failed' | 'stopped'
  /** Exit code (when completed) */
  exitCode?: number
}

export interface SessionContext {
  /** Issue details */
  issue: Issue
  /** Related context (dependencies, etc.) */
  dependencies?: Issue[]
  /** Project context */
  projectContext?: string
  /** Rendered TODO/ROADMAP context */
  todoContext?: string
}

// ============================================================================
// Orchestrator Configuration
// ============================================================================

export interface OrchestratorConfig {
  /** Maximum parallel sessions in daemon mode */
  maxParallelSessions?: number
  /** Daemon polling interval in ms */
  pollInterval?: number
  /** Directory to run claude code in */
  workingDirectory?: string
  /** Additional Claude Code flags */
  claudeFlags?: string[]
  /** Priority threshold (only work on issues with priority >= threshold) */
  priorityThreshold?: number
}

// ============================================================================
// Command Options
// ============================================================================

export interface WorkCommandOptions {
  /** Issue ID to work on */
  issueId?: string
  /** Interactive mode (pick from list) */
  interactive?: boolean
  /** Additional context to provide */
  context?: string
}

export interface NextCommandOptions {
  /** Priority threshold */
  priority?: number
  /** Type filter */
  type?: Issue['type']
  /** Auto-start session without confirmation */
  yes?: boolean
}

export interface DaemonCommandOptions {
  /** Maximum parallel sessions */
  maxParallel?: number
  /** Polling interval in seconds */
  interval?: number
  /** Run in background */
  background?: boolean
  /** Priority threshold */
  priority?: number
}

export interface StatusCommandOptions {
  /** Show detailed session info */
  detailed?: boolean
  /** Show session logs */
  logs?: boolean
}
