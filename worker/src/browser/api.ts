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
 *
 * Security:
 * - Issue-scoped routes require repo access verification via getUserRepos()
 * - Session-scoped routes verify ownership via userId stored with session
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { Context } from 'hono'
import type { Env } from '../types/env'
import type { CreateSessionOptions, BrowserSession, StoredSession } from '../types/browser'
import { getBrowserProvider, selectProvider, createBrowserProvider } from './provider'

/**
 * Get the authenticated userId from context (set by authMiddleware)
 */
function getAuthUserId(c: Context): string | null {
  const auth = c.get('auth')
  return auth?.userId ?? null
}

/**
 * Get repos the authenticated user has access to via D1
 * Adapted from worker/src/mcp/tool-handler.ts
 */
async function getUserRepos(env: Env, userId: string): Promise<Array<{ owner: string; name: string; fullName: string }>> {
  const db = env.DB
  if (!db) return []

  try {
    const result = await db.prepare(`
      SELECT r.id, r.github_id, r.name, r.full_name as fullName, r.owner, r.private, r.installation_id
      FROM repos r
      INNER JOIN installations i ON r.installation_id = i.id
      INNER JOIN installations_rels ir ON ir.parent_id = i.id AND ir.path = 'users'
      INNER JOIN users u ON ir.users_id = u.id
      WHERE u.workos_user_id = ?
      LIMIT 100
    `).bind(userId).all<{ owner: string; name: string; fullName: string }>()

    return result.results || []
  } catch (error) {
    console.error('[Browser API] getUserRepos failed:', error)
    return []
  }
}

/**
 * Check if user has access to a specific repo
 */
async function userHasRepoAccess(env: Env, userId: string, owner: string, repo: string): Promise<boolean> {
  const repos = await getUserRepos(env, userId)
  return repos.some(r => r.owner === owner && r.name === repo)
}

/**
 * Validation schemas for browser API inputs
 */

// CreateSessionOptions schema
const CreateSessionOptionsSchema = z.object({
  timeout: z.number().min(1000).max(3600000).optional(),
  provider: z.enum(['cloudflare', 'browserbase']).optional(),
  contextId: z.string().max(256).optional(),
  keepAlive: z.boolean().optional(),
  userMetadata: z.record(z.string()).optional(),
}).strict()

// Path param validation for org/repo (alphanumeric, hyphens, underscores, dots)
const orgRepoPattern = /^[a-zA-Z0-9][-a-zA-Z0-9_.]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/

// Issue number must be a positive integer
const issuePattern = /^[1-9][0-9]*$/

interface PathValidationSuccess {
  valid: true
}

interface PathValidationError {
  valid: false
  message: string
}

type PathValidationResult = PathValidationSuccess | PathValidationError

interface SessionOptionsValidationSuccess {
  valid: true
  options: CreateSessionOptions
}

interface SessionOptionsValidationError {
  valid: false
  message: string
}

type SessionOptionsValidationResult = SessionOptionsValidationSuccess | SessionOptionsValidationError

/**
 * Validate org/repo/issue path params
 */
function validatePathParams(
  org: string,
  repo: string,
  issue: string
): PathValidationResult {
  if (!orgRepoPattern.test(org)) {
    return { valid: false, message: `Invalid org format: ${org}. Must be alphanumeric with hyphens, underscores, or dots.` }
  }
  if (!orgRepoPattern.test(repo)) {
    return { valid: false, message: `Invalid repo format: ${repo}. Must be alphanumeric with hyphens, underscores, or dots.` }
  }
  if (!issuePattern.test(issue)) {
    return { valid: false, message: `Invalid issue format: ${issue}. Must be a positive integer.` }
  }
  return { valid: true }
}

/**
 * Validate and parse CreateSessionOptions from request body
 */
function validateSessionOptions(body: unknown): SessionOptionsValidationResult {
  const result = CreateSessionOptionsSchema.safeParse(body)
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return { valid: false, message: errors }
  }
  return { valid: true, options: result.data as CreateSessionOptions }
}

export const browser = new Hono<{ Bindings: Env }>()

/**
 * POST /start - Create a new standalone browser session
 */
