/**
 * Browser API Routes
 *
 * REST API for browser automation sessions.
 *
 * Routes:
 * - POST /api/browser/start - Create standalone session
 * - POST /api/browser/:org/:repo/:issue/start - Create/get issue-scoped session
 * - GET /api/browser/:sessionId - Session status + recording
 * - GET /api/browser/:org/:repo/:issue - Get issue-scoped session
 * - POST /api/browser/:sessionId/release - Release session
 * - DELETE /api/browser/:sessionId - Clean up from KV
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import type { CreateSessionOptions, BrowserSession, StoredSession } from '../types/browser'
import { getBrowserProvider, selectProvider, createBrowserProvider } from './provider'

export const browser = new Hono<{ Bindings: Env }>()

/**
 * POST /start - Create a new standalone browser session
 */
browser.post('/start', async (c) => {
  const body = await c.req.json<CreateSessionOptions>().catch(() => ({}))
  const env = c.env

  try {
    const provider = getBrowserProvider(env, body)
    const session = await provider.createSession(body)

    return c.json({ session })
  } catch (error) {
    console.error('[Browser API] Failed to create session:', error)
    return c.json({
      error: 'session_creation_failed',
      message: (error as Error).message,
    }, 500)
  }
})

/**
 * POST /:org/:repo/:issue/start - Create or reconnect to issue-scoped session
 */
browser.post('/:org/:repo/:issue/start', async (c) => {
  const { org, repo, issue } = c.req.param()
  const contextId = `${org}/${repo}#${issue}`
  const sessionId = `browser:${contextId}`

  const body = await c.req.json<CreateSessionOptions>().catch(() => ({}))
  const env = c.env

  try {
    // Check for existing session
    const existing = await getStoredSession(sessionId, env)

    if (existing && existing.status === 'running') {
      // Verify it's still running with provider
      const providerType = existing.provider
      const provider = createBrowserProvider(providerType, env)
      const currentSession = await provider.getSession(sessionId)

      if (currentSession && currentSession.status === 'running') {
        return c.json({ session: currentSession })
      }
    }

    // Create new session with issue context
    const options: CreateSessionOptions = {
      ...body,
      contextId,
    }

    const provider = getBrowserProvider(env, options)
    const session = await provider.createSession(options)

    return c.json({ session })
  } catch (error) {
    console.error('[Browser API] Failed to create issue session:', error)
    return c.json({
      error: 'session_creation_failed',
      message: (error as Error).message,
    }, 500)
  }
})

/**
 * GET /:org/:repo/:issue - Get issue-scoped session
 */
browser.get('/:org/:repo/:issue', async (c) => {
  const { org, repo, issue } = c.req.param()

  // Avoid matching release route
  if (repo === undefined || issue === undefined) {
    return c.notFound()
  }

  const contextId = `${org}/${repo}#${issue}`
  const sessionId = `browser:${contextId}`
  const env = c.env

  try {
    const stored = await getStoredSession(sessionId, env)
    if (!stored) {
      return c.json({ error: 'session_not_found' }, 404)
    }

    const provider = createBrowserProvider(stored.provider, env)
    const session = await provider.getSession(sessionId)

    if (!session) {
      return c.json({ error: 'session_not_found' }, 404)
    }

    // Include recording for completed browserbase sessions
    let recording = null
    if (session.status === 'completed' && session.provider === 'browserbase') {
      recording = await provider.getRecording(sessionId)
    }

    return c.json({ session, recording })
  } catch (error) {
    console.error('[Browser API] Failed to get issue session:', error)
    return c.json({
      error: 'session_fetch_failed',
      message: (error as Error).message,
    }, 500)
  }
})

/**
 * GET /:sessionId - Get session status (must come after /:org/:repo/:issue)
 * Session IDs contain colons which need special handling
 */
browser.get('/:sessionId{browser:.+}', async (c) => {
  const sessionId = c.req.param('sessionId')
  const env = c.env

  try {
    const stored = await getStoredSession(sessionId, env)
    if (!stored) {
      return c.json({ error: 'session_not_found' }, 404)
    }

    const provider = createBrowserProvider(stored.provider, env)
    const session = await provider.getSession(sessionId)

    if (!session) {
      return c.json({ error: 'session_not_found' }, 404)
    }

    // Include recording for completed browserbase sessions
    let recording = null
    if (session.status === 'completed' && session.provider === 'browserbase') {
      recording = await provider.getRecording(sessionId)
    }

    return c.json({ session, recording })
  } catch (error) {
    console.error('[Browser API] Failed to get session:', error)
    return c.json({
      error: 'session_fetch_failed',
      message: (error as Error).message,
    }, 500)
  }
})

/**
 * POST /:sessionId/release - Release a running session
 */
browser.post('/:sessionId{browser:.+}/release', async (c) => {
  const sessionId = c.req.param('sessionId')
  const env = c.env

  try {
    const stored = await getStoredSession(sessionId, env)
    if (!stored) {
      return c.json({ error: 'session_not_found' }, 404)
    }

    const provider = createBrowserProvider(stored.provider, env)
    await provider.releaseSession(sessionId)

    return c.json({ success: true })
  } catch (error) {
    console.error('[Browser API] Failed to release session:', error)
    return c.json({
      error: 'session_release_failed',
      message: (error as Error).message,
    }, 500)
  }
})

/**
 * DELETE /:sessionId - Delete session from KV
 */
browser.delete('/:sessionId{browser:.+}', async (c) => {
  const sessionId = c.req.param('sessionId')
  const env = c.env

  try {
    if (env.OAUTH_KV) {
      await env.OAUTH_KV.delete(sessionId)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('[Browser API] Failed to delete session:', error)
    return c.json({
      error: 'session_delete_failed',
      message: (error as Error).message,
    }, 500)
  }
})

/**
 * Helper to get stored session from KV
 */
async function getStoredSession(
  sessionId: string,
  env: Env
): Promise<StoredSession | null> {
  if (!env.OAUTH_KV) return null

  const data = await env.OAUTH_KV.get(sessionId)
  if (!data) return null

  return JSON.parse(data)
}
