/**
 * Priya Assignment Service
 *
 * Assigns ready issues to best-fit agents based on:
 * 1. DAG analysis (only assign ready issues)
 * 2. Capability matching (issue requirements → agent capabilities)
 * 3. Focus area matching (file paths → agent specialization)
 */

import type { WorkflowRuntime } from '../types'
import type { Issue, AgentConfig } from '../types'

/**
 * Assignment result with metadata
 */
export interface AssignmentResult {
  issue: Issue
  agent: AgentConfig
  confidence: number
  reason: string
}

/**
 * Assign ready issues to best-fit agents
 *
 * Algorithm:
 * 1. Get all open issues
 * 2. Use DAG to find ready issues (no open blockers)
 * 3. For each ready issue:
 *    - Skip if already assigned
 *    - Match to best-fit agent
 *    - Update issue with assignee
 *    - Return assignment result
 *
 * @param runtime - Workflow runtime with access to issues and agents
 * @returns Array of assignment results
 */
export async function assignReadyIssues(runtime: WorkflowRuntime): Promise<AssignmentResult[]> {
  // Get all open issues
  const allIssues = await runtime.issues.list({ status: 'open' })

  // Get ready issues (no open dependencies)
  const readyIssues = await runtime.dag.ready()

  // Get available agents
  const agents = await runtime.agents.list()

  const results: AssignmentResult[] = []

  for (const issue of readyIssues) {
    // Skip if already assigned
    if (issue.assignee) {
      continue
    }

    // Find best-fit agent
    const match = await runtime.agents.match(issue)

    if (match) {
      // Update issue with assignee
      await runtime.issues.update(issue.id, { assignee: match.agent.name })

      results.push({
        issue,
        agent: match.agent,
        confidence: match.confidence,
        reason: match.reason,
      })
    }
  }

  return results
}
