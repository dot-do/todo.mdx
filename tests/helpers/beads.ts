import { execa } from 'execa'
import type { Worktree } from './worktree'
import fs from 'fs/promises'
import path from 'path'

/**
 * Check if the `bd` CLI is available
 */
export async function hasBdCli(): Promise<boolean> {
  try {
    await execa('bd', ['--version'])
    return true
  } catch {
    return false
  }
}

export interface BeadsIssue {
  id: string
  title: string
  status: string
  priority: number
  issue_type: string
  description?: string
  assignee?: string
  labels?: string[]
}

export async function bd(
  worktree: Worktree,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return execa('bd', args, { cwd: worktree.path })
}

export async function init(worktree: Worktree, prefix?: string): Promise<void> {
  const args = ['init']
  if (prefix) {
    args.push('--prefix', prefix)
  }
  await bd(worktree, args)
}

export async function create(
  worktree: Worktree,
  options: {
    title: string
    type?: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
    priority?: number
    description?: string
  }
): Promise<string> {
  const args = ['create', '--title', options.title]

  if (options.type) {
    args.push('--type', options.type)
  }
  if (options.priority !== undefined) {
    args.push('--priority', String(options.priority))
  }
  if (options.description) {
    args.push('--description', options.description)
  }

  const { stdout } = await bd(worktree, args)
  // Parse issue ID from output (e.g., "Created issue: test-abc123")
  const match = stdout.match(/Created.*?:\s*(\S+)/i)
  return match?.[1] || ''
}

export async function update(
  worktree: Worktree,
  issueId: string,
  options: {
    status?: 'open' | 'in_progress' | 'blocked' | 'closed'
    priority?: number
    assignee?: string
  }
): Promise<void> {
  const args = ['update', issueId]

  if (options.status) {
    args.push('--status', options.status)
  }
  if (options.priority !== undefined) {
    args.push('--priority', String(options.priority))
  }
  if (options.assignee) {
    args.push('--assignee', options.assignee)
  }

  await bd(worktree, args)
}

export async function close(worktree: Worktree, issueId: string, reason?: string): Promise<void> {
  const args = ['close', issueId]
  if (reason) {
    args.push('--reason', reason)
  }
  await bd(worktree, args)
}

export async function list(
  worktree: Worktree,
  options?: {
    status?: string
    type?: string
    limit?: number
  }
): Promise<string> {
  const args = ['list']

  if (options?.status) {
    args.push('--status', options.status)
  }
  if (options?.type) {
    args.push('--type', options.type)
  }
  if (options?.limit) {
    args.push('--limit', String(options.limit))
  }

  const { stdout } = await bd(worktree, args)
  return stdout
}

export async function ready(worktree: Worktree, limit?: number): Promise<string> {
  const args = ['ready']
  if (limit) {
    args.push('--limit', String(limit))
  }
  const { stdout } = await bd(worktree, args)
  return stdout
}

export async function show(worktree: Worktree, issueId: string): Promise<string> {
  const { stdout } = await bd(worktree, ['show', issueId])
  return stdout
}

export async function dep(
  worktree: Worktree,
  issueId: string,
  dependsOnId: string,
  type: 'blocks' | 'related' | 'parent-child' = 'blocks'
): Promise<void> {
  await bd(worktree, ['dep', 'add', issueId, dependsOnId, '--type', type])
}

export async function sync(worktree: Worktree): Promise<{ stdout: string; stderr: string }> {
  return bd(worktree, ['sync'])
}

export async function hasBeadsDir(worktree: Worktree): Promise<boolean> {
  try {
    await fs.access(path.join(worktree.path, '.beads'))
    return true
  } catch {
    return false
  }
}

export async function blocked(worktree: Worktree): Promise<string> {
  const { stdout } = await bd(worktree, ['blocked'])
  return stdout
}
