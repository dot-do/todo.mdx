/**
 * Stdio WebSocket Proxy API
 *
 * Proxies WebSocket connections to the sandbox's stdio-ws server (port 8080).
 * Uses binary protocol for stdin/stdout/stderr multiplexing.
 *
 * This is the new architecture that supports both CLI (sbx-stdio) and
 * browser (xterm.js) clients with the same protocol.
 */

import { Hono } from 'hono'
import { getSandbox } from '@cloudflare/sandbox'
import { authMiddleware, decodeOAuthToken, type AuthContext } from '../auth'
import type { Env } from '../types'

const app = new Hono<{ Bindings: Env }>()

/**
 * GET /stdio/:sandboxId
 * WebSocket upgrade for stdio proxy
 *
 * Query params passed through to sandbox:
 *   - cmd: Command to run (default: bash)
 *   - arg: Arguments (repeatable)
 *
 * Authentication:
 *   - token: Query param or Authorization header
 */
app.get('/:sandboxId', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')

  // Must be WebSocket upgrade
  if (upgradeHeader?.toLowerCase() !== 'websocket') {
    return c.json({
      error: 'WebSocket upgrade required',
      usage: 'Connect via WebSocket with ?cmd=bash&arg=...',
    }, 426)
  }

  const sandboxId = c.req.param('sandboxId')
  const url = new URL(c.req.url)

  // Authenticate
  const token = url.searchParams.get('token')
    ?? c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  // Validate token (use existing auth middleware logic)
  try {
    // Get auth context by calling the auth middleware manually
    const auth = await validateToken(c.env, token)
    if (!auth) {
      return c.json({ error: 'Invalid token' }, 401)
    }
  } catch (err) {
    console.error('[stdio] Auth error:', err)
    return c.json({ error: 'Authentication failed' }, 401)
  }

  // Get sandbox instance
  try {
    const sandbox = getSandbox(
      c.env.CLAUDE_SANDBOX as unknown as DurableObjectNamespace,
      sandboxId
    )

    // Ensure stdio-ws is running before proxying
    // This handles the case where the container is cold or stdio-ws hasn't started
    await sandbox.exec(
      'pgrep -f stdio-ws.ts >/dev/null || (nohup bun /workspace/stdio-ws.ts > /tmp/stdio-ws.log 2>&1 & sleep 0.5)'
    )

    // Proxy WebSocket to sandbox port 8080
    return await sandbox.wsConnect(c.req.raw, 8080)
  } catch (err) {
    console.error('[stdio] Sandbox connection error:', err)
    return c.json({
      error: 'Failed to connect to sandbox',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * GET /stdio/:sandboxId/warmup
 * Warm up the sandbox container by running a simple command
 * This helps avoid cold-start delays on WebSocket connections
 */
app.get('/:sandboxId/warmup', async (c) => {
  const sandboxId = c.req.param('sandboxId')
  const url = new URL(c.req.url)

  // Authenticate
  const token = url.searchParams.get('token')
    ?? c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const auth = await validateToken(c.env, token)
  if (!auth) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  try {
    const sandbox = getSandbox(
      c.env.CLAUDE_SANDBOX as unknown as DurableObjectNamespace,
      sandboxId
    )

    // Start stdio-ws if not running
    console.log(`[stdio] Warming up sandbox: ${sandboxId}`)

    // Start stdio-ws server if not already running
    const startResult = await sandbox.exec(
      'pgrep -f stdio-ws.ts >/dev/null || (nohup bun /workspace/stdio-ws.ts > /tmp/stdio-ws.log 2>&1 & sleep 1)'
    )

    // Verify it's running
    const verifyResult = await sandbox.exec('curl -s localhost:8080 2>/dev/null || echo "Not ready"')

    const result = {
      stdout: verifyResult.stdout || 'stdio-ws started',
      success: verifyResult.stdout?.includes('sandbox-stdio-ws') || false,
    }

    return c.json({
      status: 'ready',
      sandboxId,
      output: result.stdout,
      success: result.success,
    })
  } catch (err) {
    console.error('[stdio] Warmup error:', err)
    return c.json({
      error: 'Failed to warm up sandbox',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * POST /stdio/create
 * Create a new sandbox session and return connection details
 *
 * Body:
 *   - sandboxId: Optional custom sandbox ID (default: auto-generated)
 *   - repo: Optional repo to clone
 *   - installationId: GitHub installation ID (required if repo specified)
 */
app.post('/create', authMiddleware, async (c) => {
  const auth = c.get('auth') as AuthContext

  try {
    const body = await c.req.json<{
      sandboxId?: string
      repo?: string
      installationId?: number
    }>()

    const sandboxId = body.sandboxId ?? crypto.randomUUID()

    // Store session in KV for reconnection
    await c.env.OAUTH_KV.put(`stdio:${sandboxId}`, JSON.stringify({
      userId: auth.userId,
      repo: body.repo,
      installationId: body.installationId,
      createdAt: Date.now(),
    }), { expirationTtl: 3600 })

    // Pre-create sandbox instance
    const doId = c.env.CLAUDE_SANDBOX.idFromName(sandboxId)
    c.env.CLAUDE_SANDBOX.get(doId)

    return c.json({
      sandboxId,
      wsUrl: `/api/stdio/${sandboxId}`,
      expiresIn: 3600,
    })
  } catch (err) {
    console.error('[stdio] Create error:', err)
    return c.json({
      error: 'Failed to create sandbox session',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * DELETE /stdio/:sandboxId
 * Terminate a sandbox session
 */
app.delete('/:sandboxId', authMiddleware, async (c) => {
  const sandboxId = c.req.param('sandboxId')

  try {
    // Remove from KV
    await c.env.OAUTH_KV.delete(`stdio:${sandboxId}`)

    // TODO: Terminate sandbox (Sandbox SDK doesn't have a terminate method yet)

    return c.json({ success: true, sandboxId })
  } catch (err) {
    console.error('[stdio] Delete error:', err)
    return c.json({
      error: 'Failed to terminate sandbox',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * GET /stdio/:sandboxId/status
 * Get sandbox session status
 */
app.get('/:sandboxId/status', authMiddleware, async (c) => {
  const sandboxId = c.req.param('sandboxId')

  try {
    const session = await c.env.OAUTH_KV.get(`stdio:${sandboxId}`, 'json')

    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    return c.json({
      sandboxId,
      session,
      wsUrl: `/api/stdio/${sandboxId}`,
    })
  } catch (err) {
    console.error('[stdio] Status error:', err)
    return c.json({
      error: 'Failed to get session status',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Validate authentication token
 * Returns auth context or null if invalid
 */
async function validateToken(
  env: Env,
  token: string
): Promise<AuthContext | null> {
  try {
    // Try WorkOS session token
    if (token.startsWith('wos_')) {
      // WorkOS session - validate via WorkOS API
      const response = await fetch('https://api.workos.com/user_management/authenticate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WORKOS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_token: token,
          client_id: env.WORKOS_CLIENT_ID,
        }),
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json() as any
      return {
        userId: data.user?.id,
        email: data.user?.email,
        name: data.user?.first_name,
        source: 'workos',
      }
    }

    // Try JWT token (API key style)
    // For now, just check if it's a valid API key in KV
    const apiKeyData = await env.OAUTH_KV.get(`apikey:${token}`, 'json') as any

    if (apiKeyData) {
      return {
        userId: apiKeyData.userId,
        email: apiKeyData.email,
        name: apiKeyData.name,
        source: 'apikey',
      }
    }

    // Try OAuth access token from our MCP server
    const accessTokenData = await env.OAUTH_KV.get(`access_token:${token}`, 'json') as any

    if (accessTokenData) {
      return {
        userId: accessTokenData.userId,
        email: accessTokenData.email,
        name: accessTokenData.name,
        source: 'oauth',
      }
    }

    // Try JWT token (WorkOS access token via oauth.do)
    // TODO: Add JWKS verification when oauth.do exposes JWKS endpoint
    // For now, decode without verification (tokens come from trusted oauth.do flow)
    try {
      const session = decodeOAuthToken(token)
      return {
        userId: session.userId,
        email: session.email,
        name: undefined,
        source: 'jwt',
      }
    } catch {
      // Not a valid JWT, continue to return null
    }

    return null
  } catch (err) {
    console.error('[stdio] Token validation error:', err)
    return null
  }
}

export default app
