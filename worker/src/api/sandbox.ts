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
import { authMiddleware } from '../auth'
import type { Env } from '../types'
import type { ExecuteOptions } from '../sandbox/claude'

const app = new Hono<{ Bindings: Env }>()

// Health check endpoint (no auth required)
// Use ?wait=true to wait for container to spawn (up to 60s)
// Use ?wait=false (default) for quick binding check only
app.get('/health', async (c) => {
  try {
    // Check if Sandbox binding exists
    if (!c.env.Sandbox) {
      return c.json({ available: false, reason: 'Sandbox binding not configured' }, 200)
    }

    // Quick check mode - just verify binding exists
    const wait = c.req.query('wait') === 'true'
    if (!wait) {
      return c.json({ available: true, status: 'binding_available' }, 200)
    }

    // Full check - wait for container to spawn and respond
    const testId = 'health-check'
    const doId = c.env.Sandbox.idFromName(testId)
    const sandbox = c.env.Sandbox.get(doId)

    // Container cold starts can take 30-60+ seconds
    const timeoutMs = 60000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const startTime = Date.now()
      const response = await sandbox.fetch(new Request('http://sandbox/health', {
        method: 'GET',
        signal: controller.signal,
      }))
      clearTimeout(timeoutId)

      const spawnTime = Date.now() - startTime
      return c.json({
        available: true,
        status: 'container_ready',
        spawnTimeMs: spawnTime
      }, 200)
    } catch (error) {
      clearTimeout(timeoutId)
      const message = error instanceof Error ? error.message : 'Sandbox not responding'
      // Differentiate timeout from other errors
      const isTimeout = message.includes('aborted') || message.includes('timeout')
      return c.json({
        available: false,
        status: isTimeout ? 'spawn_timeout' : 'error',
        reason: isTimeout ? `Container did not respond within ${timeoutMs/1000}s` : message
      }, 200)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ available: false, status: 'error', reason: message }, 200)
  }
})

// All other sandbox routes require authentication
app.use('/*', authMiddleware)

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
    // installationId is optional for public repos

    // Validate sandbox binding is available
    if (!c.env.Sandbox) {
      console.error('[Sandbox API] Sandbox binding not found')
      return c.json({ error: 'Sandbox service is not available - Sandbox binding not configured' }, 500)
    }

    // Get or create sandbox instance
    const sandboxId = `sandbox-${body.repo.replace('/', '-')}-${Date.now()}`
    const doId = c.env.Sandbox.idFromName(sandboxId)
    const sandbox = c.env.Sandbox.get(doId)

    // Forward request to Durable Object
    const response = await sandbox.fetch(new Request('http://sandbox/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))

    const result = await response.json() as { error?: string }

    if (!response.ok) {
      const errorMsg = result.error || 'Sandbox execution failed'
      console.error('[Sandbox API] Execute failed:', errorMsg)
      return c.json({ error: errorMsg }, response.status as 400 | 500)
    }

    return c.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[Sandbox API] Execute error:', error)
    return c.json({ error: message }, 500)
  }
})

/**
 * POST /api/sandbox/execute/stream
 * Execute Claude Code with SSE streaming output
 */
app.post('/execute/stream', async (c) => {
  try {
    const body = await c.req.json<ExecuteOptions>()

    // Validate required fields
    if (!body.repo) {
      return c.json({ error: 'Missing required field: repo' }, 400)
    }
    if (!body.task) {
      return c.json({ error: 'Missing required field: task' }, 400)
    }
    // installationId is optional for public repos

    // Validate sandbox binding is available
    if (!c.env.Sandbox) {
      console.error('[Sandbox API] Sandbox binding not found')
      return c.json({ error: 'Sandbox service is not available - Sandbox binding not configured' }, 500)
    }

    // Get or create sandbox instance
    const sandboxId = `sandbox-${body.repo.replace('/', '-')}-${Date.now()}`
    const doId = c.env.Sandbox.idFromName(sandboxId)
    const sandbox = c.env.Sandbox.get(doId)

    // Forward request to Durable Object's stream endpoint
    const response = await sandbox.fetch(new Request('http://sandbox/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))

    // Check if the response is an error (non-streaming)
    if (!response.ok) {
      const result = await response.json() as { error?: string }
      const errorMsg = result.error || 'Sandbox execution failed'
      console.error('[Sandbox API] Stream execute failed:', errorMsg)
      return c.json({ error: errorMsg }, response.status as 400 | 500)
    }

    // Return the SSE stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[Sandbox API] Stream error:', error)
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
    // installationId is optional for public repos

    // Validate sandbox binding is available
    if (!c.env.Sandbox) {
      console.error('[Sandbox API] Sandbox binding not found')
      return c.json({ error: 'Sandbox service is not available - Sandbox binding not configured' }, 500)
    }

    // Create session ID
    const sessionId = crypto.randomUUID()

    // Get sandbox instance
    const doId = c.env.Sandbox.idFromName(sessionId)
    const sandbox = c.env.Sandbox.get(doId)

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
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[Sandbox API] Start session error:', error)
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

    if (!c.env.Sandbox) {
      return c.json({ error: 'Sandbox service is not available' }, 500)
    }

    const doId = c.env.Sandbox.idFromName(sessionId)
    const sandbox = c.env.Sandbox.get(doId)

    const response = await sandbox.fetch(new Request(`http://sandbox/session/${sessionId}`))

    if (!response.ok) {
      const result = await response.json() as { error?: string }
      const errorMsg = result.error || 'Session not found'
      return c.json({ error: errorMsg }, 404)
    }

    return c.json(await response.json())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[Sandbox API] Get session error:', error)
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

    if (!c.env.Sandbox) {
      return c.json({ error: 'Sandbox service is not available' }, 500)
    }

    const doId = c.env.Sandbox.idFromName(sessionId)
    const sandbox = c.env.Sandbox.get(doId)

    // Forward to DO's stream endpoint
    const response = await sandbox.fetch(new Request('http://sandbox/stream', {
      method: 'GET',
    }))

    // Check if the response is an error (non-streaming)
    if (!response.ok) {
      const result = await response.json() as { error?: string }
      const errorMsg = result.error || 'Failed to stream session'
      return c.json({ error: errorMsg }, response.status as 400 | 404 | 500)
    }

    // Return the SSE stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[Sandbox API] Stream session error:', error)
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

    if (!c.env.Sandbox) {
      return c.json({ error: 'Sandbox service is not available' }, 500)
    }

    const doId = c.env.Sandbox.idFromName(sessionId)
    const sandbox = c.env.Sandbox.get(doId)

    const response = await sandbox.fetch(new Request(`http://sandbox/feedback/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }))

    if (!response.ok) {
      const error = await response.json() as { error?: string }
      const errorMsg = error.error || 'Failed to send feedback'
      return c.json({ error: errorMsg }, response.status as 400 | 404)
    }

    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[Sandbox API] Feedback error:', error)
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

    if (!c.env.Sandbox) {
      return c.json({ error: 'Sandbox service is not available' }, 500)
    }

    const doId = c.env.Sandbox.idFromName(sessionId)
    const sandbox = c.env.Sandbox.get(doId)

    const response = await sandbox.fetch(new Request(`http://sandbox/abort/${sessionId}`, {
      method: 'POST',
    }))

    if (!response.ok) {
      const error = await response.json() as { error?: string }
      const errorMsg = error.error || 'Failed to abort session'
      return c.json({ error: errorMsg }, response.status as 400 | 404)
    }

    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[Sandbox API] Abort session error:', error)
    return c.json({ error: message }, 500)
  }
})

export default app
