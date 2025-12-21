/**
 * TODO.mdx Worker
 * GitHub App backend for syncing issues, milestones, and projects
 * Using Payload Local API for data access
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { voice } from './voice'
import { mcp, TodoMCP } from './mcp'
import { api } from './api'
import sandbox from './api/sandbox'
import terminal from './api/terminal'
import stdio from './api/stdio'
import auth from './api/auth'
import workflows from './api/workflows'
import { authMiddleware, type AuthContext } from './auth'
import { validateWorkosJwt, mightBeWorkosJwt } from './mcp/workos-jwt'
import { getSessionFromRequest } from './auth/session'
import { getPayloadClient } from './payload'
import { handlePRApproval } from './workflows/webhook-handlers'
import type { Env } from './types'
import type {
  InstallationEvent,
  IssuesEvent,
  MilestoneEvent,
  PushEvent,
  ProjectsV2Event,
  ProjectsV2ItemEvent,
  PullRequestEvent,
  PullRequestReviewEvent,
} from './types/github'

export { RepoDO } from './do/repo'
export { ProjectDO } from './do/project'
export { PRDO } from './do/pr'
export { SessionDO } from './do/session'
export { ClaudeSandbox } from './sandbox'
export { DevelopWorkflow } from './workflows/develop'
export { EmbedWorkflow, BulkEmbedWorkflow } from './workflows/embed'
export { TodoMCP }

// Re-export Env type for external use
export type { Env }

const app = new Hono<{ Bindings: Env }>()

// CORS for API access
app.use('/api/*', cors({
  origin: ['https://todo.mdx.do', 'https://priya.do', 'http://localhost:3000'],
  credentials: true,
}))

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'todo.mdx',
    version: '0.1.0',
    description: 'GitHub App for syncing TODO.md, issues, and roadmaps',
  })
})

// ============================================
// Voice API routes (STT/TTS/Chat)
// ============================================

app.route('/api/voice', voice)

// ============================================
// Unified Auth routes (login/logout/callback)
// No auth required - these establish the session
// ============================================

app.route('/api/auth', auth)

// ============================================
// Stdio WebSocket Proxy (new binary protocol)
// Supports both CLI (sbx-stdio) and browser (xterm.js)
// Uses unified session cookie or token auth
// ============================================

app.route('/api/stdio', stdio)

// ============================================
// GitHub webhook (must be before protected API routes)
// ============================================

app.post('/api/webhooks/github', async (c) => {
  const t0 = Date.now()
  const signature = c.req.header('x-hub-signature-256')
  const event = c.req.header('x-github-event')
  const deliveryId = c.req.header('x-github-delivery')

  console.log(`[Webhook] Received ${event} (${deliveryId}) at t=0ms`)

  // Verify webhook signature
  const body = await c.req.text()
  console.log(`[Webhook] Body read: ${Date.now() - t0}ms (${body.length} bytes)`)

  const isValid = await verifyGitHubSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET)
  console.log(`[Webhook] Signature verified: ${Date.now() - t0}ms (valid=${isValid})`)

  if (!isValid) {
    console.warn(`[Webhook] Invalid signature for ${deliveryId}`)
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const payload = JSON.parse(body)
  console.log(`[Webhook] Parsed: ${Date.now() - t0}ms, dispatching ${event}`)

  switch (event) {
    case 'installation':
      return handleInstallation(c, payload)
    case 'issues':
      return handleIssues(c, payload)
    case 'milestone':
      return handleMilestone(c, payload)
    case 'push':
      return handlePush(c, payload)
    case 'projects_v2':
      return handleProject(c, payload)
    case 'projects_v2_item':
      return handleProjectItem(c, payload)
    case 'pull_request':
      return handlePullRequest(c, payload)
    case 'pull_request_review':
      return handlePullRequestReview(c, payload)
    default:
      return c.json({ status: 'ignored', event })
  }
})

// ============================================
// Widget Pages (HTML, embeddable)
// Require auth via session cookie
// ============================================

// Terminal widget - serves terminal.html with auth
app.get('/terminal', async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY)

  if (!session) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(c.req.url)
    return c.redirect(`/api/auth/login?return=${returnUrl}`)
  }

  // Serve terminal.html from assets
  try {
    const htmlRequest = new Request(new URL('/terminal.html', c.req.url).toString())
    return await c.env.ASSETS.fetch(htmlRequest)
  } catch (e) {
    return c.text('Error loading terminal', 500)
  }
})

// Claude Code widget - serves code.html with auth
app.get('/code/:org/:repo', async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY)

  if (!session) {
    const returnUrl = encodeURIComponent(c.req.url)
    return c.redirect(`/api/auth/login?return=${returnUrl}`)
  }

  // Serve code.html from assets (preserves URL path for parsing)
  try {
    const htmlRequest = new Request(new URL('/code.html', c.req.url).toString())
    return await c.env.ASSETS.fetch(htmlRequest)
  } catch (e) {
    return c.text('Error loading Claude Code', 500)
  }
})

// Claude Code widget with branch/ref
app.get('/code/:org/:repo/:ref', async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY)

  if (!session) {
    const returnUrl = encodeURIComponent(c.req.url)
    return c.redirect(`/api/auth/login?return=${returnUrl}`)
  }

  // Serve code.html from assets (preserves URL path for parsing)
  try {
    const htmlRequest = new Request(new URL('/code.html', c.req.url).toString())
    return await c.env.ASSETS.fetch(htmlRequest)
  } catch (e) {
    return c.text('Error loading Claude Code', 500)
  }
})

// ============================================
// Protected API routes (repos, issues, milestones, search)
// ============================================

app.route('/api', api)

// ============================================
// MCP Server with OAuth 2.1 (handled by OAuthProvider)
// ============================================

// Forward .well-known requests to OAuthProvider (it handles these automatically)
app.all('/.well-known/*', async (c) => {
  return mcp.fetch(c.req.raw, c.env, c.executionCtx)
})

// Root-level OAuth endpoints (OAuthProvider handles these)
app.all('/authorize', async (c) => mcp.fetch(c.req.raw, c.env, c.executionCtx))
app.all('/token', async (c) => mcp.fetch(c.req.raw, c.env, c.executionCtx))
app.all('/register', async (c) => mcp.fetch(c.req.raw, c.env, c.executionCtx))
app.all('/register/*', async (c) => mcp.fetch(c.req.raw, c.env, c.executionCtx))
app.all('/callback', async (c) => mcp.fetch(c.req.raw, c.env, c.executionCtx))
app.all('/sse', async (c) => mcp.fetch(c.req.raw, c.env, c.executionCtx))

// Forward /mcp requests to OAuthProvider (pass as-is, OAuthProvider routes by apiRoute)
// With fallback support for WorkOS JWTs (from oauth.do)
app.all('/mcp/*', async (c) => {
  // Check if the request has a WorkOS JWT that we can validate directly
  const authHeader = c.req.header('Authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)

    if (mightBeWorkosJwt(token)) {
      const props = await validateWorkosJwt(token, c.env)

      if (props) {
        // WorkOS JWT validated - handle MCP endpoints directly

        // Build a synthetic authenticated request
        // The MCP agent needs env, props, and the request
        const url = new URL(c.req.url)
        const path = url.pathname.replace('/mcp', '')

        // Handle different MCP endpoints
        if (path === '/info' || path === '') {
          return c.json({
            name: 'todo.mdx',
            version: '0.1.0',
            capabilities: {
              tools: true,
              resources: true,
            },
          })
        }

        if (path === '/tools') {
          // Return available tools
          const tools = [
            { name: 'search', description: 'Search issues across all repositories', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } },
            { name: 'fetch', description: 'Fetch a resource by URI', inputSchema: { type: 'object', properties: { uri: { type: 'string' } }, required: ['uri'] } },
            { name: 'roadmap', description: 'Generate roadmap markdown', inputSchema: { type: 'object', properties: { repo: { type: 'string' } } } },
            { name: 'do', description: 'Execute JavaScript code in a sandboxed environment', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, code: { type: 'string' } }, required: ['repo', 'code'] } },
          ]
          return c.json({ tools })
        }

        if (path === '/resources') {
          // Return user's repos as resources
          try {
            const workosUserId = props.user?.id
            if (workosUserId) {
              const payload = await getPayloadClient(c.env)
              // Get user's repos
              const userResult = await payload.find({
                collection: 'users',
                where: { workosUserId: { equals: workosUserId } },
                limit: 1,
                overrideAccess: true,
              })

              if (userResult.docs?.length) {
                const payloadUserId = userResult.docs[0].id
                const installationsResult = await payload.find({
                  collection: 'installations',
                  where: { 'users.id': { equals: payloadUserId } },
                  limit: 100,
                  overrideAccess: true,
                })

                if (installationsResult.docs?.length) {
                  const installationIds = installationsResult.docs.map((i) => i.id)
                  const reposResult = await payload.find({
                    collection: 'repos',
                    where: { installation: { in: installationIds } },
                    limit: 100,
                    overrideAccess: true,
                  })

                  const resources = (reposResult.docs || []).map((repo) => ({
                    uri: `todo://${repo.fullName}/issues`,
                    name: repo.fullName,
                    description: `Issues for ${repo.fullName}`,
                  }))

                  return c.json({ resources })
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch resources:', e)
          }
          return c.json({ resources: [] })
        }

        if (path === '/tools/call' && c.req.method === 'POST') {
          // Handle tool calls via the TodoMCP server
          try {
            const body = await c.req.json()
            const { name, arguments: args } = body

            // Import and use the tool handlers directly
            const { handleMcpToolCall } = await import('./mcp/tool-handler')
            const result = await handleMcpToolCall(name, args, props, c.env, c.executionCtx)
            return c.json(result)
          } catch (e) {
            const error = e as Error
            return c.json({
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            })
          }
        }

        // Unknown path, fall through to OAuthProvider
      }
    }
  }

  // Fall back to OAuthProvider for standard OAuth 2.1 flow
  return mcp.fetch(c.req.raw, c.env, c.executionCtx)
})

app.all('/mcp', async (c) => {
  return mcp.fetch(c.req.raw, c.env, c.executionCtx)
})

// ============================================
// Claude Sandbox API routes
// ============================================

app.route('/api/sandbox', sandbox)

// ============================================
// Workflows API routes (trigger/manage DevelopWorkflow)
// ============================================

app.route('/api/workflows', workflows)

// ============================================
// Terminal WebSocket routes
// ============================================

app.route('/terminal', terminal)

// ============================================
// Auth routes (via OAuth 2.1 / WorkOS API keys)
// ============================================

// Get current user (requires auth)
app.get('/api/me', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext
  const payload = await getPayloadClient(c.env)

  // Lookup user from Payload based on auth context
  const users = await payload.find({
    collection: 'users',
    where: {
      or: [
        { workosUserId: { equals: auth.userId } },
        { email: { equals: auth.email } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (!users.docs?.length) {
    return c.json({ user: null, auth }, 200)
  }

  return c.json({ user: users.docs[0], auth })
})

// ============================================
// GitHub App installation callback
// Links installation to authenticated user
// ============================================

app.get('/github/callback', async (c) => {
  const installationId = c.req.query('installation_id')
  const setupAction = c.req.query('setup_action')
  const state = c.req.query('state') // Contains user ID from OAuth flow

  if (setupAction === 'install' && installationId) {
    // If we have state with user ID, link installation to user
    if (state) {
      try {
        const userId = state // The state parameter contains the user ID
        const payload = await getPayloadClient(c.env)

        // Find the installation and add the user
        const installations = await payload.find({
          collection: 'installations',
          where: { installationId: { equals: parseInt(installationId) } },
          limit: 1,
          overrideAccess: true,
        })

        if (installations.docs?.length > 0) {
          const installation = installations.docs[0]
          const existingUsers = (installation.users as Array<{ id: string }> || []).map(u => u.id)
          if (!existingUsers.includes(userId)) {
            await payload.update({
              collection: 'installations',
              id: installation.id,
              data: {
                users: [...existingUsers, userId],
              },
              overrideAccess: true,
            })
          }
        }
      } catch (error) {
        console.error('Failed to link installation to user:', error)
      }
    }

    return c.redirect('https://todo.mdx.do/dashboard?installed=true')
  }

  return c.redirect('https://todo.mdx.do')
})

// ============================================
// GitHub webhook signature verification
// ============================================

async function verifyGitHubSignature(
  body: string,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false
  }

  // GitHub signature format: "sha256=<hex>"
  if (!signature.startsWith('sha256=')) {
    return false
  }

  const signatureHex = signature.slice(7) // Remove "sha256=" prefix

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Convert hex signature to bytes
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    )

    // Use timing-safe comparison via crypto.subtle.verify
    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes.buffer,
      encoder.encode(body)
    )
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

// Legacy webhook route (keep for backwards compatibility)
app.post('/github/webhook', async (c) => {
  const signature = c.req.header('x-hub-signature-256')
  const event = c.req.header('x-github-event')
  const deliveryId = c.req.header('x-github-delivery')

  const body = await c.req.text()
  const isValid = await verifyGitHubSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET)

  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const payload = JSON.parse(body)
  console.log(`Received GitHub webhook (legacy route): ${event} (${deliveryId})`)

  switch (event) {
    case 'installation':
      return handleInstallation(c, payload)
    case 'issues':
      return handleIssues(c, payload)
    case 'milestone':
      return handleMilestone(c, payload)
    case 'push':
      return handlePush(c, payload)
    case 'projects_v2':
      return handleProject(c, payload)
    case 'projects_v2_item':
      return handleProjectItem(c, payload)
    case 'pull_request':
      return handlePullRequest(c, payload)
    case 'pull_request_review':
      return handlePullRequestReview(c, payload)
    default:
      return c.json({ status: 'ignored', event })
  }
})

// Installation webhook
async function handleInstallation(
  c: Context<{ Bindings: Env }>,
  webhookPayload: InstallationEvent
): Promise<Response> {
  const t0 = Date.now()
  const timing: Record<string, number> = {}

  console.log(`[Installation] action=${webhookPayload.action} account=${webhookPayload.installation?.account?.login}`)

  // Get Payload instance (Local API with overrideAccess)
  const payload = await getPayloadClient(c.env)

  if (webhookPayload.action === 'created') {
    try {
      const installation = webhookPayload.installation
      timing.setup = Date.now() - t0

      const installData = {
        installationId: installation.id,
        accountType: installation.account.type as 'User' | 'Organization',
        accountId: installation.account.id,
        accountLogin: installation.account.login,
        accountAvatarUrl: installation.account.avatar_url,
        permissions: installation.permissions,
        events: installation.events,
        repositorySelection: installation.repository_selection as 'all' | 'selected',
      }

      // Try to find existing installation first
      const t1 = Date.now()
      const existing = await payload.find({
        collection: 'installations',
        where: { installationId: { equals: installation.id } },
        limit: 1,
        overrideAccess: true,
      })
      timing.findExisting = Date.now() - t1

      let installResult
      const t2 = Date.now()
      if (existing.docs?.length > 0) {
        // Update existing installation
        installResult = await payload.update({
          collection: 'installations',
          id: existing.docs[0].id,
          data: installData,
          overrideAccess: true,
        })
        timing.installUpdate = Date.now() - t2
        console.log(`[Installation] Updated installation id=${installResult.id} (${timing.installUpdate}ms)`)
      } else {
        // Create new installation
        installResult = await payload.create({
          collection: 'installations',
          data: installData,
          overrideAccess: true,
        })
        timing.installCreate = Date.now() - t2
        console.log(`[Installation] Created new installation id=${installResult.id} (${timing.installCreate}ms)`)
      }

      // Upsert repos via Payload Local API
      const repos = webhookPayload.repositories || []
      if (repos.length > 0) {
        const t3 = Date.now()
        let created = 0, updated = 0
        for (const repo of repos) {
          const existingRepo = await payload.find({
            collection: 'repos',
            where: { githubId: { equals: repo.id } },
            limit: 1,
            overrideAccess: true,
          })
          const repoData = {
            githubId: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            owner: repo.full_name.split('/')[0],
            private: repo.private,
            installation: installResult.id,
          }
          if (existingRepo.docs?.length > 0) {
            // Update existing repo
            await payload.update({
              collection: 'repos',
              id: existingRepo.docs[0].id,
              data: repoData,
              overrideAccess: true,
            })
            updated++
          } else {
            await payload.create({
              collection: 'repos',
              data: repoData,
              overrideAccess: true,
            })
            created++
          }
        }
        timing.reposSync = Date.now() - t3
        console.log(`[Installation] Synced ${repos.length} repos (${created} created, ${updated} updated) (${timing.reposSync}ms)`)
      }

      timing.total = Date.now() - t0
      console.log(`[Installation] Complete: ${JSON.stringify(timing)}`)
      return c.json({ status: 'installed', installationId: installResult.id, repos: repos.length, timing })
    } catch (error) {
      const err = error as Error
      timing.total = Date.now() - t0
      console.error(`[Installation] Error after ${timing.total}ms:`, err.message, err.stack)
      return c.json({ error: 'Failed to process installation', message: err.message, timing }, 500)
    }
  }

  if (webhookPayload.action === 'deleted') {
    try {
      // Find and delete installation via Payload Local API
      const installations = await payload.find({
        collection: 'installations',
        where: { installationId: { equals: webhookPayload.installation.id } },
        limit: 1,
        overrideAccess: true,
      })

      if (installations.docs?.length > 0) {
        await payload.delete({
          collection: 'installations',
          id: installations.docs[0].id,
          overrideAccess: true,
        })
      }

      return c.json({ status: 'uninstalled' })
    } catch (error) {
      const err = error as Error
      console.error(`[Installation] Delete error:`, err.message)
      return c.json({ error: 'Failed to delete installation', message: err.message }, 500)
    }
  }

  return c.json({ status: 'ok' })
}

// Issues webhook
async function handleIssues(
  c: Context<{ Bindings: Env }>,
  payload: IssuesEvent
): Promise<Response> {
  const repo = payload.repository
  const issue = payload.issue
  const action = payload.action
  const installationId = payload.installation?.id

  // Handle delete - remove from Vectorize
  if (action === 'deleted') {
    try {
      await c.env.VECTORIZE.deleteByIds([
        `issue:${repo.full_name}:${issue.number}`
      ])
    } catch (e) {
      console.error('Failed to delete vector:', e)
    }
    return c.json({ status: 'deleted', action })
  }

  const doId = c.env.REPO.idFromName(repo.full_name)
  const stub = c.env.REPO.get(doId)

  // First, ensure repo context is set (needed for bidirectional sync)
  if (installationId) {
    await stub.fetch(new Request('http://do/context', {
      method: 'POST',
      body: JSON.stringify({
        repoFullName: repo.full_name,
        installationId,
      }),
      headers: { 'Content-Type': 'application/json' },
    }))
  }

  // Call the webhook/github endpoint with the correct payload format
  const response = await stub.fetch(new Request('http://do/webhook/github', {
    method: 'POST',
    body: JSON.stringify({
      action,
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels || [],
        assignee: issue.assignee,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
      },
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()

  // Trigger embedding workflow for create/update events
  if (['opened', 'edited', 'closed', 'reopened'].includes(action)) {
    try {
      await c.env.EMBED_WORKFLOW.create({
        id: `embed-issue-${repo.full_name}-${issue.number}-${Date.now()}`,
        params: {
          type: 'issue' as const,
          id: `issue:${repo.full_name}:${issue.number}`,
          repo: repo.full_name,
          title: issue.title,
          body: issue.body || '',
          status: issue.state,
          url: issue.html_url,
          labels: issue.labels?.map((l) => l.name),
        },
      })
      console.log(`Dispatched embedding workflow for issue ${issue.number}`)
    } catch (e) {
      console.error('Failed to dispatch embedding workflow:', e)
    }
  }

  return c.json({ status: 'synced', action, result })
}

// Milestone webhook
async function handleMilestone(
  c: Context<{ Bindings: Env }>,
  payload: MilestoneEvent
): Promise<Response> {
  const repo = payload.repository
  const milestone = payload.milestone
  const action = payload.action

  // Handle delete - remove from Vectorize
  if (action === 'deleted') {
    try {
      await c.env.VECTORIZE.deleteByIds([
        `milestone:${repo.full_name}:${milestone.number}`
      ])
    } catch (e) {
      console.error('Failed to delete milestone vector:', e)
    }
    return c.json({ status: 'deleted', action })
  }

  const doId = c.env.REPO.idFromName(repo.full_name)
  const stub = c.env.REPO.get(doId)

  const response = await stub.fetch(new Request('http://do/milestones/sync', {
    method: 'POST',
    body: JSON.stringify({
      source: 'github',
      milestones: [{
        githubId: milestone.id,
        githubNumber: milestone.number,
        title: milestone.title,
        description: milestone.description,
        state: milestone.state,
        dueOn: milestone.due_on,
        updatedAt: milestone.updated_at,
      }],
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()

  // Trigger embedding workflow for create/update events
  if (['created', 'edited', 'closed', 'opened'].includes(action)) {
    try {
      await c.env.EMBED_WORKFLOW.create({
        id: `embed-milestone-${repo.full_name}-${milestone.number}-${Date.now()}`,
        params: {
          type: 'milestone' as const,
          id: `milestone:${repo.full_name}:${milestone.number}`,
          repo: repo.full_name,
          title: milestone.title,
          body: milestone.description || '',
          status: milestone.state,
          url: milestone.html_url,
        },
      })
      console.log(`Dispatched embedding workflow for milestone ${milestone.number}`)
    } catch (e) {
      console.error('Failed to dispatch embedding workflow:', e)
    }
  }

  return c.json({ status: 'synced', action, result })
}

// Push webhook (for .beads/, .todo/, TODO.md file changes)
async function handlePush(
  c: Context<{ Bindings: Env }>,
  payload: PushEvent
): Promise<Response> {
  const repo = payload.repository
  const installationId = payload.installation?.id

  if (!installationId) {
    return c.json({ status: 'ignored', reason: 'no installation id' })
  }

  const changedFiles: string[] = []
  let hasBeadsChanges = false

  for (const commit of payload.commits || []) {
    const allFiles = [
      ...(commit.added || []),
      ...(commit.modified || []),
      ...(commit.removed || []),
    ]
    for (const file of allFiles) {
      // Track beads changes
      if (file.startsWith('.beads/')) {
        changedFiles.push(file)
        hasBeadsChanges = true
      }
      // Track todo/roadmap changes
      if (file.startsWith('.todo/') || file === 'TODO.md' || file === 'TODO.mdx') {
        changedFiles.push(file)
      }
      if (file.startsWith('.roadmap/') || file === 'ROADMAP.md' || file === 'ROADMAP.mdx') {
        changedFiles.push(file)
      }
    }
  }

  if (changedFiles.length === 0) {
    return c.json({ status: 'ignored', reason: 'no tracked files changed' })
  }

  const doId = c.env.REPO.idFromName(repo.full_name)
  const stub = c.env.REPO.get(doId)

  // If beads files changed, trigger sync to GitHub
  if (hasBeadsChanges) {
    const headCommit = payload.head_commit?.id || payload.after
    await stub.fetch(
      new Request('http://do/webhook/beads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commit: headCommit,
          files: changedFiles.filter((f) => f.startsWith('.beads/')),
          repoFullName: repo.full_name,
          installationId,
        }),
      })
    )
  }

  return c.json({ status: 'synced', files: changedFiles })
}

// GitHub Projects v2 webhook (project-level events)
async function handleProject(
  c: Context<{ Bindings: Env }>,
  payload: ProjectsV2Event
): Promise<Response> {
  const project = payload.projects_v2

  if (!project?.node_id) {
    return c.json({ status: 'ignored', reason: 'no project node_id' })
  }

  const doId = c.env.PROJECT.idFromName(project.node_id)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/project/sync', {
    method: 'POST',
    body: JSON.stringify({
      action: payload.action,
      project: {
        nodeId: project.node_id,
        number: project.number,
        title: project.title,
        shortDescription: project.short_description,
        public: project.public,
        closed: project.closed,
        owner: payload.organization?.login || payload.sender?.login,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      },
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()
  return c.json({ status: 'synced', action: payload.action, result })
}

// GitHub Projects v2 item webhook
async function handleProjectItem(
  c: Context<{ Bindings: Env }>,
  payload: ProjectsV2ItemEvent
): Promise<Response> {
  const projectNodeId = payload.projects_v2_item?.project_node_id

  if (!projectNodeId) {
    return c.json({ status: 'ignored', reason: 'no project id' })
  }

  const doId = c.env.PROJECT.idFromName(projectNodeId)
  const stub = c.env.PROJECT.get(doId)

  // Extract field values from the payload if present
  const fieldValues: Record<string, unknown> = {}

  if (payload.changes?.field_value) {
    const change = payload.changes.field_value
    if (change.field_type && change.field_name) {
      fieldValues[change.field_name] = {
        type: change.field_type,
        from: change.from,
        to: change.to,
      }
    }
  }

  const response = await stub.fetch(new Request('http://do/items/sync', {
    method: 'POST',
    body: JSON.stringify({
      action: payload.action,
      item: {
        nodeId: payload.projects_v2_item.node_id,
        id: payload.projects_v2_item.id,
        contentNodeId: payload.projects_v2_item.content_node_id,
        contentType: payload.projects_v2_item.content_type,
        creator: payload.projects_v2_item.creator?.login,
        createdAt: payload.projects_v2_item.created_at,
        updatedAt: payload.projects_v2_item.updated_at,
        archivedAt: payload.projects_v2_item.archived_at,
        isArchived: payload.projects_v2_item.is_archived,
      },
      fieldValues,
      changes: payload.changes,
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()
  return c.json({ status: 'synced', result })
}

// Pull Request webhook
async function handlePullRequest(
  c: Context<{ Bindings: Env }>,
  payload: PullRequestEvent
): Promise<Response> {
  const repo = payload.repository
  const pr = payload.pull_request
  const action = payload.action
  const installationId = payload.installation?.id

  if (!installationId) {
    return c.json({ status: 'ignored', reason: 'no installation id' })
  }

  // Get PRDO instance using naming convention: {owner}/{repo}#{pr_number}
  const doId = c.env.PRDO.idFromName(`${repo.full_name}#${pr.number}`)
  const stub = c.env.PRDO.get(doId)

  // Map webhook action to PRDO event
  switch (action) {
    case 'opened':
    case 'reopened':
      // Send PR_OPENED event
      return stub.fetch(new Request('http://do/event', {
        method: 'POST',
        body: JSON.stringify({
          type: 'PR_OPENED',
          prNumber: pr.number,
          repoFullName: repo.full_name,
          author: pr.user.login,
          base: pr.base.ref,
          head: pr.head.sha,
          installationId,
        }),
        headers: { 'Content-Type': 'application/json' },
      }))

    case 'synchronize':
      // Send FIX_COMPLETE event (new commits pushed)
      // Note: PullRequestSynchronizeEvent doesn't have commits field
      return stub.fetch(new Request('http://do/event', {
        method: 'POST',
        body: JSON.stringify({
          type: 'FIX_COMPLETE',
          commits: [],
        }),
        headers: { 'Content-Type': 'application/json' },
      }))

    case 'closed':
      // Send CLOSE event with merged flag
      return stub.fetch(new Request('http://do/event', {
        method: 'POST',
        body: JSON.stringify({
          type: 'CLOSE',
          merged: pr.merged || false,
        }),
        headers: { 'Content-Type': 'application/json' },
      }))

    default:
      return c.json({ status: 'ignored', action })
  }
}

// Pull Request Review webhook
async function handlePullRequestReview(
  c: Context<{ Bindings: Env }>,
  payload: PullRequestReviewEvent
): Promise<Response> {
  const repo = payload.repository
  const pr = payload.pull_request
  const review = payload.review
  const action = payload.action

  // Only handle submitted reviews
  if (action !== 'submitted') {
    return c.json({ status: 'ignored', reason: 'action not submitted' })
  }

  // Only handle approved or changes_requested states
  const reviewState = review.state.toLowerCase()
  if (reviewState !== 'approved' && reviewState !== 'changes_requested') {
    return c.json({ status: 'ignored', reason: `review state: ${reviewState}` })
  }

  // Get PRDO instance using naming convention: {owner}/{repo}#{pr_number}
  const doId = c.env.PRDO.idFromName(`${repo.full_name}#${pr.number}`)
  const stub = c.env.PRDO.get(doId)

  // Send REVIEW_COMPLETE event to PRDO
  const prdoResponse = await stub.fetch(new Request('http://do/event', {
    method: 'POST',
    body: JSON.stringify({
      type: 'REVIEW_COMPLETE',
      reviewer: review.user.login,
      decision: reviewState,
      body: review.body || '',
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  // If PR is approved, also notify any waiting DevelopWorkflow
  if (reviewState === 'approved') {
    try {
      await handlePRApproval(
        c.env,
        {
          number: pr.number,
          title: pr.title,
          body: pr.body || '',
          branch: pr.head.ref,
          url: pr.html_url,
          state: pr.state as 'open' | 'closed',
        },
        review.user.login
      )
    } catch (err) {
      console.error('[Webhook] Failed to notify workflow of PR approval:', err)
      // Don't fail the webhook if workflow notification fails
    }
  }

  return prdoResponse
}

// ============================================
// Protected API routes (require auth)
// ============================================

// Get user's installations
app.get('/api/user/installations', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext
  const payload = await getPayloadClient(c.env)

  // Get installations where this user is in the users array
  const result = await payload.find({
    collection: 'installations',
    where: {
      'users.workosUserId': { equals: auth.userId },
    },
    depth: 1,
    overrideAccess: true,
  })

  return c.json(result.docs || [])
})

// Get user's repos
app.get('/api/user/repos', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext
  const payload = await getPayloadClient(c.env)

  // Get repos where user has access via installation
  const result = await payload.find({
    collection: 'repos',
    where: {
      'installation.users.workosUserId': { equals: auth.userId },
    },
    depth: 1,
    overrideAccess: true,
  })

  return c.json(result.docs || [])
})

// API: List all installations (admin - requires auth)
app.get('/api/installations', authMiddleware, async (c) => {
  const payload = await getPayloadClient(c.env)
  const result = await payload.find({
    collection: 'installations',
    limit: 100,
    overrideAccess: true,
  })
  return c.json(result.docs || [])
})

// API: List repos for an installation (requires auth)
app.get('/api/installations/:id/repos', authMiddleware, async (c) => {
  const installationId = c.req.param('id')
  const payload = await getPayloadClient(c.env)
  const result = await payload.find({
    collection: 'repos',
    where: {
      installation: { equals: installationId },
    },
    overrideAccess: true,
  })
  return c.json(result.docs || [])
})

// API: Get repo sync status (requires auth)
app.get('/api/repos/:owner/:name/status', authMiddleware, async (c) => {
  const owner = c.req.param('owner')
  const name = c.req.param('name')
  const fullName = `${owner}/${name}`

  const doId = c.env.REPO.idFromName(fullName)
  const stub = c.env.REPO.get(doId)

  const response = await stub.fetch(new Request('http://do/status'))
  return response
})

// API: Trigger manual sync for a repo
app.post('/api/repos/:owner/:name/sync', authMiddleware, async (c) => {
  const owner = c.req.param('owner')
  const name = c.req.param('name')
  const fullName = `${owner}/${name}`

  // TODO: Fetch all issues, milestones, and files from GitHub and sync
  return c.json({ status: 'queued', repo: fullName })
})

// ============================================
// Project API routes
// ============================================

// API: Get project info and status
app.get('/api/projects/:nodeId', authMiddleware, async (c) => {
  const nodeId = c.req.param('nodeId')

  const doId = c.env.PROJECT.idFromName(nodeId)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/status'))
  return response
})

// API: Get project items
app.get('/api/projects/:nodeId/items', authMiddleware, async (c) => {
  const nodeId = c.req.param('nodeId')

  const doId = c.env.PROJECT.idFromName(nodeId)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/items'))
  return response
})

// API: Get project fields
app.get('/api/projects/:nodeId/fields', authMiddleware, async (c) => {
  const nodeId = c.req.param('nodeId')

  const doId = c.env.PROJECT.idFromName(nodeId)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/fields'))
  return response
})

// API: Trigger manual sync for a project
app.post('/api/projects/:nodeId/sync', authMiddleware, async (c) => {
  const nodeId = c.req.param('nodeId')

  const doId = c.env.PROJECT.idFromName(nodeId)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/sync', {
    method: 'POST',
  }))
  return response
})

// API: Link a repo to a project
app.post('/api/projects/:nodeId/repos', authMiddleware, async (c) => {
  const nodeId = c.req.param('nodeId')
  const body = await c.req.json()

  const doId = c.env.PROJECT.idFromName(nodeId)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/repos', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

// API: Get milestone mappings for a project
app.get('/api/projects/:nodeId/milestones', authMiddleware, async (c) => {
  const nodeId = c.req.param('nodeId')

  const doId = c.env.PROJECT.idFromName(nodeId)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/milestones'))
  return response
})

// ============================================
// Static file serving (fallback)
// Serves HTML, CSS, JS from public/ directory
// ============================================

// Serve static files from assets binding
app.get('*', async (c) => {
  // Only serve files with extensions or known paths
  const url = new URL(c.req.url)
  const path = url.pathname

  // Only serve static files (has extension or is a known static file)
  if (path.includes('.') || path === '/terminal.html' || path === '/code.html') {
    try {
      // Forward to ASSETS binding
      const assetResponse = await c.env.ASSETS.fetch(c.req.raw)

      // If found, return it
      if (assetResponse.status !== 404) {
        return assetResponse
      }
    } catch (e) {
      // Assets binding might not be available in dev
      console.warn('Assets fetch failed:', e)
    }
  }

  // If not a static file or not found, return 404
  return c.json({ error: 'Not found' }, 404)
})

export default app
