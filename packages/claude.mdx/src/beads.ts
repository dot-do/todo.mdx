/**
 * Beads Integration
 *
 * Integration with beads issue tracker via bd CLI
 */

import { execa } from 'execa'
import type { Issue } from './types.js'
import { ProcessError } from '@todo.mdx/core'

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
    if (error && typeof error === 'object' && 'stderr' in error) {
      throw new ProcessError('Failed to get ready issues', {
        cause: error,
        command: 'bd ready --format=json',
        stderr: (error as any).stderr,
        stdout: (error as any).stdout,
      })
    }
    throw new ProcessError('Failed to get ready issues', {
      cause: error,
      command: 'bd ready --format=json',
    })
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
    if (error && typeof error === 'object' && 'stderr' in error) {
      throw new ProcessError(`Failed to get issue ${issueId}`, {
        cause: error,
        command: `bd show ${issueId} --format=json`,
        stderr: (error as any).stderr,
        stdout: (error as any).stdout,
      })
    }
    throw new ProcessError(`Failed to get issue ${issueId}`, {
      cause: error,
      command: `bd show ${issueId} --format=json`,
    })
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
    if (error && typeof error === 'object' && 'stderr' in error) {
      throw new ProcessError('Failed to list issues', {
        cause: error,
        command: `bd list ${args}`,
        stderr: (error as any).stderr,
        stdout: (error as any).stdout,
      })
    }
    throw new ProcessError('Failed to list issues', {
      cause: error,
      command: `bd list ${args}`,
    })
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
    if (error && typeof error === 'object' && 'stderr' in error) {
      throw new ProcessError(`Failed to update issue ${issueId}`, {
        cause: error,
        command: `bd update ${issueId} --status ${status}`,
        stderr: (error as any).stderr,
        stdout: (error as any).stdout,
        context: { status },
      })
    }
    throw new ProcessError(`Failed to update issue ${issueId}`, {
      cause: error,
      command: `bd update ${issueId} --status ${status}`,
      context: { status },
    })
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
    if (error && typeof error === 'object' && 'stderr' in error) {
      throw new ProcessError(`Failed to close issue ${issueId}`, {
        cause: error,
        command: `bd close ${issueId} ${args}`,
        stderr: (error as any).stderr,
        stdout: (error as any).stdout,
        context: { reason },
      })
    }
    throw new ProcessError(`Failed to close issue ${issueId}`, {
      cause: error,
      command: `bd close ${issueId} ${args}`,
      context: { reason },
    })
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
    if (error && typeof error === 'object' && 'stderr' in error) {
      throw new ProcessError('Failed to get stats', {
        cause: error,
        command: 'bd stats --format=json',
        stderr: (error as any).stderr,
        stdout: (error as any).stdout,
      })
    }
    throw new ProcessError('Failed to get stats', {
      cause: error,
      command: 'bd stats --format=json',
    })
  }
}
