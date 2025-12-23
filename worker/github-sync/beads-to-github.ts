/**
 * Beads → GitHub issue converter
 *
 * Converts beads issues to GitHub issue format, injecting convention patterns
 * into the body for dependencies, blocks, and parent relationships.
 */

import type { GitHubIssuePayload } from './github-client'
import type { GitHubConventions } from './conventions'

export interface BeadsIssue {
  id?: string
  title: string
  description: string
  type: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
  priority: 0 | 1 | 2 | 3 | 4
  assignee?: string
  labels: string[]
  dependsOn: string[]
  blocks: string[]
  parent?: string
  externalRef: string
  createdAt: string
  updatedAt: string
  closedAt?: string
}

export interface ConvertToGitHubOptions {
  conventions: GitHubConventions
  // Map beads issue IDs to GitHub issue numbers for dependency refs
  issueNumberMap?: Map<string, number>
}

/**
 * Find the GitHub label for a given beads type by reverse lookup
 */
function findLabelForType(
  type: BeadsIssue['type'],
  conventions: GitHubConventions
): string | undefined {
  for (const [label, beadsType] of Object.entries(conventions.labels.type)) {
    if (beadsType === type) {
      return label
    }
  }
  return undefined
}

/**
 * Find the GitHub label for a given beads priority by reverse lookup
 */
function findLabelForPriority(
  priority: BeadsIssue['priority'],
  conventions: GitHubConventions
): string | undefined {
  for (const [label, beadsPriority] of Object.entries(conventions.labels.priority)) {
    if (beadsPriority === priority) {
      return label
    }
  }
  return undefined
}

/**
 * Convert a beads issue ID to a GitHub reference (either #number or plain ID)
 */
function formatIssueRef(
  issueId: string,
  issueNumberMap?: Map<string, number>
): string {
  const number = issueNumberMap?.get(issueId)
  return number !== undefined ? `#${number}` : issueId
}

/**
 * Format an array of issue IDs as a comma-separated list with GitHub refs
 */
function formatIssueRefs(
  issueIds: string[],
  separator: string,
  issueNumberMap?: Map<string, number>
): string {
  return issueIds.map(id => formatIssueRef(id, issueNumberMap)).join(separator)
}

/**
 * Build the metadata section for dependencies, blocks, and parent
 */
function buildMetadataSection(
  issue: BeadsIssue,
  conventions: GitHubConventions,
  issueNumberMap?: Map<string, number>
): string | null {
  const hasDependencies = issue.dependsOn.length > 0
  const hasBlocks = issue.blocks.length > 0
  const hasParent = issue.parent !== undefined

  if (!hasDependencies && !hasBlocks && !hasParent) {
    return null
  }

  const lines: string[] = []
  lines.push('---')
  lines.push('<!-- beads-sync metadata - do not edit below -->')

  if (hasDependencies) {
    const refs = formatIssueRefs(
      issue.dependsOn,
      conventions.dependencies.separator,
      issueNumberMap
    )
    lines.push(`Depends on: ${refs}`)
  }

  if (hasBlocks) {
    const refs = formatIssueRefs(
      issue.blocks,
      conventions.dependencies.separator,
      issueNumberMap
    )
    lines.push(`Blocks: ${refs}`)
  }

  if (hasParent && issue.parent) {
    const ref = formatIssueRef(issue.parent, issueNumberMap)
    lines.push(`Parent: ${ref}`)
  }

  return lines.join('\n')
}

/**
 * Convert a beads issue to GitHub issue payload
 */
export function convertBeadsToGitHub(
  issue: BeadsIssue,
  options: ConvertToGitHubOptions
): GitHubIssuePayload {
  const { conventions, issueNumberMap } = options
  const labels: string[] = []

  // Map type to label (reverse lookup)
  const typeLabel = findLabelForType(issue.type, conventions)
  if (typeLabel) {
    labels.push(typeLabel)
  }

  // Map priority to label (reverse lookup)
  const priorityLabel = findLabelForPriority(issue.priority, conventions)
  if (priorityLabel) {
    labels.push(priorityLabel)
  }

  // Add in-progress label if applicable
  if (issue.status === 'in_progress' && conventions.labels.status.inProgress) {
    labels.push(conventions.labels.status.inProgress)
  }

  // Add custom labels from beads issue
  labels.push(...issue.labels)

  // Deduplicate labels
  const uniqueLabels = Array.from(new Set(labels))

  // Map status to state
  const state: 'open' | 'closed' = issue.status === 'closed' ? 'closed' : 'open'

  // Build body with metadata section
  const metadata = buildMetadataSection(issue, conventions, issueNumberMap)
  const body = metadata ? `${issue.description}\n\n${metadata}` : issue.description

  // Convert assignee to assignees array
  const assignees = issue.assignee ? [issue.assignee] : []

  return {
    title: issue.title,
    body,
    labels: uniqueLabels,
    assignees,
    state,
  }
}
