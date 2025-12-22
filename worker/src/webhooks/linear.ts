/**
 * Linear Webhook Handlers
 *
 * Handles incoming webhooks from Linear for bidirectional issue sync.
 * See: https://linear.app/developers/webhooks
 */

import type { Context } from 'hono'
import type { Env } from '../types/env'
import { getPayloadClient } from '../payload'

// ============================================
// Types
// ============================================

/**
 * Linear webhook action types
 */
export type LinearWebhookAction = 'create' | 'update' | 'remove'

/**
 * Linear webhook entity types we handle
 */
export type LinearWebhookType = 'Issue' | 'Comment'

/**
 * Linear user/actor information
 */
interface LinearActor {
  id: string
  name?: string
  email?: string
  type: 'user' | 'oauthClient' | 'integration'
}

/**
 * Linear issue state
 */
interface LinearState {
  id: string
  name: string
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  color: string
}

/**
 * Linear label
 */
interface LinearLabel {
  id: string
  name: string
  color: string
}

/**
 * Linear issue data from webhook payload
 */
interface LinearIssueData {
  id: string
  identifier: string
  title: string
  description?: string
  priority: number // 0-4: 0 = no priority, 1 = urgent, 2 = high, 3 = normal, 4 = low
  state?: LinearState
  labels?: LinearLabel[]
  assignee?: {
    id: string
    name?: string
    email?: string
  }
  team: {
    id: string
    key: string
    name: string
  }
  project?: {
    id: string
    name: string
  }
  cycle?: {
    id: string
    number: number
    name?: string
  }
  url: string
  createdAt: string
  updatedAt: string
  canceledAt?: string
  completedAt?: string
}

/**
 * Linear comment data from webhook payload
 */
interface LinearCommentData {
  id: string
  body: string
  issue: {
    id: string
    identifier: string
  }
  user?: {
    id: string
    name?: string
    email?: string
  }
  url: string
  createdAt: string
  updatedAt: string
}

/**
 * Base webhook payload structure
 */
interface LinearWebhookPayload<T = unknown> {
  action: LinearWebhookAction
  type: LinearWebhookType
  actor?: LinearActor
  createdAt: string
  data: T
  url: string
  updatedFrom?: Partial<T>
  webhookTimestamp: number
  webhookId: string
  organizationId: string
}

/**
 * Issue webhook payload
 */
export type LinearIssueWebhook = LinearWebhookPayload<LinearIssueData>

/**
 * Comment webhook payload
 */
export type LinearCommentWebhook = LinearWebhookPayload<LinearCommentData>

// ============================================
// Signature Verification
// ============================================

/**
 * Verify Linear webhook signature using HMAC-SHA256
 *
 * @param body - Raw request body string
 * @param signature - Signature from Linear-Signature header
 * @param secret - Webhook secret from LinearIntegration
 * @returns Whether the signature is valid
 */
export async function verifyLinearSignature(
  body: string,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false
  }

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    )

    // Convert to hex
    const computedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Timing-safe comparison
    if (computedSignature.length !== signature.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return result === 0
  } catch (error) {
    console.error('[Linear Webhook] Signature verification error:', error)
    return false
  }
}

/**
 * Check if webhook timestamp is within acceptable window (1 minute)
 * to guard against replay attacks
 */
export function isTimestampValid(webhookTimestamp: number): boolean {
  const now = Date.now()
  const diff = Math.abs(now - webhookTimestamp)
  const ONE_MINUTE_MS = 60 * 1000
  return diff <= ONE_MINUTE_MS
}

// ============================================
// Status Mapping
// ============================================

/**
 * Map Linear state type to beads/RepoDO status
 */
function linearStateToStatus(state?: LinearState): 'open' | 'in_progress' | 'closed' {
  if (!state) return 'open'

  switch (state.type) {
    case 'completed':
    case 'canceled':
      return 'closed'
    case 'started':
      return 'in_progress'
    case 'backlog':
    case 'unstarted':
    default:
      return 'open'
  }
}

/**
 * Map Linear priority (0-4) to beads priority (0-4)
 * Linear: 0 = no priority, 1 = urgent, 2 = high, 3 = normal, 4 = low
 * Beads: 0 = P0 (critical), 1 = P1 (high), 2 = P2 (normal), 3 = P3 (low), 4 = P4 (backlog)
 */
function linearPriorityToBeads(priority: number): number {
  // Linear 0 (no priority) maps to P2 (normal)
  if (priority === 0) return 2
  // Linear 1 (urgent) -> P0
  // Linear 2 (high) -> P1
  // Linear 3 (normal) -> P2
  // Linear 4 (low) -> P3
  return priority - 1
}

// ============================================
// Webhook Handlers
// ============================================

/**
 * Handle Linear Issue.create webhook
 */
