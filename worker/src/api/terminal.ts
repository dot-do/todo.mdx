/**
 * Terminal WebSocket API
 *
 * Provides WebSocket connection for interactive Claude Code terminal.
 * Bridges browser xterm.js to Cloudflare Sandbox stdin/stdout.
 */

import { Hono } from 'hono'
import { authMiddleware } from '../auth'
import type { Env } from '../types'

const app = new Hono<{ Bindings: Env }>()

// All terminal routes require authentication
app.use('/*', authMiddleware)

/**
 * Session stored in KV
 */
interface TerminalSession {
  repo: string
  task: string
  installationId: number
  createdAt: number
  status: 'pending' | 'connected' | 'running' | 'complete' | 'error'
}

/**
 * GET /terminal/:sessionId
 * WebSocket upgrade for interactive terminal OR status check
 *
 * If Upgrade header is present: WebSocket connection
 * If no Upgrade header: Return session status (JSON)
 */
app.get('/:sessionId', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  const sessionId = c.req.param('sessionId')

  // Status check endpoint
  if (upgradeHeader !== 'websocket') {
    const sessionData = await c.env.OAUTH_KV.get(`terminal:${sessionId}`, 'json') as TerminalSession | null
    if (!sessionData) {
      return c.json({ error: 'Session not found' }, 404)
    }
    return c.json(sessionData)
  }

  // WebSocket upgrade
  const repo = c.req.query('repo')
  const task = c.req.query('task')
  const installationId = c.req.query('installationId')

  // Validate session exists in KV
  const sessionData = await c.env.OAUTH_KV.get(`terminal:${sessionId}`, 'json') as TerminalSession | null
  if (!sessionData) {
    return c.text('Session not found', 404)
  }

  // Update session status to connected
  await c.env.OAUTH_KV.put(`terminal:${sessionId}`, JSON.stringify({
    ...sessionData,
    status: 'connected',
  }), { expirationTtl: 3600 })

  // Get or create sandbox instance
  const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
  const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

  // Build WebSocket URL with query params (fallback to session data)
  const wsUrl = new URL('http://sandbox/ws')
  wsUrl.searchParams.set('repo', repo || sessionData.repo)
  wsUrl.searchParams.set('task', task || sessionData.task)
  wsUrl.searchParams.set('installationId', installationId || sessionData.installationId.toString())

  // Forward WebSocket upgrade to Durable Object
  return sandbox.fetch(new Request(wsUrl.toString(), {
    headers: c.req.raw.headers,
  }))
})

/**
 * POST /terminal/start
 * Start a new terminal session and return session ID
 *
 * Body:
 * - repo: GitHub repository
 * - task: Initial task
 * - installationId: GitHub installation ID
 */
app.post('/start', async (c) => {
  try {
    const { repo, task, installationId } = await c.req.json<{
      repo: string
      task: string
      installationId: number
    }>()

    if (!repo || !task || !installationId) {
      return c.json({
        error: 'Missing required fields: repo, task, installationId',
      }, 400)
    }

    // Generate session ID
    const sessionId = crypto.randomUUID()

    // Store session config in KV
    await c.env.OAUTH_KV.put(`terminal:${sessionId}`, JSON.stringify({
      repo,
      task,
      installationId,
      createdAt: Date.now(),
      status: 'pending',
    } as TerminalSession), { expirationTtl: 3600 })

    // Pre-create the sandbox instance
    const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
    c.env.CLAUDE_SANDBOX.get(doId)

    return c.json({
      sessionId,
      wsUrl: `/terminal/${sessionId}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

/**
 * DELETE /terminal/:sessionId
 * Clean up terminal session from KV storage
 */
app.delete('/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    await c.env.OAUTH_KV.delete(`terminal:${sessionId}`)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

export default app
