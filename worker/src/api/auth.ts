/**
 * Unified Auth API
 *
 * Provides login/logout endpoints that work across all services:
 * - Browser access (dashboard, embed pages)
 * - API access (via session cookie)
 * - WebSocket access (via token derived from session)
 *
 * Routes:
 * - GET /api/auth/login - Redirect to WorkOS AuthKit
 * - GET /api/auth/callback - Handle OAuth callback, set session cookie
 * - GET /api/auth/logout - Clear session cookie
 * - GET /api/auth/me - Get current user info
 */

import { Hono } from 'hono'
import { WorkOS } from '@workos-inc/node'
import {
  createSession,
  getSessionFromRequest,
  buildSetSessionCookie,
  buildClearSessionCookie,
  createSessionToken,
  SESSION_TTL_SECONDS,
} from '../auth/session'
import { generateCsrfToken, buildCsrfCookie } from '../middleware/csrf'
import { createDirectDb } from '../db/direct'
import type { Env } from '../types'

const app = new Hono<{ Bindings: Env }>()

/**
 * GET /api/auth/login
 * Initiate WorkOS AuthKit login flow
 *
 * Query params:
 *   - return: URL to redirect back to after login (default: /)
 */
app.get('/login', async (c) => {
  const url = new URL(c.req.url)
  const returnUrl = url.searchParams.get('return') || '/'

  // Validate return URL is same-origin to prevent open redirect
  let validReturnUrl = '/'
  try {
    const returnUrlParsed = new URL(returnUrl, url.origin)
    if (returnUrlParsed.origin === url.origin) {
      validReturnUrl = returnUrlParsed.pathname + returnUrlParsed.search
    }
  } catch {
    // Invalid URL, use default
  }

  // Store return URL in OAuth state
  const state = btoa(JSON.stringify({ returnUrl: validReturnUrl }))

  // Redirect to WorkOS AuthKit
  const workOS = new WorkOS(c.env.WORKOS_API_KEY)
  const authUrl = workOS.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId: c.env.WORKOS_CLIENT_ID,
    redirectUri: `${url.origin}/api/auth/callback`,
    state,
  })

  return c.redirect(authUrl)
})

/**
 * GET /api/auth/callback
 * Handle WorkOS AuthKit callback, set session cookie, redirect to return URL
 */
app.get('/callback', async (c) => {
  const url = new URL(c.req.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    const errorDescription = url.searchParams.get('error_description') || 'Authentication failed'
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Login Error</title></head>
        <body style="background:#1e1e1e;color:#f44;font-family:system-ui,sans-serif;padding:40px;text-align:center;">
          <h2>Login Error</h2>
          <p>${errorDescription}</p>
          <a href="/api/auth/login" style="color:#0dbc79;">Try again</a>
        </body>
      </html>
    `, 400)
  }

  if (!code) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Login Error</title></head>
        <body style="background:#1e1e1e;color:#f44;font-family:system-ui,sans-serif;padding:40px;text-align:center;">
          <h2>Login Error</h2>
          <p>Missing authorization code. Please try again.</p>
          <a href="/api/auth/login" style="color:#0dbc79;">Try again</a>
        </body>
      </html>
    `, 400)
  }

  // Parse return URL from state
  let returnUrl = '/'
  if (stateParam) {
    try {
      const state = JSON.parse(atob(stateParam))
      returnUrl = state.returnUrl || returnUrl
    } catch {
      // Invalid state, use default
    }
  }

  // Exchange code for user info
  try {
    const workOS = new WorkOS(c.env.WORKOS_API_KEY)
    const authResult = await workOS.userManagement.authenticateWithCode({
      clientId: c.env.WORKOS_CLIENT_ID,
      code,
    })

    const user = authResult.user

    // Ensure user exists in database (create or update)
    try {
      const db = createDirectDb(c.env)
      const existingUser = await db.users.findByWorkosUserId(user.id)

      if (!existingUser) {
        // Create new user
        await db.users.create({
          email: user.email,
          workosUserId: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        })
        console.log(`[Auth] Created user for WorkOS user ${user.id}`)
      }
    } catch (err) {
      console.error('[Auth] Failed to sync user to database:', err)
      // Continue with login even if sync fails
    }

    // Create session
    const session = createSession(user, authResult.organizationId)

    // Build session cookie
    const sessionCookie = await buildSetSessionCookie(session, c.env.COOKIE_ENCRYPTION_KEY)

    // Generate CSRF token for the new session
    const csrfToken = await generateCsrfToken()
    const csrfCookie = buildCsrfCookie(csrfToken)

    // Redirect back with cookies set
    const headers = new Headers()
    headers.append('Location', returnUrl)
    headers.append('Set-Cookie', sessionCookie)
    headers.append('Set-Cookie', csrfCookie)

    return new Response(null, {
      status: 302,
      headers,
    })
  } catch (err) {
    console.error('[Auth] Callback error:', err)
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Login Error</title></head>
        <body style="background:#1e1e1e;color:#f44;font-family:system-ui,sans-serif;padding:40px;text-align:center;">
          <h2>Login Error</h2>
          <p>Failed to complete authentication. Please try again.</p>
          <a href="/api/auth/login" style="color:#0dbc79;">Try again</a>
        </body>
      </html>
    `, 500)
  }
})

/**
 * GET /api/auth/logout
 * Clear session cookie and redirect
 *
 * Query params:
 *   - return: URL to redirect to after logout (default: /)
 */
app.get('/logout', async (c) => {
  const url = new URL(c.req.url)
  let returnUrl = url.searchParams.get('return') || '/'

  // Validate return URL
  try {
    const returnUrlParsed = new URL(returnUrl, url.origin)
    if (returnUrlParsed.origin === url.origin) {
      returnUrl = returnUrlParsed.pathname + returnUrlParsed.search
    } else {
      returnUrl = '/'
    }
  } catch {
    returnUrl = '/'
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': returnUrl,
      'Set-Cookie': buildClearSessionCookie(),
    },
  })
})

/**
 * GET /api/auth/me
 * Get current user info from session
 *
 * Returns:
 * - 200 with user info if authenticated
 * - 401 if not authenticated
 */
app.get('/me', async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY)

  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  return c.json({
    userId: session.userId,
    email: session.email,
    name: session.name,
    organizationId: session.organizationId,
  })
})

/**
 * GET /api/auth/token
 * Get a signed session token (for WebSocket connections)
 *
 * The token has the same expiration as the session.
 * This allows clients to pass auth to WebSocket connections.
 */
app.get('/token', async (c) => {
  const session = await getSessionFromRequest(c.req.raw, c.env.COOKIE_ENCRYPTION_KEY)

  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401)
  }

  // Create a fresh token with current session data
  const token = await createSessionToken(session, c.env.COOKIE_ENCRYPTION_KEY)

  return c.json({
    token,
    expiresAt: session.exp,
    expiresIn: Math.floor((session.exp - Date.now()) / 1000),
  })
})

export default app