async function handleIssueCreate(
  c: Context<{ Bindings: Env }>,
  payload: LinearIssueWebhook,
  integration: { repoFullName: string; installationId: number }
): Promise<Response> {
  const issue = payload.data
  const { repoFullName, installationId } = integration

  console.log(`[Linear Webhook] Issue created: ${issue.identifier} - ${issue.title}`)

  // Get RepoDO for this repo
  const doId = c.env.REPO.idFromName(repoFullName)
  const stub = c.env.REPO.get(doId)

  // Set context first
  await stub.fetch(
    new Request('http://do/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoFullName, installationId }),
    })
  )

  // Create issue in RepoDO
  const response = await stub.fetch(
    new Request('http://do/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: issue.title,
        description: issue.description || '',
        status: linearStateToStatus(issue.state),
        priority: linearPriorityToBeads(issue.priority),
        issue_type: 'task', // Linear doesn't have issue types
        assignee: issue.assignee?.email || issue.assignee?.name || null,
        labels: issue.labels?.map((l) => l.name) || [],
        // Store Linear metadata
        external_ref: `linear:${issue.id}`,
      }),
    })
  )

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Linear Webhook] Failed to create issue in RepoDO: ${error}`)
    return c.json({ error: 'Failed to create issue' }, 500)
  }

  const result = await response.json()

  // Update Payload Issues collection with Linear sync timestamp
  try {
    const payload = await getPayloadClient(c.env)
    await payload.create({
      collection: 'sync_events',
      data: {
        eventType: 'linear_issue_create',
        direction: 'inbound',
        status: 'completed',
        payload: JSON.stringify({ linearId: issue.id, identifier: issue.identifier }),
      },
      overrideAccess: true,
    })
  } catch (e) {
    console.error('[Linear Webhook] Failed to log sync event:', e)
  }

  return c.json({
    status: 'synced',
    action: 'create',
    linearId: issue.id,
    identifier: issue.identifier,
    result,
  })
}

/**
 * Handle Linear Issue.update webhook
 */
async function handleIssueUpdate(
  c: Context<{ Bindings: Env }>,
  payload: LinearIssueWebhook,
  integration: { repoFullName: string; installationId: number }
): Promise<Response> {
  const issue = payload.data
  const updatedFrom = payload.updatedFrom || {}
  const { repoFullName, installationId } = integration

  console.log(
    `[Linear Webhook] Issue updated: ${issue.identifier} - ${issue.title}`,
    Object.keys(updatedFrom)
  )

  // Get RepoDO for this repo
  const doId = c.env.REPO.idFromName(repoFullName)
  const stub = c.env.REPO.get(doId)

  // Set context first
  await stub.fetch(
    new Request('http://do/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoFullName, installationId }),
    })
  )

  // Find issue by Linear ID (stored in external_ref as "linear:xxx")
  const searchResponse = await stub.fetch(
    new Request(`http://do/issues/search?q=linear:${issue.id}`)
  )

  if (!searchResponse.ok) {
    console.error('[Linear Webhook] Failed to search for issue')
    return c.json({ error: 'Failed to find issue' }, 404)
  }

  const searchResults = (await searchResponse.json()) as Array<{ id: string; external_ref: string }>
  const existingIssue = searchResults.find((i) => i.external_ref === `linear:${issue.id}`)

  if (!existingIssue) {
    console.warn(`[Linear Webhook] Issue not found in RepoDO: linear:${issue.id}`)
    // Could create it here if needed
    return c.json({ status: 'ignored', reason: 'issue not found' })
  }

  // Build update payload - only include changed fields
  const updates: Record<string, unknown> = {}

  if ('title' in updatedFrom) {
    updates.title = issue.title
  }
  if ('description' in updatedFrom) {
    updates.description = issue.description || ''
  }
  if ('state' in updatedFrom) {
    updates.status = linearStateToStatus(issue.state)
  }
  if ('priority' in updatedFrom) {
    updates.priority = linearPriorityToBeads(issue.priority)
  }
  if ('assignee' in updatedFrom) {
    updates.assignee = issue.assignee?.email || issue.assignee?.name || null
  }
  if ('labels' in updatedFrom) {
    updates.labels = issue.labels?.map((l) => l.name) || []
  }

  if (Object.keys(updates).length === 0) {
    console.log('[Linear Webhook] No relevant changes to sync')
    return c.json({ status: 'ignored', reason: 'no relevant changes' })
  }

  // Update issue in RepoDO
  const response = await stub.fetch(
    new Request(`http://do/issues/${existingIssue.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  )

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Linear Webhook] Failed to update issue in RepoDO: ${error}`)
    return c.json({ error: 'Failed to update issue' }, 500)
  }

  const result = await response.json()

  return c.json({
    status: 'synced',
    action: 'update',
    linearId: issue.id,
    identifier: issue.identifier,
    updates: Object.keys(updates),
    result,
  })
}

