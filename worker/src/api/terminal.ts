/**
 * Terminal WebSocket API
 *
 * Provides WebSocket connection for interactive Claude Code terminal.
 * Bridges browser xterm.js to Cloudflare Sandbox stdin/stdout.
 */

import { Hono } from 'hono'
import { authMiddleware } from '../auth'
import { getSessionFromRequest, parseSessionToken } from '../auth/session'
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
  status: 'pending' | 'connected' | 'running' | 'complete' | 'error' | 'terminated'
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

  // Check for token in query param (for WebSocket connections from browser)
  const tokenParam = c.req.query('token')
  if (tokenParam) {
    const session = await parseSessionToken(tokenParam, c.env.COOKIE_ENCRYPTION_KEY)
    if (!session) {
      return c.text('Invalid token', 401)
    }
    // Token valid, proceed with upgrade
  }

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
  const doId = c.env.Sandbox.idFromName(sessionId)
  const sandbox = c.env.Sandbox.get(doId)

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
    const doId = c.env.Sandbox.idFromName(sessionId)
    c.env.Sandbox.get(doId)

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
 * GET /terminal/:sessionId/events
 * SSE stream of terminal events (alternative to WebSocket for some clients)
 */
app.get('/:sessionId/events', async (c) => {
  const sessionId = c.req.param('sessionId')

  const sessionData = await c.env.OAUTH_KV.get(`terminal:${sessionId}`, 'json') as TerminalSession | null
  if (!sessionData) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Get sandbox instance
  const doId = c.env.Sandbox.idFromName(sessionId)
  const sandbox = c.env.Sandbox.get(doId)

  // Start streaming from sandbox
  const streamResponse = await sandbox.fetch(new Request('http://sandbox/stream', {
    method: 'POST',
    body: JSON.stringify({
      repo: sessionData.repo,
      task: sessionData.task,
      installationId: sessionData.installationId,
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  // Pipe sandbox SSE to client
  const reader = streamResponse.body?.getReader()
  if (reader) {
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
      } finally {
        await writer.close()
      }
    })()
  }

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
})

/**
 * POST /terminal/:sessionId/terminate
 * Terminate a running session
 */
app.post('/:sessionId/terminate', async (c) => {
  const sessionId = c.req.param('sessionId')

  const sessionData = await c.env.OAUTH_KV.get(`terminal:${sessionId}`, 'json') as TerminalSession | null
  if (!sessionData) {
    return c.json({ error: 'Session not found' }, 404)
  }

  // Update status
  await c.env.OAUTH_KV.put(`terminal:${sessionId}`, JSON.stringify({
    ...sessionData,
    status: 'terminated',
  }), { expirationTtl: 300 }) // Keep for 5 min after termination

  // Signal sandbox to abort
  const doId = c.env.Sandbox.idFromName(sessionId)
  const sandbox = c.env.Sandbox.get(doId)

  await sandbox.fetch(new Request('http://sandbox/abort', {
    method: 'POST',
  }))

  return c.json({ success: true })
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
