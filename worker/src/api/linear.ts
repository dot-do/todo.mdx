/**
 * Linear Integration API
 * Handles Linear webhooks with proper signature verification
 */

import { Hono } from 'hono'
import type { Env } from '../types'

const linear = new Hono<{ Bindings: Env }>()

/**
 * Verify Linear webhook signature using HMAC-SHA256
 * Linear sends the signature in the 'Linear-Signature' header
 * The signature is the HMAC-SHA256 hash of the raw request body
 */
async function verifyLinearSignature(
  body: string,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature) {
    console.error('Linear webhook: Missing signature header')
    return false
  }

  try {
    // Import the subtle crypto for HMAC
    const encoder = new TextEncoder()

    // Import the secret key
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Sign the body
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    )

    // Convert to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Compare signatures (constant-time comparison)
    return timingSafeEqual(expectedSignature, signature.toLowerCase())
  } catch (error) {
    console.error('Linear webhook signature verification error:', error)
    return false
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Linear webhook handler
 * POST /api/linear/webhook
 *
 * Receives webhooks from Linear for issue, cycle, and project events
 * Verifies signature and processes the event
 */
linear.post('/webhook', async (c) => {
  const signature = c.req.header('Linear-Signature')
  const webhookSecret = c.env.LINEAR_WEBHOOK_SECRET

  // Check if webhook secret is configured
  if (!webhookSecret) {
    console.warn('LINEAR_WEBHOOK_SECRET not configured - accepting webhook without verification')
    console.warn('This is a security risk - please set LINEAR_WEBHOOK_SECRET')
  }

  // Get raw body for signature verification
  const rawBody = await c.req.text()

  // Verify signature if secret is configured
  if (webhookSecret) {
    const isValid = await verifyLinearSignature(rawBody, signature, webhookSecret)

    if (!isValid) {
      console.error('Linear webhook: Invalid signature')
      return c.json(
        {
          error: 'Invalid webhook signature',
          message: 'Webhook signature verification failed'
        },
        401
      )
    }

    console.log('Linear webhook: Signature verified successfully')
  }

  // Parse the webhook payload
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch (error) {
    console.error('Linear webhook: Invalid JSON payload', error)
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const { type, action, data, organizationId, webhookId } = payload

  console.log(`Linear webhook received: ${type} - ${action} (org: ${organizationId}, webhook: ${webhookId})`)

  // Handle different webhook types
  switch (type) {
    case 'Issue':
      return handleIssueWebhook(c, action, data, organizationId)

    case 'Cycle':
      return handleCycleWebhook(c, action, data, organizationId)

    case 'Project':
      return handleProjectWebhook(c, action, data, organizationId)

    default:
      console.log(`Linear webhook: Unsupported type ${type}`)
      return c.json({ status: 'ignored', reason: `Unsupported webhook type: ${type}` })
  }
})

/**
 * Handle Linear Issue webhooks
 */
async function handleIssueWebhook(
  c: any,
  action: string,
  data: any,
  organizationId: string
): Promise<Response> {
  try {
    // Find the Linear integration for this organization
    const integrations = await c.env.PAYLOAD.find({
      collection: 'linear-integrations',
      where: {
        'linearData.organizationId': { equals: organizationId },
        active: { equals: true },
      },
      limit: 1,
    })

    if (!integrations.docs || integrations.docs.length === 0) {
      console.warn(`No active Linear integration found for organization ${organizationId}`)
      return c.json({ status: 'ignored', reason: 'No active integration found' })
    }

    const integration = integrations.docs[0]

    // Map Linear action to our action
    let syncAction = action
    if (action === 'create') syncAction = 'created'
    if (action === 'update') syncAction = 'updated'
    if (action === 'remove') syncAction = 'deleted'

    // Handle issue deletion
    if (syncAction === 'deleted') {
      // Find and delete the issue
      const issues = await c.env.PAYLOAD.find({
        collection: 'issues',
        where: {
          'linearData.id': { equals: data.id },
        },
        limit: 1,
      })

      if (issues.docs && issues.docs.length > 0) {
        await c.env.PAYLOAD.delete({
          collection: 'issues',
          id: issues.docs[0].id,
        })
        console.log(`Deleted issue ${data.identifier} (${data.id})`)
      }

      return c.json({ status: 'deleted', issue: data.identifier })
    }

    // Map Linear state to our status
    const stateMapping: Record<string, string> = {
      'backlog': 'open',
      'unstarted': 'open',
      'started': 'in_progress',
      'completed': 'closed',
      'canceled': 'closed',
    }

    const status = stateMapping[data.state?.type] || 'open'

    // Find or create the issue
    const existingIssues = await c.env.PAYLOAD.find({
      collection: 'issues',
      where: {
        'linearData.id': { equals: data.id },
      },
      limit: 1,
    })

    const issueData = {
      title: data.title,
      body: data.description || '',
      state: status,
      labels: data.labels?.map((l: any) => l.name) || [],
      assignees: data.assignee ? [data.assignee.name] : [],
      linearData: {
        id: data.id,
        identifier: data.identifier,
        stateId: data.state?.id,
        stateName: data.state?.name,
        cycleId: data.cycle?.id,
        projectId: data.project?.id,
      },
      updatedAt: data.updatedAt,
    }

    if (existingIssues.docs && existingIssues.docs.length > 0) {
      // Update existing issue
      await c.env.PAYLOAD.update({
        collection: 'issues',
        id: existingIssues.docs[0].id,
        data: issueData,
      })
      console.log(`Updated issue ${data.identifier}`)
    } else {
      // Create new issue
      await c.env.PAYLOAD.create({
        collection: 'issues',
        data: {
          ...issueData,
          repo: integration.repo,
        },
      })
      console.log(`Created issue ${data.identifier}`)
    }

    return c.json({
      status: 'synced',
      action: syncAction,
      issue: data.identifier
    })

  } catch (error) {
    console.error('Error handling Linear issue webhook:', error)
    return c.json({
      error: 'Failed to process issue webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}

/**
 * Handle Linear Cycle webhooks
 */
async function handleCycleWebhook(
  c: any,
  action: string,
  data: any,
  organizationId: string
): Promise<Response> {
  try {
    // Find the Linear integration for this organization
    const integrations = await c.env.PAYLOAD.find({
      collection: 'linear-integrations',
      where: {
        'linearData.organizationId': { equals: organizationId },
        active: { equals: true },
      },
      limit: 1,
    })

    if (!integrations.docs || integrations.docs.length === 0) {
      console.warn(`No active Linear integration found for organization ${organizationId}`)
      return c.json({ status: 'ignored', reason: 'No active integration found' })
    }

    const integration = integrations.docs[0]

    // Handle cycle deletion
    if (action === 'remove') {
      const milestones = await c.env.PAYLOAD.find({
        collection: 'milestones',
        where: {
          'linearData.id': { equals: data.id },
        },
        limit: 1,
      })

      if (milestones.docs && milestones.docs.length > 0) {
        await c.env.PAYLOAD.delete({
          collection: 'milestones',
          id: milestones.docs[0].id,
        })
        console.log(`Deleted cycle/milestone ${data.number}`)
      }

      return c.json({ status: 'deleted', cycle: data.number })
    }

    // Find or create the milestone
    const existingMilestones = await c.env.PAYLOAD.find({
      collection: 'milestones',
      where: {
        'linearData.id': { equals: data.id },
      },
      limit: 1,
    })

    const milestoneData = {
      title: data.name,
      description: data.description || '',
      state: data.completedAt ? 'closed' : 'open',
      dueOn: data.endsAt,
      linearData: {
        id: data.id,
        number: data.number,
        startsAt: data.startsAt,
      },
      updatedAt: data.updatedAt,
    }

    if (existingMilestones.docs && existingMilestones.docs.length > 0) {
      await c.env.PAYLOAD.update({
        collection: 'milestones',
        id: existingMilestones.docs[0].id,
        data: milestoneData,
      })
      console.log(`Updated cycle/milestone ${data.number}`)
    } else {
      await c.env.PAYLOAD.create({
        collection: 'milestones',
        data: {
          ...milestoneData,
          repo: integration.repo,
        },
      })
      console.log(`Created cycle/milestone ${data.number}`)
    }

    return c.json({
      status: 'synced',
      action,
      cycle: data.number
    })

  } catch (error) {
    console.error('Error handling Linear cycle webhook:', error)
    return c.json({
      error: 'Failed to process cycle webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}

/**
 * Handle Linear Project webhooks
 */
async function handleProjectWebhook(
  c: any,
  action: string,
  data: any,
  organizationId: string
): Promise<Response> {
  try {
    console.log(`Linear project webhook: ${action} - ${data.name}`)

    // TODO: Implement project sync when project collection is added
    // For now, just acknowledge the webhook

    return c.json({
      status: 'acknowledged',
      action,
      project: data.name,
      message: 'Project webhooks are not yet fully implemented'
    })

  } catch (error) {
    console.error('Error handling Linear project webhook:', error)
    return c.json({
      error: 'Failed to process project webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}

export default linear
