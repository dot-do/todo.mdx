/**
 * Authentication Middleware
 * Supports both OAuth tokens (from oauth.do) and WorkOS API keys
 */

import type { Context, Next } from 'hono'
import { validateOAuthToken, type OAuthSession } from './jwt.js'
import { validateApiKey, type ApiKeySession } from './workos.js'

export type AuthType = 'oauth' | 'api_key'

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
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized', message: 'Missing bearer token' }, 401)
  }

  const token = authHeader.slice(7)

  // Check for WorkOS API key (starts with sk_live_ or sk_test_)
  if (token.startsWith('sk_live_') || token.startsWith('sk_test_')) {
    try {
      const session = await validateApiKey(token, c.env as any)

      c.set('auth', {
        userId: session.userId,
        authType: 'api_key',
        organizationId: session.organizationId,
        keyName: session.keyName,
      })

      return next()
    } catch (error) {
      return c.json({ error: 'invalid_api_key', message: (error as Error).message }, 401)
    }
  }

  // Otherwise treat as OAuth token from oauth.do
  try {
    const session = await validateOAuthToken(token, c.env as any)

    c.set('auth', {
      userId: session.userId,
      authType: 'oauth',
      email: session.email,
      scopes: session.scopes,
    })

    return next()
  } catch (error) {
    return c.json({ error: 'invalid_token', message: (error as Error).message }, 401)
  }
}

// Optional auth - sets auth context if token present, but doesn't require it
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return next()
  }

  // Try to authenticate but don't fail if it doesn't work
  try {
    const token = authHeader.slice(7)

    if (token.startsWith('sk_live_') || token.startsWith('sk_test_')) {
      const session = await validateApiKey(token, c.env as any)
      c.set('auth', {
        userId: session.userId,
        authType: 'api_key',
        organizationId: session.organizationId,
        keyName: session.keyName,
      })
    } else {
      const session = await validateOAuthToken(token, c.env as any)
      c.set('auth', {
        userId: session.userId,
        authType: 'oauth',
        email: session.email,
        scopes: session.scopes,
      })
    }
  } catch {
    // Ignore auth errors for optional auth
  }

  return next()
}
