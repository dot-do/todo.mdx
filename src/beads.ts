/**
 * Beads integration for todo.mdx
 * Loads issues from .beads/issues.jsonl and converts to TodoIssue format
 */

import { readIssuesFromJsonl, findBeadsDir, type Issue } from 'beads-workflows'
import type { TodoIssue } from './types'

/**
 * Convert beads-workflows Issue to TodoIssue
 * Maps Date objects to ISO strings and adjusts field names
 */
function convertIssueToTodoIssue(issue: Issue): TodoIssue {
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    type: issue.type,
    priority: issue.priority,
    assignee: issue.assignee,
    labels: issue.labels,
    createdAt: issue.created.toISOString(),
    updatedAt: issue.updated.toISOString(),
    closedAt: issue.closed?.toISOString(),
    dependsOn: issue.dependsOn.length > 0 ? issue.dependsOn : undefined,
    blocks: issue.blocks.length > 0 ? issue.blocks : undefined,
    parent: issue.parent,
    children: issue.children && issue.children.length > 0 ? issue.children : undefined,
    source: 'beads',
  }
}

/**
 * Load issues from .beads directory
 *
 * @param startPath - Starting path to search for .beads directory (defaults to cwd)
 * @returns Array of TodoIssue objects, or empty array if not found or on error
 *
 * @example
 * ```ts
 * const issues = await loadBeadsIssues()
 * console.log(`Found ${issues.length} issues`)
 * ```
 */
export async function loadBeadsIssues(startPath?: string): Promise<TodoIssue[]> {
  try {
    // Find .beads directory
    const beadsDir = await findBeadsDir(startPath || process.cwd())

    if (!beadsDir) {
      // No .beads directory found - this is not an error, just return empty array
      return []
    }

    // Read issues from JSONL
    const issues = await readIssuesFromJsonl(beadsDir)

    // Convert to TodoIssue format
    return issues.map(convertIssueToTodoIssue)
  } catch (error) {
    // Handle errors gracefully - log but don't throw
    if (error instanceof Error) {
      console.warn(`Failed to load beads issues: ${error.message}`)
    } else {
      console.warn('Failed to load beads issues: Unknown error')
    }
    return []
  }
}

/**
 * Check if beads is available in the current directory or any parent
 *
 * @param startPath - Starting path to search (defaults to cwd)
 * @returns true if .beads directory exists
 */
export async function hasBeadsDirectory(startPath?: string): Promise<boolean> {
  try {
    const beadsDir = await findBeadsDir(startPath || process.cwd())
    return beadsDir !== null
  } catch {
    return false
  }
}
