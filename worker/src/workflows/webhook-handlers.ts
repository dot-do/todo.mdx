/**
 * Webhook Handlers for Cloudflare Workflows
 *
 * These handlers show how to:
 * 1. Trigger workflows when issues become ready
 * 2. Send events to paused workflows (e.g., PR approval)
 * 3. Integrate with beads, GitHub, and Payload
 */

import type { Env } from '../types'
import type { DevelopWorkflowPayload } from './develop'
import type { Repo, Issue, PR } from 'agents.mdx'

// Extended WorkflowInstance with sendEvent for Cloudflare Workflows
interface WorkflowInstance {
  id: string
  status: 'running' | 'complete' | 'failed' | 'paused'
  pause(): Promise<void>
  resume(): Promise<void>
  terminate(): Promise<void>
  sendEvent(event: { type: string; payload?: unknown }): Promise<void>
}

// ============================================================================
// Issue Ready Handler
// ============================================================================

/**
 * Trigger workflow when issue becomes ready (no blockers)
 *
 * Called by:
 * - beads sync daemon when issue unblocks
 * - webhook when GitHub issue updated
 * - manual API call
 */
export async function handleIssueReady(
  env: Env,
  issue: Issue,
  repo: Repo,
  installationId: number
): Promise<WorkflowInstance> {
  console.log(`[Workflows] Issue ready: ${issue.id} - ${issue.title}`)

  // Check if workflow already exists for this issue
  const existingId = `develop-${issue.id}`

  try {
    const existing = await env.DEVELOP_WORKFLOW.get(existingId) as unknown as WorkflowInstance

    if (existing.status === 'running' || existing.status === 'paused') {
      console.log(`[Workflows] Workflow already running: ${existingId}`)
      return existing
    }
  } catch (err) {
    // Workflow doesn't exist, continue to create
  }

  // Create new workflow instance
  const payload: DevelopWorkflowPayload = {
    repo,
    issue,
    installationId,
  }

  const instance = await env.DEVELOP_WORKFLOW.create({
    id: existingId,
    params: payload,
  }) as unknown as WorkflowInstance

  console.log(`[Workflows] Started workflow: ${existingId}`)

  return instance
}

// ============================================================================
// PR Approval Handler
// ============================================================================

/**
 * Send PR approval event to waiting workflow
 *
 * Called by GitHub webhook when PR is approved
 */
export async function handlePRApproval(
  env: Env,
  pr: PR,
  reviewer: string
): Promise<void> {
  console.log(`[Workflows] PR approved: #${pr.number} by ${reviewer}`)

  // Extract issue ID from PR body (e.g., "Closes #todo-abc")
  const issueId = extractIssueId(pr.body)

  if (!issueId) {
    console.log(`[Workflows] No issue ID found in PR #${pr.number}`)
    return
  }

  const workflowId = `develop-${issueId}`

  try {
    const workflow = await env.DEVELOP_WORKFLOW.get(workflowId) as unknown as WorkflowInstance

    // Workflow should be paused waiting for approval
    if (workflow.status !== 'paused') {
      console.log(
        `[Workflows] Workflow ${workflowId} not paused (status: ${workflow.status})`
      )
      return
    }

    // Send the approval event to resume the workflow
    // The workflow is waiting for this via step.waitForEvent('pr_approval', ...)
    // Event type must match what was passed to waitForEvent
    await workflow.sendEvent({
      type: 'pr_approval',
      payload: {
        prNumber: pr.number,
        reviewer,
        approvedAt: new Date().toISOString(),
      },
    })

    console.log(
      `[Workflows] Sent approval event to workflow ${workflowId} for PR #${pr.number}`
    )
  } catch (err) {
    const error = err as Error
    console.log(`[Workflows] Failed to send event to ${workflowId}: ${error.message}`)
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract issue ID from PR body
 * Looks for patterns like "Closes #todo-abc" or "#todo-123"
 */
function extractIssueId(body: string): string | null {
  const patterns = [
    /Closes #([\w-]+)/i,
    /Fixes #([\w-]+)/i,
    /Resolves #([\w-]+)/i,
    /#(todo-[\w-]+)/i,
  ]

  for (const pattern of patterns) {
    const match = body.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

// ============================================================================
// Example Integration with Worker Routes
// ============================================================================

/**
 * Example: Add to worker index.ts
 *
 * ```typescript
 * import { handleIssueReady, handlePRApproval } from './workflows/webhook-handlers'
 *
 * // When beads issue becomes ready
 * app.post('/api/workflows/issue/ready', async (c) => {
 *   const { issue, repo, installationId } = await c.req.json()
 *
 *   const instance = await handleIssueReady(
 *     c.env,
 *     issue,
 *     repo,
 *     installationId
 *   )
 *
 *   return c.json({
 *     workflowId: instance.id,
 *     status: instance.status,
 *   })
 * })
 *
 * // When GitHub PR is approved
 * app.post('/github/webhook/pr_review', async (c) => {
 *   const payload = await c.req.json()
 *
 *   if (payload.review?.state === 'approved') {
 *     await handlePRApproval(
 *       c.env,
 *       {
 *         number: payload.pull_request.number,
 *         title: payload.pull_request.title,
 *         body: payload.pull_request.body,
 *         branch: payload.pull_request.head.ref,
 *         url: payload.pull_request.html_url,
 *         state: payload.pull_request.state,
 *       },
 *       payload.review.user.login
 *     )
 *   }
 *
 *   return c.json({ status: 'ok' })
 * })
 * ```
 */
