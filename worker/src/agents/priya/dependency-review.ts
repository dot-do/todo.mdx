/**
 * Priya Dependency Review
 *
 * Layer 2 of dependency integrity:
 * - On issue.created, analyze description + codebase
 * - Suggest missing dependencies
 * - Auto-add or flag for human review based on settings
 */

import type { Issue } from 'beads-workflows'
import type { WorkflowRuntime } from '@todo.mdx/agents.mdx'

/**
 * Dependency suggestion from analysis
 */
export interface DependencySuggestion {
  dependsOnId: string
  type: 'blocks' | 'related' | 'parent-child'
  reason: string
  confidence: number
}

/**
 * Configuration for dependency review
 */
export interface DependencyReviewConfig {
  mode: 'auto-add' | 'suggest-only'
  minConfidence?: number
}

/**
 * Result from onIssueCreated
 */
export interface IssueCreatedResult {
  suggestions: DependencySuggestion[]
  added: string[]
}

/**
 * Extract issue IDs from text
 *
 * Patterns:
 * - #issue-123
 * - #test-abc
 * - depends on issue-123
 * - issue-123 must be done first
 */
function extractIssueReferences(text: string): string[] {
  if (!text) return []

  const refs = new Set<string>()

  // Pattern 1: #issue-id format
  const hashPattern = /#([a-z]+-[a-z0-9]+)/gi
  let match: RegExpExecArray | null

  while ((match = hashPattern.exec(text)) !== null) {
    refs.add(match[1])
  }

  // Pattern 2: bare issue-id format (with context words)
  const barePattern = /(?:depends on|blocked by|requires|needs)\s+([a-z]+-[a-z0-9]+)/gi

  while ((match = barePattern.exec(text)) !== null) {
    refs.add(match[1])
  }

  return Array.from(refs)
}

/**
 * Extract file paths from text
 *
 * Patterns:
 * - src/auth/login.ts
 * - packages/foo/bar.ts
 * - worker/src/index.ts
 */
function extractFilePaths(text: string): string[] {
  if (!text) return []

  const paths = new Set<string>()

  // Pattern: file paths (simple heuristic)
  const pathPattern = /(?:^|\s)([a-z0-9_-]+\/[a-z0-9_/-]+\.[a-z]+)/gi
  let match: RegExpExecArray | null

  while ((match = pathPattern.exec(text)) !== null) {
    paths.add(match[1])
  }

  return Array.from(paths)
}

/**
 * Check if adding a dependency would create a circular dependency
 */
async function wouldCreateCircularDependency(
  runtime: WorkflowRuntime,
  issueId: string,
  dependsOnId: string
): Promise<boolean> {
  try {
    const dependsOnIssue = await runtime.issues.show(dependsOnId)

    // Direct circular: B depends on A, and we're trying to make A depend on B
    if (dependsOnIssue.dependsOn.includes(issueId)) {
      return true
    }

    // Transitive circular: check if dependsOnId is already blocked by issueId
    const blockedBy = await runtime.dag.blockedBy(dependsOnId)
    return blockedBy.some((i) => i.id === issueId)
  } catch (error) {
    // If issue doesn't exist, can't create circular dependency
    return false
  }
}

/**
 * Review dependencies for an issue
 *
 * Analyzes:
 * 1. Description for issue references (#issue-id, "depends on issue-id")
 * 2. File paths mentioned in description vs other open issues
 *
 * Returns suggestions with confidence scores
 */
