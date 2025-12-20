/**
 * Terminal WebSocket API
 *
 * Provides WebSocket connection for interactive Claude Code terminal.
 * Bridges browser xterm.js to Cloudflare Sandbox stdin/stdout.
 */

import { Hono } from 'hono'
import type { Env } from '../types'

const app = new Hono<{ Bindings: Env }>()

/**
 * GET /terminal/:sessionId
 * WebSocket upgrade for interactive terminal
 *
 * Query params:
 * - repo: GitHub repository (owner/repo)
 * - task: Task description
 * - installationId: GitHub installation ID
 */
app.get('/:sessionId', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')

  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426)
  }

  const sessionId = c.req.param('sessionId')
  const repo = c.req.query('repo')
  const task = c.req.query('task')
  const installationId = c.req.query('installationId')

  // Get or create sandbox instance
  const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
  const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

  // Build WebSocket URL with query params
  const wsUrl = new URL('http://sandbox/ws')
  if (repo) wsUrl.searchParams.set('repo', repo)
  if (task) wsUrl.searchParams.set('task', task)
  if (installationId) wsUrl.searchParams.set('installationId', installationId)

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

    // Pre-create the sandbox instance
    const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
    c.env.CLAUDE_SANDBOX.get(doId)

    return c.json({
      sessionId,
      wsUrl: `/terminal/${sessionId}?repo=${encodeURIComponent(repo)}&task=${encodeURIComponent(task)}&installationId=${installationId}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

export default app
