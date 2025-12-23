/**
 * Compiler for todo.mdx
 * Loads issues from beads and .todo/*.md files, merges them, and generates TODO.md
 */

import { loadBeadsIssues } from './beads.js'
import { loadTodoFiles } from './parser.js'
import type { TodoIssue, TodoConfig, CompileResult } from './types.js'

export interface CompileOptions extends TodoConfig {
  /** Include completed issues in output (default: true) */
  includeCompleted?: boolean
  /** Maximum number of completed issues to show (default: 10) */
  completedLimit?: number
}

/**
 * Merge issues from beads and files, handling duplicates based on conflict strategy
 */
function mergeIssues(
  beadsIssues: TodoIssue[],
  fileIssues: TodoIssue[],
  strategy: 'beads-wins' | 'file-wins' | 'newest-wins' = 'beads-wins'
): TodoIssue[] {
  const issueMap = new Map<string, TodoIssue>()

  // Add all file issues first
  for (const issue of fileIssues) {
    issueMap.set(issue.id, issue)
  }

  // Add or merge beads issues
  for (const beadsIssue of beadsIssues) {
    const existing = issueMap.get(beadsIssue.id)

    if (!existing) {
      issueMap.set(beadsIssue.id, beadsIssue)
      continue
    }

    // Handle conflict based on strategy
    if (strategy === 'beads-wins') {
      issueMap.set(beadsIssue.id, beadsIssue)
    } else if (strategy === 'file-wins') {
      // Keep existing file version
      continue
    } else if (strategy === 'newest-wins') {
      const beadsTime = beadsIssue.updatedAt ? new Date(beadsIssue.updatedAt).getTime() : 0
      const fileTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0

      if (beadsTime >= fileTime) {
        issueMap.set(beadsIssue.id, beadsIssue)
      }
    }
  }

  return Array.from(issueMap.values())
}

/**
 * Group issues by type
 */
function groupByType(issues: TodoIssue[]): Map<string, TodoIssue[]> {
  const groups = new Map<string, TodoIssue[]>()

  for (const issue of issues) {
    const type = issue.type
    if (!groups.has(type)) {
      groups.set(type, [])
    }
    groups.get(type)!.push(issue)
  }

  return groups
}

/**
 * Sort issues by priority (lower number = higher priority)
 */
function sortByPriority(issues: TodoIssue[]): TodoIssue[] {
  return [...issues].sort((a, b) => a.priority - b.priority)
}

/**
 * Sort issues by closedAt date (most recent first)
 */
function sortByClosedDate(issues: TodoIssue[]): TodoIssue[] {
  return [...issues].sort((a, b) => {
    const aTime = a.closedAt ? new Date(a.closedAt).getTime() : 0
    const bTime = b.closedAt ? new Date(b.closedAt).getTime() : 0
    return bTime - aTime // descending (newest first)
  })
}

/**
 * Format an issue as a markdown list item
 */
function formatIssueItem(issue: TodoIssue, checked: boolean = false): string {
  const checkbox = checked ? '[x]' : '[ ]'
  const metadata: string[] = [issue.type, `P${issue.priority}`]

  if (issue.assignee) {
    metadata.push(`@${issue.assignee}`)
  }

  const metaString = metadata.join(', ')

  // Add labels separately with space separator
  let labelString = ''
  if (issue.labels && issue.labels.length > 0) {
    labelString = ' ' + issue.labels.map(l => `#${l}`).join(' ')
  }

  // For completed issues, show closed date if available
  if (checked && issue.closedAt) {
    const closedDate = new Date(issue.closedAt).toISOString().split('T')[0]
    return `- ${checkbox} [#${issue.id}] ${issue.title} - *closed ${closedDate}*`
  }

  return `- ${checkbox} [#${issue.id}] ${issue.title} - *${metaString}${labelString}*`
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Get plural form of type name
 */
function pluralizeType(type: string): string {
  const plurals: Record<string, string> = {
    bug: 'Bugs',
    feature: 'Features',
    task: 'Tasks',
    epic: 'Epics',
  }
  return plurals[type] || capitalize(type) + 's'
}

/**
 * Compile issues to a TODO.md markdown string
 */
export function compileToString(issues: TodoIssue[], options?: CompileOptions): string {
  const lines: string[] = []
  const includeCompleted = options?.includeCompleted !== false
  const completedLimit = options?.completedLimit || 10

  // Title
  lines.push('# TODO')
  lines.push('')

  // Filter issues by status
  const inProgress = issues.filter(i => i.status === 'in_progress')
  const open = issues.filter(i => i.status === 'open')
  const closed = issues.filter(i => i.status === 'closed')

  // In Progress section
  if (inProgress.length > 0) {
    lines.push('## In Progress')
    lines.push('')

    const sorted = sortByPriority(inProgress)
    for (const issue of sorted) {
      lines.push(formatIssueItem(issue))
    }
    lines.push('')
  }

  // Open section (grouped by type)
  if (open.length > 0) {
    lines.push('## Open')
    lines.push('')

    const typeGroups = groupByType(open)

    // Sort type groups for consistent output (epics, bugs, features, tasks)
    const typeOrder = ['epic', 'bug', 'feature', 'task']
    const sortedTypes = Array.from(typeGroups.keys()).sort((a, b) => {
      const aIndex = typeOrder.indexOf(a)
      const bIndex = typeOrder.indexOf(b)
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })

    for (const type of sortedTypes) {
      const typeIssues = typeGroups.get(type)!
      lines.push(`### ${pluralizeType(type)}`)
      lines.push('')

      const sorted = sortByPriority(typeIssues)
      for (const issue of sorted) {
        lines.push(formatIssueItem(issue))
      }
      lines.push('')
    }
  }

  // Recently Completed section
  if (includeCompleted && closed.length > 0) {
    lines.push('## Recently Completed')
    lines.push('')

    const sorted = sortByClosedDate(closed)
    const limited = sorted.slice(0, completedLimit)

    for (const issue of limited) {
      lines.push(formatIssueItem(issue, true))
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

/**
 * Compile TODO.md from beads and .todo/*.md files
 */
export async function compile(options?: CompileOptions): Promise<CompileResult> {
  const beadsEnabled = options?.beads !== false
  const todoDir = options?.todoDir || '.todo'
  const conflictStrategy = options?.conflictStrategy || 'beads-wins'

  // Load issues from sources
  const beadsIssues = beadsEnabled ? await loadBeadsIssues() : []
  const fileIssues = await loadTodoFiles(todoDir)

  // Merge issues
  const mergedIssues = mergeIssues(beadsIssues, fileIssues, conflictStrategy)

  // Compile to string
  const output = compileToString(mergedIssues, options)

  return {
    output,
    files: [], // For future: could write output files here
    issues: mergedIssues,
  }
}