/**
 * Handle Linear Issue.remove webhook
 */
async function handleIssueRemove(
  c: Context<{ Bindings: Env }>,
  payload: LinearIssueWebhook,
  integration: { repoFullName: string; installationId: number }
): Promise<Response> {
  const issue = payload.data
  const { repoFullName, installationId } = integration

  console.log(`[Linear Webhook] Issue removed: ${issue.identifier} - ${issue.title}`)

  // Get RepoDO for this repo
  const doId = c.env.REPO.idFromName(repoFullName)
  const stub = c.env.REPO.get(doId)

  // Set context first
  await stub.fetch(
    new Request('http://do/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoFullName, installationId }),
    })
  )

  // Find issue by Linear ID
  const searchResponse = await stub.fetch(
    new Request(`http://do/issues/search?q=linear:${issue.id}`)
  )

  if (!searchResponse.ok) {
    console.error('[Linear Webhook] Failed to search for issue')
    return c.json({ error: 'Failed to find issue' }, 404)
  }

  const searchResults = (await searchResponse.json()) as Array<{ id: string; external_ref: string }>
  const existingIssue = searchResults.find((i) => i.external_ref === `linear:${issue.id}`)

  if (!existingIssue) {
    console.warn(`[Linear Webhook] Issue not found in RepoDO: linear:${issue.id}`)
    return c.json({ status: 'ignored', reason: 'issue not found' })
  }

  // Close the issue (don't delete - mark as closed with reason)
  const response = await stub.fetch(
    new Request(`http://do/issues/${existingIssue.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Deleted from Linear' }),
    })
  )

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Linear Webhook] Failed to close issue in RepoDO: ${error}`)
    return c.json({ error: 'Failed to close issue' }, 500)
  }

  return c.json({
    status: 'synced',
    action: 'remove',
    linearId: issue.id,
    identifier: issue.identifier,
    issueId: existingIssue.id,
  })
}

/**
 * Handle Linear Comment.create webhook
 * Syncs new Linear comments to GitHub issue comments
 */
