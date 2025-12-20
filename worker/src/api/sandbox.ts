/**
 * Sandbox API Routes
 *
 * REST API for Claude Code sandbox operations:
 * - POST /api/sandbox/execute - Headless execution
 * - POST /api/sandbox/sessions - Start a streaming session
 * - GET /api/sandbox/sessions/:id - Get session status
 * - GET /api/sandbox/sessions/:id/stream - SSE stream of session events
 * - POST /api/sandbox/sessions/:id/feedback - Send feedback to session
 * - DELETE /api/sandbox/sessions/:id - Abort session
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import type { ExecuteOptions } from '../sandbox/claude'

const app = new Hono<{ Bindings: Env }>()

// ============================================================================
// Headless Execution
// ============================================================================

/**
 * POST /api/sandbox/execute
 * Execute Claude Code headlessly and return results
 */
app.post('/execute', async (c) => {
  try {
    const body = await c.req.json<ExecuteOptions>()

    // Validate required fields
    if (!body.repo) {
      return c.json({ error: 'Missing required field: repo' }, 400)
    }
    if (!body.task) {
      return c.json({ error: 'Missing required field: task' }, 400)
    }
    if (!body.installationId) {
      return c.json({ error: 'Missing required field: installationId' }, 400)
    }

    // Get or create sandbox instance
    const sandboxId = `sandbox-${body.repo.replace('/', '-')}-${Date.now()}`
    const doId = c.env.CLAUDE_SANDBOX.idFromName(sandboxId)
    const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

    // Forward request to Durable Object
    const response = await sandbox.fetch(new Request('http://sandbox/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))

    const result = await response.json()

    if (!response.ok) {
      return c.json(result, response.status as 400 | 500)
    }

    return c.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Sandbox API] Execute error:', message)
    return c.json({ error: message }, 500)
  }
})

// ============================================================================
// Session Management
// ============================================================================

/**
 * POST /api/sandbox/sessions
 * Start a new streaming session
 */
app.post('/sessions', async (c) => {
  try {
    const body = await c.req.json<ExecuteOptions>()

    // Validate required fields
    if (!body.repo) {
      return c.json({ error: 'Missing required field: repo' }, 400)
    }
    if (!body.task) {
      return c.json({ error: 'Missing required field: task' }, 400)
    }
    if (!body.installationId) {
      return c.json({ error: 'Missing required field: installationId' }, 400)
    }

    // Create session ID
    const sessionId = crypto.randomUUID()

    // Get sandbox instance
    const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
    const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

    // Start streaming session in background
    c.executionCtx.waitUntil(
      sandbox.fetch(new Request('http://sandbox/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }))
    )

    return c.json({ sessionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Sandbox API] Start session error:', message)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/sandbox/sessions/:id
 * Get session status
 */
app.get('/sessions/:id', async (c) => {
  try {
    const sessionId = c.req.param('id')

    const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
    const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

    const response = await sandbox.fetch(new Request(`http://sandbox/session/${sessionId}`))

    if (!response.ok) {
      return c.json({ error: 'Session not found' }, 404)
    }

    return c.json(await response.json())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/sandbox/sessions/:id/stream
 * Stream session events via SSE
 */
app.get('/sessions/:id/stream', async (c) => {
  try {
    const sessionId = c.req.param('id')

    const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
    const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

    // Forward to DO's stream endpoint
    const response = await sandbox.fetch(new Request('http://sandbox/stream', {
      method: 'GET',
    }))

    // Return the SSE stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/sandbox/sessions/:id/feedback
 * Send feedback to running session
 */
app.post('/sessions/:id/feedback', async (c) => {
  try {
    const sessionId = c.req.param('id')
    const { message } = await c.req.json<{ message: string }>()

    if (!message) {
      return c.json({ error: 'Missing required field: message' }, 400)
    }

    const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
    const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

    const response = await sandbox.fetch(new Request(`http://sandbox/feedback/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }))

    if (!response.ok) {
      const error = await response.json() as { error: string }
      return c.json(error, response.status as 400 | 404)
    }

    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

/**
 * DELETE /api/sandbox/sessions/:id
 * Abort running session
 */
app.delete('/sessions/:id', async (c) => {
  try {
    const sessionId = c.req.param('id')

    const doId = c.env.CLAUDE_SANDBOX.idFromName(sessionId)
    const sandbox = c.env.CLAUDE_SANDBOX.get(doId)

    const response = await sandbox.fetch(new Request(`http://sandbox/abort/${sessionId}`, {
      method: 'POST',
    }))

    if (!response.ok) {
      const error = await response.json() as { error: string }
      return c.json(error, response.status as 400 | 404)
    }

    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

export default app
