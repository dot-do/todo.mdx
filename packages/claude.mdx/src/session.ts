/**
 * Session Management
 *
 * Spawns and manages Claude Code sessions for working on issues
 */

import { execa } from 'execa'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Issue, Session, SessionContext } from './types.js'

/** Active sessions (in-memory, keyed by issue ID) */
const activeSessions = new Map<string, Session>()

/**
 * Render context for an issue
 */
export async function renderContext(issue: Issue, cwd: string = process.cwd()): Promise<string> {
  const lines: string[] = []

  lines.push(`# Task: ${issue.title} (${issue.id})`)
  lines.push('')

  if (issue.description) {
    lines.push('## Description')
    lines.push(issue.description)
    lines.push('')
  }

  if (issue.design) {
    lines.push('## Design')
    lines.push(issue.design)
    lines.push('')
  }

  if (issue.acceptance_criteria) {
    lines.push('## Acceptance Criteria')
    lines.push(issue.acceptance_criteria)
    lines.push('')
  }

  if (issue.dependencies && issue.dependencies.length > 0) {
    lines.push('## Dependencies')
    for (const dep of issue.dependencies) {
      lines.push(`- **${dep.id}** (${dep.status}): ${dep.title}`)
      if (dep.description) {
        lines.push(`  ${dep.description}`)
      }
    }
    lines.push('')
  }

  // Try to include project context from CLAUDE.md if it exists
  try {
    const claudeMd = await readFile(join(cwd, 'CLAUDE.md'), 'utf-8')
    lines.push('## Project Context')
    lines.push('')
    lines.push(claudeMd)
    lines.push('')
  } catch {
    // CLAUDE.md not found, skip
  }

  lines.push('---')
  lines.push('')
  lines.push('Please work on this task. When complete, update the issue status.')

  return lines.join('\n')
}

/**
 * Spawn a Claude Code session for an issue
 */
export async function spawnSession(
  issue: Issue,
  options: {
    cwd?: string
    flags?: string[]
    interactive?: boolean
  } = {}
): Promise<Session> {
  const cwd = options.cwd || process.cwd()

  // Check if session already running for this issue
  if (activeSessions.has(issue.id)) {
    throw new Error(`Session already running for issue ${issue.id}`)
  }

  // Render context
  const context = await renderContext(issue, cwd)

  // Build claude command
  const args = ['--task', context]

  // Add any additional flags
  if (options.flags && options.flags.length > 0) {
    args.push(...options.flags)
  }

  // Spawn process
  const proc = execa('claude', args, {
    cwd,
    stdio: options.interactive ? 'inherit' : 'pipe',
    reject: false,
  })

  // Create session
  const session: Session = {
    id: issue.id,
    issue,
    process: proc,
    startedAt: new Date(),
    status: 'running',
  }

  // Store session
  activeSessions.set(issue.id, session)

  // Handle completion
  proc.then((result) => {
    session.status = result.exitCode === 0 ? 'completed' : 'failed'
    session.exitCode = result.exitCode || undefined

    // Keep session in map for status queries
    // In production, you'd want to clean these up after some time
  })

  return session
}

/**
 * Get active session by issue ID
 */
export function getSession(issueId: string): Session | undefined {
  return activeSessions.get(issueId)
}

/**
 * Get all active sessions
 */
export function getAllSessions(): Session[] {
  return Array.from(activeSessions.values())
}

/**
 * Get running sessions only
 */
export function getRunningSessions(): Session[] {
  return Array.from(activeSessions.values()).filter((s) => s.status === 'running')
}

/**
 * Stop a session
 */
export async function stopSession(issueId: string): Promise<void> {
  const session = activeSessions.get(issueId)
  if (!session) {
    throw new Error(`No active session for issue ${issueId}`)
  }

  if (session.status !== 'running') {
    throw new Error(`Session ${issueId} is not running (status: ${session.status})`)
  }

  // Kill process
  session.process.kill('SIGTERM')
  session.status = 'stopped'
}

/**
 * Wait for a session to complete
 */
export async function waitForSession(issueId: string): Promise<Session> {
  const session = activeSessions.get(issueId)
  if (!session) {
    throw new Error(`No session found for issue ${issueId}`)
  }

  await session.process
  return session
}

/**
 * Clear completed sessions from memory
 */
export function clearCompletedSessions(): void {
  for (const [id, session] of activeSessions.entries()) {
    if (session.status !== 'running') {
      activeSessions.delete(id)
    }
  }
}

/**
 * Check if Claude CLI is available
 */
export async function checkClaudeInstalled(): Promise<boolean> {
  try {
    await execa('claude', ['--version'])
    return true
  } catch {
    return false
  }
}
