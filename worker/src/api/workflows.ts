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
 * Get workflow status - supports multiple workflow types
 */
workflows.get('/status/:workflowId', async (c) => {
  return getWorkflowStatus(c)
})

/**
 * Get workflow status by ID (alternative route for simpler API)
 */
workflows.get('/:workflowId', async (c) => {
  return getWorkflowStatus(c)
})

async function getWorkflowStatus(c: any) {
  const workflowId = c.req.param('workflowId')

  // Try each workflow type based on prefix
  try {
    let instance: any

    if (workflowId.startsWith('sync-')) {
      instance = await c.env.BEADS_SYNC_WORKFLOW.get(workflowId)
    } else if (workflowId.startsWith('develop-')) {
      instance = await c.env.DEVELOP_WORKFLOW.get(workflowId)
    } else {
      // Default to DEVELOP_WORKFLOW for backwards compatibility
      instance = await c.env.DEVELOP_WORKFLOW.get(workflowId)
    }

    // status() is a method, not a property
    const statusInfo = await instance.status()

    return c.json({
      id: instance.id,
      status: statusInfo.status,
      output: statusInfo.output,
      error: statusInfo.error,
    })
  } catch (error) {
    return c.json({ error: 'Workflow not found' }, 404)
  }
}

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

// ============================================================================
// PR Management Endpoints
// ============================================================================

/**
 * Create a pull request
 */
workflows.post('/pr/create', async (c) => {
  try {
    const body = await c.req.json()
    const { repo, branch, title, body: prBody, installationId } = body as {
      repo: { owner: string; name: string }
      branch: string
      title: string
      body: string
      installationId: number
    }

    if (!repo?.owner || !repo?.name || !branch || !title || !installationId) {
      return c.json(
        { error: 'Missing required fields: repo (owner, name), branch, title, installationId' },
        400
      )
    }

    // Get GitHub token and create PR via API
    const { Octokit } = await import('@octokit/rest')
    const { createAppAuth } = await import('@octokit/auth-app')

    const auth = createAppAuth({
      appId: c.env.GITHUB_APP_ID,
      privateKey: c.env.GITHUB_PRIVATE_KEY,
      installationId,
    })

    const { token } = await auth({ type: 'installation' })
    const octokit = new Octokit({ auth: token })

    const { data } = await octokit.pulls.create({
      owner: repo.owner,
      repo: repo.name,
      head: branch,
      base: 'main',
      title,
      body: prBody,
    })

    return c.json({
      number: data.number,
      url: data.html_url,
      state: data.state,
    })
  } catch (error) {
    const err = error as Error
    console.error('[Workflows] Failed to create PR:', err)
    return c.json({ error: err.message }, 500)
  }
})

/**
 * Submit a review on a PR
 */
workflows.post('/pr/review', async (c) => {
  try {
    const body = await c.req.json()
    const { repo, prNumber, action, body: reviewBody, installationId } = body as {
      repo: { owner: string; name: string }
      prNumber: number
      action: 'approve' | 'request_changes' | 'comment'
      body: string
      installationId: number
    }

    if (!repo?.owner || !repo?.name || !prNumber || !action || !installationId) {
      return c.json(
        { error: 'Missing required fields: repo, prNumber, action, installationId' },
        400
      )
    }

    const { Octokit } = await import('@octokit/rest')
    const { createAppAuth } = await import('@octokit/auth-app')

    const auth = createAppAuth({
      appId: c.env.GITHUB_APP_ID,
      privateKey: c.env.GITHUB_PRIVATE_KEY,
      installationId,
    })

    const { token } = await auth({ type: 'installation' })
    const octokit = new Octokit({ auth: token })

    // Map action to GitHub event type
    const eventMap = {
      approve: 'APPROVE' as const,
      request_changes: 'REQUEST_CHANGES' as const,
      comment: 'COMMENT' as const,
    }

    const { data } = await octokit.pulls.createReview({
      owner: repo.owner,
      repo: repo.name,
      pull_number: prNumber,
      body: reviewBody,
      event: eventMap[action],
    })

    return c.json({
      id: data.id,
      state: data.state,
    })
  } catch (error) {
    const err = error as Error
    console.error('[Workflows] Failed to submit review:', err)
    return c.json({ error: err.message }, 500)
  }
})

/**
 * Request reviewers for a PR
 */
workflows.post('/pr/review/request', async (c) => {
  try {
    const body = await c.req.json()
    const { repo, prNumber, reviewers, installationId } = body as {
      repo: { owner: string; name: string }
      prNumber: number
      reviewers: string[]
      installationId: number
    }

    if (!repo?.owner || !repo?.name || !prNumber || !reviewers?.length || !installationId) {
      return c.json(
        { error: 'Missing required fields: repo, prNumber, reviewers, installationId' },
        400
      )
    }

    const { Octokit } = await import('@octokit/rest')
    const { createAppAuth } = await import('@octokit/auth-app')

    const auth = createAppAuth({
      appId: c.env.GITHUB_APP_ID,
      privateKey: c.env.GITHUB_PRIVATE_KEY,
      installationId,
    })

    const { token } = await auth({ type: 'installation' })
    const octokit = new Octokit({ auth: token })

    const { data } = await octokit.pulls.requestReviewers({
      owner: repo.owner,
      repo: repo.name,
      pull_number: prNumber,
      reviewers,
    })

    return c.json({
      reviewers: data.requested_reviewers?.map((r) => r.login) ?? [],
    })
  } catch (error) {
    const err = error as Error
    console.error('[Workflows] Failed to request reviewers:', err)
    // Return 400 instead of 500 if user not found
    if (err.message.includes('Could not resolve to a User')) {
      return c.json({ error: err.message }, 400)
    }
    return c.json({ error: err.message }, 500)
  }
})

/**
 * Merge a PR
 */
workflows.post('/pr/merge', async (c) => {
  try {
    const body = await c.req.json()
    const { repo, prNumber, mergeMethod, installationId } = body as {
      repo: { owner: string; name: string }
      prNumber: number
      mergeMethod?: 'merge' | 'squash' | 'rebase'
      installationId: number
    }

    if (!repo?.owner || !repo?.name || !prNumber || !installationId) {
      return c.json(
        { error: 'Missing required fields: repo, prNumber, installationId' },
        400
      )
    }

    const { Octokit } = await import('@octokit/rest')
    const { createAppAuth } = await import('@octokit/auth-app')

    const auth = createAppAuth({
      appId: c.env.GITHUB_APP_ID,
      privateKey: c.env.GITHUB_PRIVATE_KEY,
      installationId,
    })

    const { token } = await auth({ type: 'installation' })
    const octokit = new Octokit({ auth: token })

    const { data } = await octokit.pulls.merge({
      owner: repo.owner,
      repo: repo.name,
      pull_number: prNumber,
      merge_method: mergeMethod || 'squash',
    })

    return c.json({
      merged: data.merged,
      sha: data.sha,
      message: data.message,
    })
  } catch (error) {
    const err = error as Error
    console.error('[Workflows] Failed to merge PR:', err)
    return c.json({ error: err.message }, 500)
  }
})

export default workflows