export async function reviewDependencies(
  runtime: WorkflowRuntime,
  issue: Issue
): Promise<DependencySuggestion[]> {
  const suggestions: DependencySuggestion[] = []
  const description = issue.description || ''

  // Get all open issues
  const openIssues = await runtime.issues.list({ status: 'open' })

  // 1. Extract direct issue references
  const referencedIds = extractIssueReferences(description)

  for (const refId of referencedIds) {
    // Skip self-references
    if (refId === issue.id) continue

    // Check if referenced issue exists and is open
    const referencedIssue = openIssues.find((i) => i.id === refId)
    if (!referencedIssue) continue

    // Skip if already depends on this issue
    if (issue.dependsOn.includes(refId)) continue

    // Check for circular dependency
    if (await wouldCreateCircularDependency(runtime, issue.id, refId)) {
      continue
    }

    suggestions.push({
      dependsOnId: refId,
      type: 'blocks',
      reason: `Referenced in description as #${refId} - mentioned in description`,
      confidence: 0.9,
    })
  }

  // 2. Extract file paths and find related issues
  const filePaths = extractFilePaths(description)

  if (filePaths.length > 0) {
    for (const otherIssue of openIssues) {
      // Skip self
      if (otherIssue.id === issue.id) continue

      // Skip if already depends on this issue
      if (issue.dependsOn.includes(otherIssue.id)) continue

      // Skip if already suggested
      if (suggestions.some((s) => s.dependsOnId === otherIssue.id)) continue

      const otherDescription = otherIssue.description || ''
      const otherPaths = extractFilePaths(otherDescription)

      // Check for shared file paths
      const sharedPaths = filePaths.filter((p) => otherPaths.includes(p))

      if (sharedPaths.length > 0) {
        // Check for circular dependency
        if (await wouldCreateCircularDependency(runtime, issue.id, otherIssue.id)) {
          continue
        }

        // Higher priority issues or bugs are more likely to be blockers
        const isPriorityBlocker = otherIssue.priority < issue.priority || otherIssue.type === 'bug'

        suggestions.push({
          dependsOnId: otherIssue.id,
          type: isPriorityBlocker ? 'blocks' : 'related',
          reason: `Shares file path: ${sharedPaths.join(', ')} - shared file path`,
          confidence: isPriorityBlocker ? 0.7 : 0.5,
        })
      }
    }
  }

  return suggestions
}

/**
 * Handle issue.created event
 *
 * Based on configuration:
 * - auto-add: Automatically add suggested dependencies
 * - suggest-only: Return suggestions for human review
 */
export async function onIssueCreated(
  runtime: WorkflowRuntime,
  issue: Issue,
  config: DependencyReviewConfig = { mode: 'suggest-only' }
): Promise<IssueCreatedResult> {
  console.log(`[Priya] Reviewing dependencies for new issue ${issue.id}: "${issue.title}"`)

  const suggestions = await reviewDependencies(runtime, issue)
  const added: string[] = []

  if (suggestions.length === 0) {
    console.log(`[Priya] No dependency suggestions for issue ${issue.id}`)
    return { suggestions: [], added: [] }
  }

  console.log(
    `[Priya] Found ${suggestions.length} dependency suggestion(s) for issue ${issue.id}`
  )

  if (config.mode === 'auto-add') {
    // Filter by minimum confidence if specified
    const minConfidence = config.minConfidence ?? 0.6
    const toAdd = suggestions.filter((s) => s.confidence >= minConfidence)

    for (const suggestion of toAdd) {
      console.log(
        `[Priya] Auto-adding dependency: ${issue.id} depends on ${suggestion.dependsOnId} (${suggestion.reason})`
      )

      try {
        // Get current issue state
        const currentIssue = await runtime.issues.show(issue.id)

        // Add to dependsOn array
        const updatedDependsOn = [...currentIssue.dependsOn, suggestion.dependsOnId]

        // Update issue
        await runtime.issues.update(issue.id, {
          ...currentIssue,
          dependsOn: updatedDependsOn,
        })

        added.push(suggestion.dependsOnId)
      } catch (error) {
        console.error(
          `[Priya] Failed to add dependency ${suggestion.dependsOnId}:`,
          error
        )
      }
    }

    console.log(`[Priya] Added ${added.length} dependencies to issue ${issue.id}`)
  } else {
    console.log(
      `[Priya] Suggest-only mode: returning ${suggestions.length} suggestions for human review`
    )
  }

  return { suggestions, added }
}
