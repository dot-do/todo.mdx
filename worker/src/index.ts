/**
 * TODO.mdx Worker
 * GitHub App backend for syncing issues, milestones, and projects
 * Using Payload RPC for data access
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { voice } from './voice'
import { mcp, TodoMCP } from './mcp'
import { api } from './api'
import sandbox from './api/sandbox'
import terminal from './api/terminal'
import linear from './api/linear'
import { authMiddleware, type AuthContext } from './auth'
import type { Env } from './types'

export { RepoDO } from './do/repo'
export { ProjectDO } from './do/project'
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
// Linear Integration routes
// Note: Webhook endpoint does NOT use auth (verified via signature)
// ============================================

app.route('/api/linear', linear)

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
app.all('/mcp/*', async (c) => {
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
// Terminal WebSocket routes
// ============================================

app.route('/terminal', terminal)

// ============================================
// Auth routes (via OAuth 2.1 / WorkOS API keys)
// ============================================

// Get current user (requires auth)
app.get('/api/me', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext

  // Lookup user from Payload based on auth context
  const users = await c.env.PAYLOAD.find({
    collection: 'users',
    where: {
      or: [
        { workosUserId: { equals: auth.userId } },
        { email: { equals: auth.email } },
      ],
    },
    limit: 1,
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

        // Find the installation and add the user
        const installations = await c.env.PAYLOAD.find({
          collection: 'installations',
          where: { installationId: { equals: parseInt(installationId) } },
          limit: 1,
        })

        if (installations.docs?.length > 0) {
          const installation = installations.docs[0]
          const existingUsers = installation.users || []
          if (!existingUsers.includes(userId)) {
            await c.env.PAYLOAD.update({
              collection: 'installations',
              id: installation.id,
              data: {
                users: [...existingUsers, userId],
              },
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

// ============================================
// GitHub webhook handler
// ============================================

app.post('/github/webhook', async (c) => {
  const signature = c.req.header('x-hub-signature-256')
  const event = c.req.header('x-github-event')
  const deliveryId = c.req.header('x-github-delivery')

  // Verify webhook signature
  const body = await c.req.text()
  const isValid = await verifyGitHubSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET)

  if (!isValid) {
    console.warn(`Invalid webhook signature for delivery ${deliveryId}`)
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const payload = JSON.parse(body)

  console.log(`Received webhook: ${event} (${deliveryId})`)

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
    default:
      return c.json({ status: 'ignored', event })
  }
})

// Installation webhook
async function handleInstallation(c: any, payload: any): Promise<Response> {
  if (payload.action === 'created') {
    const installation = payload.installation

    // Store installation via Payload RPC
    const installationDoc = await c.env.PAYLOAD.create({
      collection: 'installations',
      data: {
        installationId: installation.id,
        accountType: installation.account.type,
        accountId: installation.account.id,
        accountLogin: installation.account.login,
        accountAvatarUrl: installation.account.avatar_url,
        permissions: installation.permissions,
        events: installation.events,
        repositorySelection: installation.repository_selection,
      },
    })

    // Create repos for each repository via Payload RPC
    for (const repo of payload.repositories || []) {
      // Create Durable Object for the repo
      c.env.REPO.idFromName(repo.full_name)

      await c.env.PAYLOAD.create({
        collection: 'repos',
        data: {
          githubId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          owner: repo.full_name.split('/')[0],
          private: repo.private || false,
          installation: installationDoc.id,
        },
      })
    }

    return c.json({ status: 'installed', repos: payload.repositories?.length || 0 })
  }

  if (payload.action === 'deleted') {
    // Find and delete installation via Payload RPC
    const installations = await c.env.PAYLOAD.find({
      collection: 'installations',
      where: { installationId: { equals: payload.installation.id } },
      limit: 1,
    })

    if (installations.docs?.length > 0) {
      await c.env.PAYLOAD.delete({
        collection: 'installations',
        id: installations.docs[0].id,
      })
    }

    return c.json({ status: 'uninstalled' })
  }

  return c.json({ status: 'ok' })
}

// Issues webhook
async function handleIssues(c: any, payload: any): Promise<Response> {
  const repo = payload.repository
  const issue = payload.issue
  const action = payload.action

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

  const response = await stub.fetch(new Request('http://do/issues/sync', {
    method: 'POST',
    body: JSON.stringify({
      source: 'github',
      issues: [{
        githubId: issue.id,
        githubNumber: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels?.map((l: any) => l.name),
        assignees: issue.assignees?.map((a: any) => a.login),
        updatedAt: issue.updated_at,
      }],
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
          labels: issue.labels?.map((l: any) => l.name),
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
async function handleMilestone(c: any, payload: any): Promise<Response> {
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

// Push webhook (for .todo/*.md and TODO.md file changes)
async function handlePush(c: any, payload: any): Promise<Response> {
  const repo = payload.repository

  const todoFiles: string[] = []

  for (const commit of payload.commits || []) {
    const allFiles = [...(commit.added || []), ...(commit.modified || [])]
    for (const file of allFiles) {
      if (file.startsWith('.todo/') || file === 'TODO.md' || file === 'TODO.mdx') {
        todoFiles.push(file)
      }
      if (file.startsWith('.roadmap/') || file === 'ROADMAP.md' || file === 'ROADMAP.mdx') {
        todoFiles.push(file)
      }
    }
  }

  if (todoFiles.length === 0) {
    return c.json({ status: 'ignored', reason: 'no todo files changed' })
  }

  // TODO: Fetch file contents from GitHub API and sync to DO
  const doId = c.env.REPO.idFromName(repo.full_name)
  const stub = c.env.REPO.get(doId)

  return c.json({ status: 'queued', files: todoFiles })
}

// GitHub Projects v2 webhook (project-level events)
async function handleProject(c: any, payload: any): Promise<Response> {
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
async function handleProjectItem(c: any, payload: any): Promise<Response> {
  const projectNodeId = payload.projects_v2_item?.project_node_id

  if (!projectNodeId) {
    return c.json({ status: 'ignored', reason: 'no project id' })
  }

  const doId = c.env.PROJECT.idFromName(projectNodeId)
  const stub = c.env.PROJECT.get(doId)

  // Extract field values from the payload if present
  const fieldValues: Record<string, any> = {}

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

// ============================================
// Protected API routes (require auth)
// ============================================

// Get user's installations
app.get('/api/user/installations', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext

  // Get installations where this user is in the users array
  const result = await c.env.PAYLOAD.find({
    collection: 'installations',
    where: {
      'users.workosUserId': { equals: auth.userId },
    },
    depth: 1,
  })

  return c.json(result.docs || [])
})

// Get user's repos
app.get('/api/user/repos', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext

  // Get repos where user has access via installation
  const result = await c.env.PAYLOAD.find({
    collection: 'repos',
    where: {
      'installation.users.workosUserId': { equals: auth.userId },
    },
    depth: 1,
  })

  return c.json(result.docs || [])
})

// API: List all installations (admin - requires auth)
app.get('/api/installations', authMiddleware, async (c) => {
  const result = await c.env.PAYLOAD.find({
    collection: 'installations',
    limit: 100,
  })
  return c.json(result.docs || [])
})

// API: List repos for an installation (requires auth)
app.get('/api/installations/:id/repos', authMiddleware, async (c) => {
  const installationId = c.req.param('id')
  const result = await c.env.PAYLOAD.find({
    collection: 'repos',
    where: {
      installation: { equals: installationId },
    },
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

export default app
