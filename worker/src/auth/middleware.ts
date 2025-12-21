/**
 * Authentication Middleware
 *
 * Supports multiple auth methods (checked in order):
 * 1. Session cookie (__Host-SESSION) - for browser requests
 * 2. Bearer token (Authorization header):
 *    - WorkOS API key (sk_live_* / sk_test_*)
 *    - OAuth token from oauth.do (JWT)
 *    - Signed session token (from /api/auth/token)
 */

import type { Context, Next } from 'hono'
import { validateOAuthToken, type OAuthSession } from './jwt.js'
import { validateApiKey, type ApiKeySession } from './workos.js'
import { getSessionFromRequest, parseSessionToken } from './session.js'

export type AuthType = 'oauth' | 'api_key' | 'session'

export interface AuthContext {
  userId: string
  authType?: AuthType
  email?: string
  name?: string
  scopes?: string[]
  organizationId?: string
  keyName?: string
  source?: string  // Auth source: oauth, jwt, cookie, workos, session, api_key
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const env = c.env as any

  // 1. Check session cookie first (browser requests)
  if (env.COOKIE_ENCRYPTION_KEY) {
    const session = await getSessionFromRequest(c.req.raw, env.COOKIE_ENCRYPTION_KEY)
    if (session) {
      c.set('auth', {
        userId: session.userId,
        authType: 'session',
        email: session.email,
        name: session.name,
        organizationId: session.organizationId,
        source: 'cookie',
      })
      return next()
    }
  }

  // 2. Check Authorization header
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized', message: 'Authentication required' }, 401)
  }

  const token = authHeader.slice(7)

  // 2a. WorkOS API key (starts with sk_live_ or sk_test_)
  if (token.startsWith('sk_live_') || token.startsWith('sk_test_')) {
    try {
      const session = await validateApiKey(token, env)

      c.set('auth', {
        userId: session.userId,
        authType: 'api_key',
        organizationId: session.organizationId,
        keyName: session.keyName,
        source: 'api_key',
      })

      return next()
    } catch (error) {
      return c.json({ error: 'invalid_api_key', message: (error as Error).message }, 401)
    }
  }

  // 2b. Signed session token (from /api/auth/token, for WebSocket connections)
  if (token.includes('.') && env.COOKIE_ENCRYPTION_KEY) {
    try {
      const session = await parseSessionToken(token, env.COOKIE_ENCRYPTION_KEY)
      if (session) {
        c.set('auth', {
          userId: session.userId,
          authType: 'session',
          email: session.email,
          name: session.name,
          organizationId: session.organizationId,
          source: 'token',
        })
        return next()
      }
    } catch {
      // Not a valid session token, try OAuth
    }
  }

  // 2c. OAuth token from oauth.do (JWT)
  try {
    const session = await validateOAuthToken(token, env)

    c.set('auth', {
      userId: session.userId,
      authType: 'oauth',
      email: session.email,
      source: 'oauth',
    })

    return next()
  } catch (error) {
    return c.json({ error: 'invalid_token', message: (error as Error).message }, 401)
  }
}

// Optional auth - sets auth context if token present, but doesn't require it
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const env = c.env as any

  // Try session cookie first
  if (env.COOKIE_ENCRYPTION_KEY) {
    try {
      const session = await getSessionFromRequest(c.req.raw, env.COOKIE_ENCRYPTION_KEY)
      if (session) {
        c.set('auth', {
          userId: session.userId,
          authType: 'session',
          email: session.email,
          name: session.name,
          organizationId: session.organizationId,
          source: 'cookie',
        })
        return next()
      }
    } catch {
      // Ignore cookie errors
    }
  }

  // Try Authorization header
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return next()
  }

  // Try to authenticate but don't fail if it doesn't work
  try {
    const token = authHeader.slice(7)

    if (token.startsWith('sk_live_') || token.startsWith('sk_test_')) {
      const session = await validateApiKey(token, env)
      c.set('auth', {
        userId: session.userId,
        authType: 'api_key',
        organizationId: session.organizationId,
        keyName: session.keyName,
        source: 'api_key',
      })
    } else if (token.includes('.') && env.COOKIE_ENCRYPTION_KEY) {
      // Try signed session token
      const session = await parseSessionToken(token, env.COOKIE_ENCRYPTION_KEY)
      if (session) {
        c.set('auth', {
          userId: session.userId,
          authType: 'session',
          email: session.email,
          name: session.name,
          organizationId: session.organizationId,
          source: 'token',
        })
      }
    } else {
      const session = await validateOAuthToken(token, env)
      c.set('auth', {
        userId: session.userId,
        authType: 'oauth',
        email: session.email,
        source: 'oauth',
      })
    }
  } catch {
    // Ignore auth errors for optional auth
  }

  return next()
}
