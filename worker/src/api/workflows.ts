/**
 * Workflows API Routes
 *
 * Endpoints for triggering and managing Cloudflare Workflows:
 * - POST /api/workflows/issue/ready - Trigger DevelopWorkflow for ready issue
 * - POST /api/workflows/pr/approved - Send approval event to paused workflow
 */

import { Hono } from 'hono'
import { authMiddleware } from '../auth/index.js'
import { handleIssueReady, handlePRApproval } from '../workflows/webhook-handlers.js'
import type { Env } from '../types.js'
import type { Issue, Repo, PR } from 'agents.mdx'

const workflows = new Hono<{ Bindings: Env }>()

// All workflow routes require auth
workflows.use('/*', authMiddleware)

/**
 * Trigger DevelopWorkflow when issue becomes ready
 *
 * Called by:
 * - beads daemon when issue unblocks (blocked → open)
 * - manual API call to start work on an issue
 *
 * Request body:
 * {
 *   issue: Issue,
 *   repo: Repo,
 *   installationId: number
 * }
 */
workflows.post('/issue/ready', async (c) => {
  try {
    const body = await c.req.json()
    const { issue, repo, installationId } = body as {
      issue: Issue
      repo: Repo
      installationId: number
    }

    if (!issue?.id || !repo?.owner || !repo?.name || !installationId) {
      return c.json(
        { error: 'Missing required fields: issue, repo (owner, name), installationId' },
        400
      )
    }

    const instance = await handleIssueReady(c.env, issue, repo, installationId)

    return c.json({
      workflowId: instance.id,
      status: instance.status,
      issueId: issue.id,
      repo: `${repo.owner}/${repo.name}`,
    })
  } catch (error) {
    const err = error as Error
    console.error('[Workflows] Failed to start workflow:', err)
    return c.json({ error: err.message }, 500)
  }
})

/**
 * Send PR approval event to paused workflow
 *
 * Called by:
 * - GitHub webhook when PR is approved
 * - Manual API call to resume workflow
 *
 * Request body:
 * {
 *   pr: PR,
 *   reviewer: string
 * }
 */
workflows.post('/pr/approved', async (c) => {
  try {
    const body = await c.req.json()
    const { pr, reviewer } = body as {
      pr: PR
      reviewer: string
    }

    if (!pr?.number || !pr?.body || !reviewer) {
      return c.json(
        { error: 'Missing required fields: pr (number, body), reviewer' },
        400
      )
    }

    await handlePRApproval(c.env, pr, reviewer)

    return c.json({
      status: 'ok',
      prNumber: pr.number,
      reviewer,
    })
  } catch (error) {
    const err = error as Error
    console.error('[Workflows] Failed to handle PR approval:', err)
    return c.json({ error: err.message }, 500)
  }
})

/**
 * Get workflow status
 */
workflows.get('/status/:workflowId', async (c) => {
  try {
    const workflowId = c.req.param('workflowId')

    const instance = await c.env.DEVELOP_WORKFLOW.get(workflowId)

    return c.json({
      id: instance.id,
      status: instance.status,
    })
  } catch (error) {
    return c.json({ error: 'Workflow not found' }, 404)
  }
})

/**
 * List recent workflows
 */
workflows.get('/list', async (c) => {
  // Cloudflare Workflows doesn't have a list API yet
  // This is a placeholder for future implementation
  return c.json({
    workflows: [],
    message: 'Workflow listing not yet implemented',
  })
})

export default workflows
