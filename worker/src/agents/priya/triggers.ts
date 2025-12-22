/**
 * Priya Trigger Handlers
 *
 * Event-driven triggers for the Planner Agent (Priya):
 * - onIssueClosed: Analyze DAG, find newly unblocked issues, assign agents
 * - onEpicCompleted: Close epic when all children are done
 * - onIssueBlocked: Reassign agent to other ready work
 * - onPRMerged: Verify linked issue is closed
 */

import type { Issue } from 'beads-workflows'
import type { WorkflowRuntime, PR } from '@todo.mdx/agents.mdx'

/**
 * Handle issue.closed event
 *
 * When an issue is closed:
 * 1. Find all issues that were blocked by this issue
 * 2. Check which of those are now ready (all blockers closed)
 * 3. Match each ready issue to the best-fit agent
 * 4. Assign the agent to the issue
 */
export async function onIssueClosed(
  runtime: WorkflowRuntime,
  issue: Issue
): Promise<void> {
  console.log(`[Priya] Issue ${issue.id} closed: "${issue.title}"`)

  // Get all issues that this issue unblocks
  const unblocked = await runtime.dag.unblocks(issue.id)

  if (unblocked.length === 0) {
    console.log(`[Priya] No issues unblocked by ${issue.id}`)
    return
  }

  console.log(
    `[Priya] Issue ${issue.id} unblocks ${unblocked.length} issue(s)`
  )

  // Get all currently ready issues (no open blockers)
  const ready = await runtime.dag.ready()
  const readyIds = new Set(ready.map((i) => i.id))

  // Filter to issues that were unblocked AND are now ready
  const newlyReady = unblocked.filter((i) => readyIds.has(i.id))

  if (newlyReady.length === 0) {
    console.log(
      `[Priya] None of the unblocked issues are ready (still have other blockers)`
    )
    return
  }

  console.log(
    `[Priya] ${newlyReady.length} issue(s) are now ready for assignment`
  )

  // For each newly ready issue, find best agent and assign
  for (const readyIssue of newlyReady) {
    const match = await runtime.agents.match(readyIssue)

    if (!match) {
      console.log(
        `[Priya] No agent match found for issue ${readyIssue.id}: "${readyIssue.title}"`
      )
      continue
    }

    console.log(
      `[Priya] Assigning ${readyIssue.id} to ${match.agent.name} (confidence: ${match.confidence})`
    )

    await runtime.issues.update(readyIssue.id, {
      assignee: match.agent.name,
    })
  }
}

/**
 * Handle epic.completed event
 *
 * When all children of an epic are closed:
 * 1. Verify all children are actually closed
 * 2. Close the epic
 * 3. Post summary (future: could analyze critical path, etc.)
 */
export async function onEpicCompleted(
  runtime: WorkflowRuntime,
  epic: Issue,
  children: Issue[]
): Promise<void> {
  console.log(`[Priya] Checking epic ${epic.id}: "${epic.title}"`)

  // Get progress to verify completion
  const progress = await runtime.epics.progress(epic.id)

  if (progress.percentage < 100) {
    console.log(
      `[Priya] Epic ${epic.id} is ${progress.percentage}% complete (${progress.completed}/${progress.total})`
    )
    return
  }

  console.log(
    `[Priya] Epic ${epic.id} is 100% complete - closing epic`
  )

  // Close the epic
  await runtime.issues.close(epic.id, 'All child tasks completed')

  console.log(`[Priya] Epic ${epic.id} closed successfully`)
}

/**
 * Handle issue.blocked event
 *
 * When an issue becomes blocked:
 * 1. Clear the assignee (agent can't work on it)
 * 2. Find other ready work
 * 3. Reassign the agent to new ready work
 */
