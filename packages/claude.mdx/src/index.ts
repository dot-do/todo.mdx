/**
 * claude.mdx - AI-Assisted Development Orchestrator
 *
 * Orchestrates Claude Code sessions to work on beads issues
 *
 * @example CLI usage:
 * ```bash
 * claude.mdx work todo-123
 * claude.mdx next
 * claude.mdx daemon
 * claude.mdx status
 * ```
 *
 * @example Programmatic usage:
 * ```typescript
 * import { spawnSession, getReadyIssues } from 'claude.mdx'
 *
 * const issues = await getReadyIssues({ limit: 5 })
 * const session = await spawnSession(issues[0])
 * ```
 */

// Types
export type {
  Issue,
  Dependency,
  Session,
  SessionContext,
  OrchestratorConfig,
  WorkCommandOptions,
  NextCommandOptions,
  DaemonCommandOptions,
  StatusCommandOptions,
} from './types.js'

// Beads integration
export {
  getReadyIssues,
  getIssue,
  listIssues,
  updateIssueStatus,
  closeIssue,
  checkBeadsInstalled,
  getStats,
} from './beads.js'

// Session management
export {
  spawnSession,
  getSession,
  getAllSessions,
  getRunningSessions,
  stopSession,
  waitForSession,
  clearCompletedSessions,
  checkClaudeInstalled,
  renderContext,
} from './session.js'

// Commands (for programmatic use)
export { workCommand } from './commands/work.js'
export { nextCommand } from './commands/next.js'
export { daemonCommand } from './commands/daemon.js'
export { statusCommand } from './commands/status.js'
