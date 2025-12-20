/**
 * Beads Integration
 *
 * Integration with beads issue tracker via bd CLI
 */

import { execa } from 'execa'
import type { Issue } from './types.js'

/**
 * Get all ready issues (no blockers)
 */
export async function getReadyIssues(options?: {
  priority?: number
  limit?: number
}): Promise<Issue[]> {
  const args = ['ready', '--json']

  if (options?.priority) {
    args.push('--priority', String(options.priority))
  }

  if (options?.limit) {
    args.push('--limit', String(options.limit))
  }

  try {
    const { stdout } = await execa('bd', args)
    return JSON.parse(stdout) as Issue[]
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new Error(`Failed to get ready issues: ${(error as any).stderr || error.message}`)
    }
    throw error
  }
}

/**
 * Get a specific issue by ID
 */
export async function getIssue(issueId: string): Promise<Issue> {
  try {
    const { stdout } = await execa('bd', ['show', issueId, '--json'])
    return JSON.parse(stdout) as Issue
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new Error(`Failed to get issue ${issueId}: ${(error as any).stderr || error.message}`)
    }
    throw error
  }
}

/**
 * List issues with filters
 */
export async function listIssues(options?: {
  status?: 'open' | 'in_progress' | 'blocked' | 'closed'
  type?: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  priority?: number
  limit?: number
}): Promise<Issue[]> {
  const args = ['list', '--json']

  if (options?.status) {
    args.push('--status', options.status)
  }

  if (options?.type) {
    args.push('--type', options.type)
  }

  if (options?.priority) {
    args.push('--priority', String(options.priority))
  }

  if (options?.limit) {
    args.push('--limit', String(options.limit))
  }

  try {
    const { stdout } = await execa('bd', args)
    return JSON.parse(stdout) as Issue[]
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new Error(`Failed to list issues: ${(error as any).stderr || error.message}`)
    }
    throw error
  }
}

/**
 * Update issue status
 */
export async function updateIssueStatus(
  issueId: string,
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
): Promise<void> {
  try {
    await execa('bd', ['update', issueId, '--status', status])
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new Error(`Failed to update issue ${issueId}: ${(error as any).stderr || error.message}`)
    }
    throw error
  }
}

/**
 * Close issue
 */
export async function closeIssue(issueId: string, reason?: string): Promise<void> {
  const args = ['close', issueId]

  if (reason) {
    args.push('--reason', reason)
  }

  try {
    await execa('bd', args)
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new Error(`Failed to close issue ${issueId}: ${(error as any).stderr || error.message}`)
    }
    throw error
  }
}

/**
 * Check if bd CLI is available
 */
export async function checkBeadsInstalled(): Promise<boolean> {
  try {
    await execa('bd', ['--version'])
    return true
  } catch {
    return false
  }
}

/**
 * Get statistics
 */
export async function getStats(): Promise<{
  total: number
  open: number
  in_progress: number
  closed: number
  blocked: number
  ready: number
}> {
  try {
    const { stdout } = await execa('bd', ['stats', '--json'])
    return JSON.parse(stdout)
  } catch (error) {
    if (error instanceof Error && 'stderr' in error) {
      throw new Error(`Failed to get stats: ${(error as any).stderr || error.message}`)
    }
    throw error
  }
}