export async function onIssueBlocked(
  runtime: WorkflowRuntime,
  issue: Issue,
  blocker: Issue
): Promise<void> {
  console.log(
    `[Priya] Issue ${issue.id} blocked by ${blocker.id}: "${blocker.title}"`
  )

  const previousAssignee = issue.assignee

  // Clear assignee and set status back to open
  await runtime.issues.update(issue.id, {
    assignee: undefined,
    status: 'open',
  })

  if (!previousAssignee) {
    console.log(`[Priya] Issue ${issue.id} had no assignee, nothing to reassign`)
    return
  }

  console.log(
    `[Priya] Clearing assignee ${previousAssignee} from blocked issue ${issue.id}`
  )

  // Find other ready work for the agent
  const ready = await runtime.dag.ready()

  if (ready.length === 0) {
    console.log(`[Priya] No ready work available for reassignment`)
    return
  }

  console.log(
    `[Priya] Found ${ready.length} ready issue(s), attempting to reassign ${previousAssignee}`
  )

  // Try to find a ready issue that matches the agent's capabilities
  const agents = await runtime.agents.list()
  const agent = agents.find((a) => a.name === previousAssignee)

  if (!agent) {
    console.log(`[Priya] Agent ${previousAssignee} not found in agent list`)
    return
  }

  // Find best match among ready issues for this specific agent
  for (const readyIssue of ready) {
    const match = await runtime.agents.match(readyIssue)

    if (match && match.agent.name === previousAssignee) {
      console.log(
        `[Priya] Reassigning ${previousAssignee} from ${issue.id} to ${readyIssue.id}`
      )

      await runtime.issues.update(readyIssue.id, {
        assignee: previousAssignee,
      })

      return
    }
  }

  console.log(
    `[Priya] No suitable ready work found for ${previousAssignee}`
  )
}

/**
 * Handle pr.merged event
 *
 * When a PR is merged:
 * 1. Extract issue reference from PR body (e.g., "Closes #123")
 * 2. Verify the linked issue is closed
 * 3. If not closed, close it
 */
export async function onPRMerged(
  runtime: WorkflowRuntime,
  pr: PR
): Promise<void> {
  console.log(`[Priya] PR #${pr.number} merged: "${pr.title}"`)

  // Extract issue ID from PR body
  const issueId = extractIssueId(pr.body)

  if (!issueId) {
    console.log(`[Priya] No issue reference found in PR #${pr.number} body`)
    return
  }

  console.log(`[Priya] PR #${pr.number} links to issue ${issueId}`)

  try {
    // Get the linked issue
    const issue = await runtime.issues.show(issueId)

    if (issue.status === 'closed') {
      console.log(`[Priya] Issue ${issueId} is already closed`)
      return
    }

    console.log(
      `[Priya] Issue ${issueId} is still ${issue.status}, closing it`
    )

    // Close the issue
    await runtime.issues.close(issueId, `Closed by merged PR #${pr.number}`)

    console.log(`[Priya] Closed issue ${issueId} linked to PR #${pr.number}`)
  } catch (error) {
    console.error(
      `[Priya] Failed to close issue ${issueId} for PR #${pr.number}:`,
      error
    )
    // Don't throw - PR merge shouldn't fail if issue close fails
  }
}

/**
 * Extract issue ID from PR body
 *
 * Looks for patterns like:
 * - Closes #issue-123
 * - Fixes #issue-123
 * - Resolves #issue-123
 * - Implements #issue-123
 * - Implements feature from #test-2
 * - Closes test-123
 * - etc.
 */
function extractIssueId(body: string): string | null {
  if (!body) {
    return null
  }

  // Match various keywords followed by # and issue ID
  // Supports patterns like:
  // - "Closes #test-1"
  // - "Fixes #nonexistent-issue"
  // - "Implements feature from #test-2"
  const patterns = [
    /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved|implement|implements|implemented)(?:\s+\w+)?\s+(?:from\s+)?#([a-z]+-[a-z0-9]+)/i,
    /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved|implement|implements|implemented)\s+([a-z]+-[a-z0-9]+)/i,
  ]

  for (const pattern of patterns) {
    const match = body.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}