browser.post('/start', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const env = c.env
  const userId = getAuthUserId(c)

  // Validate request body
  const validation = validateSessionOptions(body)
  if (!validation.valid) {
    return c.json({
      error: 'validation_error',
      message: (validation as SessionOptionsValidationError).message,
    }, 400)
  }

  try {
    // Add userId to options for ownership tracking
    const options: CreateSessionOptions = {
      ...(validation as SessionOptionsValidationSuccess).options,
      userId: userId ?? undefined,
    }

    const provider = getBrowserProvider(env, options)
    const session = await provider.createSession(options)

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
 * Requires authorization: user must have access to the repo
 */
browser.post('/:org/:repo/:issue/start', async (c) => {
  const { org, repo, issue } = c.req.param()
  const env = c.env
  const userId = getAuthUserId(c)

  // Require authentication for issue-scoped sessions
  if (!userId) {
    return c.json({
      error: 'unauthorized',
      message: 'Authentication required for issue-scoped sessions',
    }, 401)
  }

  // Validate path params
  const pathValidation = validatePathParams(org, repo, issue)
  if (!pathValidation.valid) {
    return c.json({
      error: 'validation_error',
      message: (pathValidation as PathValidationError).message,
    }, 400)
  }

  // Authorization check: verify user has access to this repo
  const hasAccess = await userHasRepoAccess(env, userId, org, repo)
  if (!hasAccess) {
    return c.json({
      error: 'forbidden',
      message: `You do not have access to ${org}/${repo}`,
    }, 403)
  }

  const contextId = `${org}/${repo}#${issue}`
  const sessionId = `browser:${contextId}`

  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const bodyValidation = validateSessionOptions(body)
  if (!bodyValidation.valid) {
    return c.json({
      error: 'validation_error',
      message: (bodyValidation as SessionOptionsValidationError).message,
    }, 400)
  }

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

    // Create new session with issue context and userId for ownership
    const options: CreateSessionOptions = {
      ...(bodyValidation as SessionOptionsValidationSuccess).options,
      contextId,
      userId,
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
 * Requires authorization: user must have access to the repo
 */
browser.get('/:org/:repo/:issue', async (c) => {
  const { org, repo, issue } = c.req.param()
  const env = c.env
  const userId = getAuthUserId(c)

  // Avoid matching release route
  if (repo === undefined || issue === undefined) {
    return c.notFound()
  }

  // Require authentication for issue-scoped sessions
  if (!userId) {
    return c.json({
      error: 'unauthorized',
      message: 'Authentication required for issue-scoped sessions',
    }, 401)
  }

  // Validate path params
  const pathValidation = validatePathParams(org, repo, issue)
  if (!pathValidation.valid) {
    return c.json({
      error: 'validation_error',
      message: (pathValidation as PathValidationError).message,
    }, 400)
  }

  // Authorization check: verify user has access to this repo
  const hasAccess = await userHasRepoAccess(env, userId, org, repo)
  if (!hasAccess) {
    return c.json({
      error: 'forbidden',
      message: `You do not have access to ${org}/${repo}`,
    }, 403)
  }

  const contextId = `${org}/${repo}#${issue}`
  const sessionId = `browser:${contextId}`

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
 * Ownership verification: only session owner can access
 */
browser.get('/:sessionId{browser:.+}', async (c) => {
  const sessionId = c.req.param('sessionId')
  const env = c.env
  const userId = getAuthUserId(c)

  try {
    const stored = await getStoredSession(sessionId, env)
    if (!stored) {
      return c.json({ error: 'session_not_found' }, 404)
    }

    // Ownership check: if session has userId, verify it matches requesting user
    // Legacy sessions without userId are accessible (backward compatibility)
    if (stored.userId && stored.userId !== userId) {
      return c.json({
        error: 'forbidden',
        message: 'You do not own this session',
      }, 403)
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
 * Ownership verification: only session owner can release
 */
browser.post('/:sessionId{browser:.+}/release', async (c) => {
  const sessionId = c.req.param('sessionId')
  const env = c.env
  const userId = getAuthUserId(c)

  try {
    const stored = await getStoredSession(sessionId, env)
    if (!stored) {
      return c.json({ error: 'session_not_found' }, 404)
    }

    // Ownership check: if session has userId, verify it matches requesting user
    // Legacy sessions without userId are accessible (backward compatibility)
    if (stored.userId && stored.userId !== userId) {
      return c.json({
        error: 'forbidden',
        message: 'You do not own this session',
      }, 403)
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
 * Ownership verification: only session owner can delete
 */
browser.delete('/:sessionId{browser:.+}', async (c) => {
  const sessionId = c.req.param('sessionId')
  const env = c.env
  const userId = getAuthUserId(c)

  try {
    // Check ownership before delete
    const stored = await getStoredSession(sessionId, env)
    if (stored && stored.userId && stored.userId !== userId) {
      return c.json({
        error: 'forbidden',
        message: 'You do not own this session',
      }, 403)
    }

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
