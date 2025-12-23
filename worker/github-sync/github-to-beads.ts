/**
 * GitHub to Beads issue converter
 *
 * Converts GitHub issue payloads to beads TodoIssue format using conventions.
 */

import type { GitHubIssue } from './github-client'
import type { GitHubConventions } from './conventions'
import type { BeadsIssue } from './beads-to-github'
import { parseIssueBody } from './parser'
import { mapLabels } from './label-mapper'

export interface ConvertOptions {
  conventions: GitHubConventions
  owner: string
  repo: string
}

/**
 * Strip convention patterns from issue body to get clean description
 */
function stripConventionPatterns(
  body: string | null,
  conventions: GitHubConventions
): string {
  if (!body) {
    return ''
  }

  let description = body

  // Remove dependency section
  if (conventions.dependencies.pattern) {
    const depRegex = new RegExp(
      `${conventions.dependencies.pattern}[\\s\\S]*?(?=\\n\\n|\\n#|$)`,
      'gmi'
    )
    description = description.replace(depRegex, '')
  }

  // Remove blocks section
  if (conventions.dependencies.blocksPattern) {
    const blocksRegex = new RegExp(
      `${conventions.dependencies.blocksPattern}[\\s\\S]*?(?=\\n\\n|\\n#|$)`,
      'gmi'
    )
    description = description.replace(blocksRegex, '')
  }

  // Remove parent section
  if (conventions.epics.bodyPattern) {
    const parentRegex = new RegExp(
      `${conventions.epics.bodyPattern}.*$`,
      'gmi'
    )
    description = description.replace(parentRegex, '')
  }

  // Clean up extra whitespace and trim
  description = description
    .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
    .trim()

  return description
}

/**
 * Convert a GitHub issue to a Beads issue
 */
export function convertGitHubToBeads(
  ghIssue: GitHubIssue,
  options: ConvertOptions
): BeadsIssue {
  const { conventions, owner, repo } = options

  // Extract label names
  const labelNames = ghIssue.labels.map(label => label.name)

  // Map labels to type, priority, status
  const mapped = mapLabels(labelNames, ghIssue.state, conventions)

  // Parse body for dependencies, blocks, parent
  const parsed = parseIssueBody(ghIssue.body, conventions)

  // Strip convention patterns from description
  const description = stripConventionPatterns(ghIssue.body, conventions)

  // Build external ref
  const externalRef = `github.com/${owner}/${repo}/issues/${ghIssue.number}`

  // Build the beads issue
  const beadsIssue: BeadsIssue = {
    title: ghIssue.title,
    description,
    type: mapped.type,
    status: mapped.status,
    priority: mapped.priority,
    assignee: ghIssue.assignee?.login,
    labels: mapped.remainingLabels,
    dependsOn: parsed.dependsOn,
    blocks: parsed.blocks,
    parent: parsed.parent,
    externalRef,
    createdAt: ghIssue.created_at,
    updatedAt: ghIssue.updated_at,
    closedAt: ghIssue.closed_at ?? undefined,
  }

  return beadsIssue
}
