/**
 * Linear API Routes
 * OAuth flow, workspace management, and sync endpoints
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import { authMiddleware, type AuthContext } from '../auth'
import type { Env } from '../types'
import {
  LinearClient,
  getLinearClient,
  storeLinearToken,
  syncLinearIssues,
  handleLinearWebhook,
  type LinearWebhookPayload,
} from '../integrations/linear'

const linear = new Hono<{ Bindings: Env }>()

// ============================================
// OAuth Flow
// ============================================

/**
 * Initiate Linear OAuth flow
 * GET /api/linear/connect
 */
linear.get('/connect', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext
  const redirectUri = c.req.query('redirect_uri') || 'https://todo.mdx.do/integrations/linear/callback'

  // Linear OAuth configuration (get from environment)
  const clientId = c.env.LINEAR_CLIENT_ID
  if (!clientId) {
    return c.json({ error: 'Linear integration not configured' }, 500)
  }

  // Store state to verify callback
  const state = crypto.randomUUID()
  await c.env.OAUTH_KV.put(`linear_oauth_state:${state}`, auth.userId, {
    expirationTtl: 600, // 10 minutes
  })

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'read,write', // Linear scopes
  })

  const authUrl = `https://linear.app/oauth/authorize?${params}`

  return c.json({
    authUrl,
    state,
  })
})

/**
 * Handle Linear OAuth callback
 * GET /api/linear/callback
 */
