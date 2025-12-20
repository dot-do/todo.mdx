/**
 * TODO.mdx Worker
 * GitHub App backend for syncing issues, milestones, and projects
 * With Better Auth for user authentication
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuth } from './auth'
import { voice } from './voice'
import { mcp } from './mcp'

export { RepoDO } from './do/repo'
export { ProjectDO } from './do/project'

export interface Env {
  DB: D1Database
  AI: Ai
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  LOADER: WorkerLoader
  // GitHub App
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
  GITHUB_WEBHOOK_SECRET: string
  // Better Auth
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  // Claude API
  ANTHROPIC_API_KEY: string
}

// Worker Loader types
interface WorkerLoader {
  get(id: string, getCode: () => Promise<WorkerCode>): WorkerStub
}

interface WorkerCode {
  compatibilityDate: string
  compatibilityFlags?: string[]
  mainModule: string
  modules: Record<string, string>
  env?: Record<string, unknown>
  globalOutbound?: null
}

interface WorkerStub {
  getEntrypoint(): WorkerEntrypoint
}

interface WorkerEntrypoint {
  fetch(request: Request | string): Promise<Response>
}

interface User {
  id: string
  name: string
  email: string
  image?: string
  githubId?: number
  githubUsername?: string
}

interface Session {
  user: User
}

type Variables = {
  user: User
  session: Session
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

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
// MCP Server with OAuth 2.1
// ============================================

app.route('/mcp', mcp)

// ============================================
// Better Auth routes
// ============================================

app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  const auth = createAuth({
    DB: c.env.DB,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
  })

  return auth.handler(c.req.raw)
})

// Get current user
app.get('/api/me', async (c) => {
  const auth = createAuth({
    DB: c.env.DB,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
  })

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ user: null }, 401)
  }

  return c.json({ user: session.user })
})

// ============================================
// GitHub App installation callback
// Links installation to authenticated user
// ============================================

app.get('/github/callback', async (c) => {
  const installationId = c.req.query('installation_id')
  const setupAction = c.req.query('setup_action')

  if (setupAction === 'install' && installationId) {
    // Get current user session
    const auth = createAuth({
      DB: c.env.DB,
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
      GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
    })

    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (session?.user) {
      // Link installation to user
      const now = new Date().toISOString()
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO user_installations (user_id, installation_id, role, created_at)
        VALUES (?, ?, 'owner', ?)
      `).bind(session.user.id, installationId, now).run()
    }

    return c.redirect('https://todo.mdx.do/dashboard?installed=true')
  }

  return c.redirect('https://todo.mdx.do')
})

// ============================================
// GitHub webhook handler
// ============================================

app.post('/github/webhook', async (c) => {
  const signature = c.req.header('x-hub-signature-256')
  const event = c.req.header('x-github-event')
  const deliveryId = c.req.header('x-github-delivery')

  // TODO: Verify webhook signature
  // const body = await c.req.text()
  // const isValid = await verifySignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET)

  const payload = await c.req.json()

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
    case 'projects_v2_item':
      return handleProjectItem(c, payload)
    default:
      return c.json({ status: 'ignored', event })
  }
})

// Installation webhook
async function handleInstallation(c: any, payload: any): Promise<Response> {
  const now = new Date().toISOString()

  if (payload.action === 'created') {
    const installation = payload.installation

    // Store installation
    await c.env.DB.prepare(`
      INSERT INTO installations (installation_id, account_type, account_id, account_login, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      installation.id,
      installation.account.type,
      installation.account.id,
      installation.account.login,
      now,
      now
    ).run()

    // Create Durable Objects for each repository
    for (const repo of payload.repositories || []) {
      const doId = c.env.REPO.idFromName(`${repo.full_name}`)

      await c.env.DB.prepare(`
        INSERT INTO repos (installation_id, repo_id, owner, name, full_name, do_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        installation.id,
        repo.id,
        repo.full_name.split('/')[0],
        repo.name,
        repo.full_name,
        doId.toString(),
        now,
        now
      ).run()
    }

    return c.json({ status: 'installed', repos: payload.repositories?.length || 0 })
  }

  if (payload.action === 'deleted') {
    await c.env.DB.prepare(`
      DELETE FROM installations WHERE installation_id = ?
    `).bind(payload.installation.id).run()

    return c.json({ status: 'uninstalled' })
  }

  return c.json({ status: 'ok' })
}

// Issues webhook
async function handleIssues(c: any, payload: any): Promise<Response> {
  const repo = payload.repository
  const issue = payload.issue

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
  return c.json({ status: 'synced', action: payload.action, result })
}

// Milestone webhook
async function handleMilestone(c: any, payload: any): Promise<Response> {
  const repo = payload.repository
  const milestone = payload.milestone

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
  return c.json({ status: 'synced', action: payload.action, result })
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

// GitHub Projects v2 item webhook
async function handleProjectItem(c: any, payload: any): Promise<Response> {
  const projectNodeId = payload.projects_v2_item?.project_node_id

  if (!projectNodeId) {
    return c.json({ status: 'ignored', reason: 'no project id' })
  }

  const doId = c.env.PROJECT.idFromName(projectNodeId)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/items/sync', {
    method: 'POST',
    body: JSON.stringify({
      action: payload.action,
      item: payload.projects_v2_item,
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()
  return c.json({ status: 'synced', result })
}

// ============================================
// Protected API routes (require auth)
// ============================================

// Middleware to check auth
const requireAuth = async (c: any, next: () => Promise<void>) => {
  const auth = createAuth({
    DB: c.env.DB,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
  })

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('user', session.user)
  c.set('session', session)
  await next()
}

// Get user's installations
app.get('/api/user/installations', requireAuth, async (c) => {
  const user = c.get('user')

  const result = await c.env.DB.prepare(`
    SELECT i.*, ui.role
    FROM installations i
    JOIN user_installations ui ON ui.installation_id = i.installation_id
    WHERE ui.user_id = ?
  `).bind(user.id).all()

  return c.json(result.results)
})

// Get user's repos
app.get('/api/user/repos', requireAuth, async (c) => {
  const user = c.get('user')

  const result = await c.env.DB.prepare(`
    SELECT r.*
    FROM repos r
    JOIN user_installations ui ON ui.installation_id = r.installation_id
    WHERE ui.user_id = ?
  `).bind(user.id).all()

  return c.json(result.results)
})

// API: List all installations (admin)
app.get('/api/installations', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM installations').all()
  return c.json(result.results)
})

// API: List repos for an installation
app.get('/api/installations/:id/repos', async (c) => {
  const installationId = c.req.param('id')
  const result = await c.env.DB.prepare(
    'SELECT * FROM repos WHERE installation_id = ?'
  ).bind(installationId).all()
  return c.json(result.results)
})

// API: Get repo sync status
app.get('/api/repos/:owner/:name/status', async (c) => {
  const owner = c.req.param('owner')
  const name = c.req.param('name')
  const fullName = `${owner}/${name}`

  const doId = c.env.REPO.idFromName(fullName)
  const stub = c.env.REPO.get(doId)

  const response = await stub.fetch(new Request('http://do/status'))
  return response
})

// API: Trigger manual sync for a repo
app.post('/api/repos/:owner/:name/sync', requireAuth, async (c) => {
  const owner = c.req.param('owner')
  const name = c.req.param('name')
  const fullName = `${owner}/${name}`

  // TODO: Fetch all issues, milestones, and files from GitHub and sync
  return c.json({ status: 'queued', repo: fullName })
})

export default app