async function handleCommentCreate(
  c: Context<{ Bindings: Env }>,
  payload: LinearCommentWebhook,
  integration: { repoFullName: string; installationId: number }
): Promise<Response> {
  const comment = payload.data
  const { repoFullName, installationId } = integration

  console.log(`[Linear Webhook] Comment created on ${comment.issue.identifier}`)

  // Get RepoDO for this repo
  const doId = c.env.REPO.idFromName(repoFullName)
  const stub = c.env.REPO.get(doId)

  // Set context first
  await stub.fetch(
    new Request('http://do/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoFullName, installationId }),
    })
  )

  // Find the issue by Linear issue ID
  // We need to get the Linear issue ID from the comment payload
  const linearIssueId = comment.issue.id

  const searchResponse = await stub.fetch(
    new Request(`http://do/issues/search?q=linear:${linearIssueId}`)
  )

  if (!searchResponse.ok) {
    console.error('[Linear Webhook] Failed to search for issue')
    return c.json({ error: 'Failed to find issue' }, 404)
  }

  const searchResults = (await searchResponse.json()) as Array<{
    id: string
    external_ref: string
    github_number: number | null
  }>
  const existingIssue = searchResults.find((i) => i.external_ref === `linear:${linearIssueId}`)

  if (!existingIssue) {
    console.warn(`[Linear Webhook] Issue not found for comment: linear:${linearIssueId}`)
    return c.json({ status: 'ignored', reason: 'issue not found' })
  }

  // If issue has a GitHub number, sync the comment there
  if (existingIssue.github_number) {
    console.log(
      `[Linear Webhook] Syncing comment to GitHub issue #${existingIssue.github_number}`
    )

    // Format the comment with Linear attribution
    const commentBody = `**Comment from Linear by ${comment.user?.name || 'Unknown'}:**\n\n${comment.body}\n\n---\n*[View in Linear](${comment.url})*`

    // Create comment on GitHub via RepoDO
    const commentResponse = await stub.fetch(
      new Request(`http://do/issues/${existingIssue.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody }),
      })
    )

    if (!commentResponse.ok) {
      const errorText = await commentResponse.text()
      console.error(`[Linear Webhook] Failed to create GitHub comment: ${errorText}`)
      return c.json({
        status: 'error',
        action: 'comment_create',
        error: errorText,
        linearIssueId,
        githubNumber: existingIssue.github_number,
      }, 500)
    }

    const commentResult = await commentResponse.json() as {
      ok: boolean
      comment: { id: number; github_id: number; html_url: string }
    }

    return c.json({
      status: 'synced',
      action: 'comment_create',
      linearIssueId,
      githubNumber: existingIssue.github_number,
      linearCommentId: comment.id,
      githubCommentId: commentResult.comment.github_id,
      githubCommentUrl: commentResult.comment.html_url,
    })
  }

  return c.json({
    status: 'ignored',
    reason: 'issue not linked to GitHub',
    linearIssueId,
  })
}

// ============================================
// Main Handler
// ============================================

/**
 * Find LinearIntegration by organization ID
 */
async function findIntegrationByOrg(
  env: Env,
  organizationId: string
): Promise<{
  webhookSecret: string
  repoFullName: string
  installationId: number
} | null> {
  try {
    const payload = await getPayloadClient(env)

    // Find LinearIntegration by organization ID
    const integrations = await payload.find({
      collection: 'linear_integrations',
      where: {
        'linear.organizationId': { equals: organizationId },
        active: { equals: true },
      },
      limit: 1,
      depth: 2, // Populate repo and installation
      overrideAccess: true,
    })

    if (!integrations.docs?.length) {
      return null
    }

    const integration = integrations.docs[0] as any

    // Get webhook secret from integration
    const webhookSecret = integration.webhookSecret
    if (!webhookSecret) {
      console.warn('[Linear Webhook] Integration found but no webhook secret')
      return null
    }

    // Get repo details
    const repo = integration.repo
    if (!repo?.fullName) {
      console.warn('[Linear Webhook] Integration found but no repo linked')
      return null
    }

    // Get installation ID
    const installationId = repo.installation?.installationId
    if (!installationId) {
      console.warn('[Linear Webhook] Integration found but no installation')
      return null
    }

    return {
      webhookSecret,
      repoFullName: repo.fullName,
      installationId,
    }
  } catch (error) {
    console.error('[Linear Webhook] Failed to find integration:', error)
    return null
  }
}

/**
 * Main Linear webhook handler
 */
export async function handleLinearWebhook(
  c: Context<{ Bindings: Env }>
): Promise<Response> {
  const t0 = Date.now()
  const signature = c.req.header('linear-signature')
  const deliveryId = c.req.header('x-linear-delivery') // Optional delivery ID

  console.log(`[Linear Webhook] Received at t=0ms (delivery: ${deliveryId})`)

  // Read raw body for signature verification
  const body = await c.req.text()
  console.log(`[Linear Webhook] Body read: ${Date.now() - t0}ms (${body.length} bytes)`)

  // Parse payload first to get organization ID
  let payload: LinearWebhookPayload
  try {
    payload = JSON.parse(body)
  } catch {
    console.error('[Linear Webhook] Invalid JSON payload')
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  // Verify timestamp is within acceptable window
  if (!isTimestampValid(payload.webhookTimestamp)) {
    console.warn('[Linear Webhook] Timestamp outside acceptable window')
    return c.json({ error: 'Timestamp expired' }, 401)
  }

  // Find integration by organization ID
  const integration = await findIntegrationByOrg(c.env, payload.organizationId)
  if (!integration) {
    console.warn(`[Linear Webhook] No active integration for org: ${payload.organizationId}`)
    return c.json({ error: 'No integration found' }, 404)
  }

  // Verify signature
  const isValid = await verifyLinearSignature(body, signature, integration.webhookSecret)
  console.log(`[Linear Webhook] Signature verified: ${Date.now() - t0}ms (valid=${isValid})`)

  if (!isValid) {
    console.warn('[Linear Webhook] Invalid signature')
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // Route to appropriate handler based on type and action
  console.log(
    `[Linear Webhook] Processing ${payload.type}.${payload.action} (${Date.now() - t0}ms)`
  )

  switch (payload.type) {
    case 'Issue':
      switch (payload.action) {
        case 'create':
          return handleIssueCreate(
            c,
            payload as LinearIssueWebhook,
            integration
          )
        case 'update':
          return handleIssueUpdate(
            c,
            payload as LinearIssueWebhook,
            integration
          )
        case 'remove':
          return handleIssueRemove(
            c,
            payload as LinearIssueWebhook,
            integration
          )
      }
      break

    case 'Comment':
      switch (payload.action) {
        case 'create':
          return handleCommentCreate(
            c,
            payload as LinearCommentWebhook,
            integration
          )
        case 'update':
          // Comment updates typically not needed
          return c.json({ status: 'ignored', reason: 'comment update not synced' })
        case 'remove':
          // Comment deletions could be handled but typically not critical
          return c.json({ status: 'ignored', reason: 'comment remove not synced' })
      }
      break
  }

  console.log(`[Linear Webhook] Unhandled event: ${payload.type}.${payload.action}`)
  return c.json({ status: 'ignored', event: `${payload.type}.${payload.action}` })
}