linear.get('/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    return c.json({ error: `OAuth error: ${error}` }, 400)
  }

  if (!code || !state) {
    return c.json({ error: 'Missing code or state parameter' }, 400)
  }

  // Verify state
  const userId = await c.env.OAUTH_KV.get(`linear_oauth_state:${state}`)
  if (!userId) {
    return c.json({ error: 'Invalid or expired state' }, 400)
  }

  // Delete used state
  await c.env.OAUTH_KV.delete(`linear_oauth_state:${state}`)

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: c.env.LINEAR_CLIENT_ID,
        client_secret: c.env.LINEAR_CLIENT_SECRET,
        code,
        redirect_uri: c.req.query('redirect_uri') || 'https://todo.mdx.do/integrations/linear/callback',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      return c.json({ error: `Token exchange failed: ${errorText}` }, 400)
    }

    const tokenData = await tokenResponse.json() as { access_token: string }
    const accessToken = tokenData.access_token

    // Store token in Vault
    await storeLinearToken(c.env, userId, accessToken)

    // Get user's Linear workspace info
    const client = new LinearClient(accessToken)
    const viewer = await client.getViewer()

    // Create or update Linear integration record in Payload
    const existing = await c.env.PAYLOAD.find({
      collection: 'linear-integrations',
      where: {
        and: [
          { user: { equals: userId } },
          { 'linearData.organizationId': { equals: viewer.viewer.organization.id } },
        ],
      },
      limit: 1,
    })

    const integrationData = {
      user: userId.toString(),
      linearData: {
        organizationId: viewer.viewer.organization.id,
        organizationName: viewer.viewer.organization.name,
        urlKey: viewer.viewer.organization.urlKey,
        userId: viewer.viewer.id,
        userEmail: viewer.viewer.email,
      },
      active: true,
    }

    let integrationId: string

    if (existing.docs && existing.docs.length > 0) {
      await c.env.PAYLOAD.update({
        collection: 'linear-integrations',
        id: existing.docs[0].id,
        data: integrationData,
      })
      integrationId = existing.docs[0].id
    } else {
      const created = await c.env.PAYLOAD.create({
        collection: 'linear-integrations',
        data: integrationData,
      })
      integrationId = created.id
    }

    return c.json({
      success: true,
      integration: {
        id: integrationId,
        organization: viewer.viewer.organization,
      },
    })
  } catch (error) {
    console.error('Linear OAuth error:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================================
// Workspace Management
// ============================================

/**
 * Get user's Linear workspaces
 * GET /api/linear/workspaces
 */
linear.get('/workspaces', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext

  try {
    const client = await getLinearClient(c.env, auth.userId)
    if (!client) {
      return c.json({ error: 'No Linear integration found. Please connect first.' }, 404)
    }

    const viewer = await client.getViewer()
    const teams = await client.getTeams()

    return c.json({
      organization: viewer.viewer.organization,
      teams,
    })
  } catch (error) {
    console.error('Error fetching workspaces:', error)
    return c.json({ error: String(error) }, 500)
  }
})

/**
 * Get Linear teams
 * GET /api/linear/teams
 */
linear.get('/teams', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext

  try {
    const client = await getLinearClient(c.env, auth.userId)
    if (!client) {
      return c.json({ error: 'No Linear integration found' }, 404)
    }

    const teams = await client.getTeams()
    return c.json({ teams })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// ============================================
// Sync
// ============================================

/**
 * Trigger manual sync from Linear
 * POST /api/linear/sync
 */
linear.post('/sync', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext
  const { repoId, teamId } = await c.req.json()

  if (!repoId) {
    return c.json({ error: 'repoId is required' }, 400)
  }

  try {
    // Verify user has access to this repo
    const repo = await c.env.PAYLOAD.findByID({
      collection: 'repos',
      id: repoId,
      depth: 1,
    })

    if (!repo) {
      return c.json({ error: 'Repo not found' }, 404)
    }

    // Check access (type-safe check)
    const installation = repo.installation as any
    const hasAccess = installation?.users?.some((u: any) =>
      u.workosUserId === auth.userId || u.id === auth.userId
    )

    if (!hasAccess) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Perform sync
    const result = await syncLinearIssues(c.env, auth.userId, repoId, teamId)

    return c.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return c.json({ error: String(error) }, 500)
  }
})

/**
 * Get sync status for a repo
 * GET /api/linear/sync/:repoId
 */
linear.get('/sync/:repoId', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext
  const repoId = c.req.param('repoId')

  try {
    // Get integration for this repo
    const integrations = await c.env.PAYLOAD.find({
      collection: 'linear-integrations',
      where: {
        and: [
          { user: { equals: auth.userId } },
          { repo: { equals: repoId } },
        ],
      },
      limit: 1,
    })

    if (!integrations.docs || integrations.docs.length === 0) {
      return c.json({ connected: false })
    }

    const integration = integrations.docs[0]

    return c.json({
      connected: true,
      integration: {
        id: integration.id,
        organization: integration.linearData?.organizationName,
        lastSync: integration.lastSyncAt,
        active: integration.active,
      },
    })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

// ============================================
// Webhooks
// ============================================

/**
 * Handle Linear webhook
 * POST /linear/webhook
 */
linear.post('/webhook', async (c) => {
  try {
    const signature = c.req.header('Linear-Signature')
    const payload = await c.req.json<LinearWebhookPayload>()

    // TODO: Verify webhook signature
    // const body = await c.req.text()
    // const isValid = verifyLinearSignature(body, signature, c.env.LINEAR_WEBHOOK_SECRET)
    // if (!isValid) {
    //   return c.json({ error: 'Invalid signature' }, 401)
    // }

    console.log('Linear webhook received:', payload.type, payload.action)

    // Find integration by organizationId
    const integrations = await c.env.PAYLOAD.find({
      collection: 'linear-integrations',
      where: {
        'linearData.organizationId': { equals: payload.organizationId },
      },
      limit: 1,
    })

    if (!integrations.docs || integrations.docs.length === 0) {
      console.log('No integration found for organization:', payload.organizationId)
      return c.json({ status: 'ignored', reason: 'no integration found' })
    }

    const integration = integrations.docs[0]

    // Handle the webhook
    const result = await handleLinearWebhook(c.env, payload, integration.id)

    return c.json(result)
  } catch (error) {
    console.error('Linear webhook error:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================================
// Integration Management
// ============================================

/**
 * List user's Linear integrations
 * GET /api/linear/integrations
 */
linear.get('/integrations', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext

  try {
    const integrations = await c.env.PAYLOAD.find({
      collection: 'linear-integrations',
      where: {
        user: { equals: auth.userId },
      },
      depth: 1,
    })

    return c.json({
      integrations: integrations.docs || [],
    })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

/**
 * Disconnect Linear integration
 * DELETE /api/linear/integrations/:id
 */
linear.delete('/integrations/:id', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext
  const integrationId = c.req.param('id')

  try {
    const integration = await c.env.PAYLOAD.findByID({
      collection: 'linear-integrations',
      id: integrationId,
    })

    if (!integration) {
      return c.json({ error: 'Integration not found' }, 404)
    }

    // Verify ownership
    if (integration.user !== auth.userId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Delete integration
    await c.env.PAYLOAD.delete({
      collection: 'linear-integrations',
      id: integrationId,
    })

    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: String(error) }, 500)
  }
})

export { linear }
