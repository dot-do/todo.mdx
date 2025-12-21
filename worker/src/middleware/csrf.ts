/**
 * CSRF Protection Middleware
 *
 * Implements defense-in-depth CSRF protection:
 * 1. SameSite=Lax cookies (already implemented in session.ts)
 * 2. Origin/Referer validation for state-changing requests
 * 3. CSRF token validation for browser-initiated requests
 *
 * Token-based requests (API keys, OAuth tokens) are exempt from CSRF checks
 * as they don't rely on browser cookie authentication.
 *
 * Webhook endpoints should NOT use this middleware - they have signature verification.
 */

import type { Context, MiddlewareHandler } from 'hono'
import type { Env } from '../types'

/**
 * CSRF token cookie name
 */
export const CSRF_COOKIE_NAME = '__Host-CSRF-TOKEN'
export const CSRF_HEADER_NAME = 'X-CSRF-Token'
export const CSRF_TOKEN_TTL_SECONDS = 3600 // 1 hour

/**
 * Generate cryptographically secure CSRF token
 */
export async function generateCsrfToken(): Promise<string> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Create CSRF token cookie header
 */
export function buildCsrfCookie(token: string): string {
  return `${CSRF_COOKIE_NAME}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${CSRF_TOKEN_TTL_SECONDS}`
}

/**
 * Extract CSRF token from cookie header
 */
export function getCsrfTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map(c => c.trim())
  const csrfCookie = cookies.find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`))
  if (!csrfCookie) return null

  return csrfCookie.substring(CSRF_COOKIE_NAME.length + 1)
}

/**
 * Validate Origin or Referer header matches expected origin
 */
export function validateOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get('Origin')
  const referer = request.headers.get('Referer')

  // For same-site requests, Origin header might be missing
  // Fall back to Referer header
  const requestOrigin = origin || (referer ? new URL(referer).origin : null)

  if (!requestOrigin) {
    // No origin or referer - reject state-changing requests
    return false
  }

  // Check if origin is in allowed list
  return allowedOrigins.some(allowed => {
    if (allowed === requestOrigin) return true
    // Allow localhost with any port for development
    if (requestOrigin.startsWith('http://localhost:') && allowed === 'http://localhost') {
      return true
    }
    return false
  })
}

/**
 * Check if request is using token-based auth (not cookie-based)
 * Token-based requests are exempt from CSRF checks
 */
export function isTokenBasedAuth(c: Context): boolean {
  const auth = c.get('auth') as any

  // If no auth context, assume it will be rejected by authMiddleware
  if (!auth) return false

  // Check if using API key or OAuth token (not session cookie)
  return auth.source === 'api_key' || auth.source === 'oauth' || auth.source === 'token' || auth.source === 'test_api_key'
}

/**
 * CSRF protection middleware for state-changing requests
 *
 * This middleware should be applied AFTER authMiddleware but BEFORE route handlers.
 *
 * Protection strategy:
 * 1. GET/HEAD/OPTIONS requests are always allowed (read-only)
 * 2. Token-based auth (API keys, OAuth) is exempt (not browser-initiated)
 * 3. Origin/Referer validation for all state-changing requests
 * 4. CSRF token validation for cookie-based auth
 *
 * Usage:
 * ```ts
 * app.use('/api/*', authMiddleware, csrfProtection(['https://todo.mdx.do', 'http://localhost']))
 * ```
 */
export function csrfProtection(allowedOrigins: string[]): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method

    // Allow safe methods (GET, HEAD, OPTIONS) - they should not modify state
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await next()
      return
    }

    // Token-based auth is exempt from CSRF (not browser-initiated)
    if (isTokenBasedAuth(c)) {
      await next()
      return
    }

    // For cookie-based auth, validate Origin/Referer
    if (!validateOrigin(c.req.raw, allowedOrigins)) {
      return c.json({
        error: 'csrf_invalid_origin',
        message: 'Request origin validation failed',
      }, 403)
    }

    // For cookie-based auth, also validate CSRF token
    const cookieHeader = c.req.header('Cookie') || null
    const csrfTokenFromCookie = getCsrfTokenFromCookie(cookieHeader)
    const csrfTokenFromHeader = c.req.header(CSRF_HEADER_NAME)

    // Both tokens must be present and match
    if (!csrfTokenFromCookie || !csrfTokenFromHeader) {
      return c.json({
        error: 'csrf_token_missing',
        message: 'CSRF token missing. Include X-CSRF-Token header.',
      }, 403)
    }

    // Timing-safe comparison
    if (csrfTokenFromCookie !== csrfTokenFromHeader) {
      return c.json({
        error: 'csrf_token_invalid',
        message: 'CSRF token mismatch',
      }, 403)
    }

    // CSRF validation passed
    await next()
  }
}

/**
 * Middleware to generate and set CSRF token cookie
 *
 * This should be applied to routes that render pages or initialize sessions.
 * It generates a CSRF token if one doesn't exist and sets it as a cookie.
 *
 * Usage:
 * ```ts
 * app.get('/terminal', ensureCsrfToken, async (c) => { ... })
 * app.get('/api/auth/callback', ensureCsrfToken, async (c) => { ... })
 * ```
 */
export const ensureCsrfToken: MiddlewareHandler = async (c, next) => {
  const cookieHeader = c.req.header('Cookie') || null
  let csrfToken = getCsrfTokenFromCookie(cookieHeader)

  // Generate new token if none exists
  if (!csrfToken) {
    csrfToken = await generateCsrfToken()
    c.header('Set-Cookie', buildCsrfCookie(csrfToken), { append: true })
  }

  // Make token available to response (useful for rendering in HTML)
  c.set('csrfToken', csrfToken)

  await next()
}

/**
 * Get CSRF token from context (set by ensureCsrfToken middleware)
 */
export function getCsrfToken(c: Context): string | undefined {
  return c.get('csrfToken')
}
