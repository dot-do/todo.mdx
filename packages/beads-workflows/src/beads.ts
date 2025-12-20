/**
 * Core functions for reading beads database
 */

import { readFile, access, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { BeadsIssue, Dependency, IssueWithReadyState } from './types.js'

const BEADS_DIR = '.beads'
const ISSUES_FILE = 'issues.jsonl'
const DEPS_FILE = 'dependencies.jsonl'

/**
 * Find the .beads directory by walking up from the given path
 */
export async function findBeadsDir(startPath: string): Promise<string | null> {
  let current = startPath

  while (current !== dirname(current)) {
    const beadsPath = join(current, BEADS_DIR)
    try {
      await access(beadsPath)
      return beadsPath
    } catch {
      current = dirname(current)
    }
  }

  return null
}

/**
 * Read issues from the beads JSONL file
 */
export async function readIssuesFromJsonl(beadsDir: string): Promise<BeadsIssue[]> {
  const issuesPath = join(beadsDir, ISSUES_FILE)

  try {
    const content = await readFile(issuesPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const issues: BeadsIssue[] = []

    for (const line of lines) {
      try {
        const issue = JSON.parse(line) as BeadsIssue
        issues.push(issue)
      } catch {
        // Skip malformed lines
      }
    }

    return issues
  } catch {
    return []
  }
}

/**
 * Read dependencies from the beads JSONL file
 */
export async function readDependenciesFromJsonl(beadsDir: string): Promise<Dependency[]> {
  const depsPath = join(beadsDir, DEPS_FILE)

  try {
    const content = await readFile(depsPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const deps: Dependency[] = []

    for (const line of lines) {
      try {
        const dep = JSON.parse(line) as Dependency
        deps.push(dep)
      } catch {
        // Skip malformed lines
      }
    }

    return deps
  } catch {
    return []
  }
}

/**
 * Get issues with computed ready state
 * An issue is ready if:
 * - It's open (not closed, not in_progress)
 * - All blocking dependencies are closed
 */
export async function getIssuesWithReadyState(beadsDir: string): Promise<IssueWithReadyState[]> {
  const [issues, deps] = await Promise.all([
    readIssuesFromJsonl(beadsDir),
    readDependenciesFromJsonl(beadsDir),
  ])

  // Build map of issue ID to issue for quick lookup
  const issueMap = new Map(issues.map(i => [i.id, i]))

  // Build map of issue ID to blocking dependencies
  const blockingDeps = new Map<string, string[]>()
  for (const dep of deps) {
    if (dep.dep_type === 'blocks') {
      const existing = blockingDeps.get(dep.issue_id) || []
      existing.push(dep.depends_on_id)
      blockingDeps.set(dep.issue_id, existing)
    }
  }

  return issues.map(issue => {
    const blockers = blockingDeps.get(issue.id) || []
    // Filter to only open blockers
    const openBlockers = blockers.filter(blockerId => {
      const blocker = issueMap.get(blockerId)
      return blocker && blocker.status !== 'closed'
    })

    const isReady = issue.status === 'open' && openBlockers.length === 0

    return {
      ...issue,
      isReady,
      blockedBy: openBlockers,
    }
  })
}

/**
 * Get only ready issues (open with no blockers)
 */
export async function getReadyIssues(beadsDir: string): Promise<IssueWithReadyState[]> {
  const issues = await getIssuesWithReadyState(beadsDir)
  return issues.filter(i => i.isReady)
}

/**
 * Get blocked issues with their blockers
 */
export async function getBlockedIssues(beadsDir: string): Promise<IssueWithReadyState[]> {
  const issues = await getIssuesWithReadyState(beadsDir)
  return issues.filter(i => i.blockedBy.length > 0 && i.status !== 'closed')
}

/**
 * Get epic progress (completed children / total children)
 */
export async function getEpicProgress(beadsDir: string, epicId: string): Promise<{
  completed: number
  total: number
  percentage: number
  children: BeadsIssue[]
}> {
  const [issues, deps] = await Promise.all([
    readIssuesFromJsonl(beadsDir),
    readDependenciesFromJsonl(beadsDir),
  ])

  const issueMap = new Map(issues.map(i => [i.id, i]))

  // Find child issues (issues that have parent-child dependency on this epic)
  const childIds = deps
    .filter(d => d.dep_type === 'parent-child' && d.depends_on_id === epicId)
    .map(d => d.issue_id)

  const children = childIds
    .map(id => issueMap.get(id))
    .filter((i): i is BeadsIssue => i !== undefined)

  const completed = children.filter(c => c.status === 'closed').length
  const total = children.length

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    children,
  }
}

/**
 * Check if an epic is completed (all children closed)
 */
export async function isEpicCompleted(beadsDir: string, epicId: string): Promise<boolean> {
  const progress = await getEpicProgress(beadsDir, epicId)
  return progress.total > 0 && progress.completed === progress.total
}
