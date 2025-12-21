/**
 * Unified Session Cookie Management
 *
 * Provides a single session cookie for all authentication:
 * - Browser access (embed pages, dashboard)
 * - API access (via cookie or extracted token for WebSockets)
 * - MCP server (OAuth 2.1 remains separate for MCP clients)
 *
 * Security:
 * - __Host- prefix (requires Secure, Path=/, no Domain)
 * - HttpOnly (no JavaScript access)
 * - Secure (HTTPS only)
 * - SameSite=Lax (CSRF protection)
 * - HMAC-SHA256 signed (tamper-proof)
 */

// Session cookie name - shared across all endpoints
export const SESSION_COOKIE_NAME = '__Host-SESSION'
export const SESSION_TTL_SECONDS = 86400 * 7 // 7 days

export interface SessionData {
  userId: string
  email: string
  name?: string
  organizationId?: string
  exp: number // Expiration timestamp (ms)
}

/**
 * Sign data with HMAC-SHA256
 */
async function signData(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verify HMAC signature
 */
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const sigBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
    return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
  } catch {
    return false
  }
}

/**
 * Create signed session token value
 * Can be used as cookie value or passed to WebSocket
 */
export async function createSessionToken(session: SessionData, secret: string): Promise<string> {
  const payload = JSON.stringify(session)
  const encoded = btoa(payload)
  const signature = await signData(payload, secret)
  return `${signature}.${encoded}`
}

/**
 * Parse and verify session token
 */
export async function parseSessionToken(token: string, secret: string): Promise<SessionData | null> {
  try {
    const dotIndex = token.indexOf('.')
    if (dotIndex === -1) return null

    const signature = token.substring(0, dotIndex)
    const encoded = token.substring(dotIndex + 1)

    const payload = atob(encoded)
    const isValid = await verifySignature(payload, signature, secret)
    if (!isValid) return null

    const session = JSON.parse(payload) as SessionData

    // Check expiration
    if (session.exp < Date.now()) return null

    return session
  } catch {
    return null
  }
}

/**
 * Get session from cookie header
 */
export async function getSessionFromRequest(request: Request, secret: string): Promise<SessionData | null> {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map(c => c.trim())
  const sessionCookie = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`))
  if (!sessionCookie) return null

  const value = sessionCookie.substring(SESSION_COOKIE_NAME.length + 1)
  return parseSessionToken(value, secret)
}

/**
 * Build Set-Cookie header to create session
 */
export async function buildSetSessionCookie(session: SessionData, secret: string): Promise<string> {
  const value = await createSessionToken(session, secret)
  return `${SESSION_COOKIE_NAME}=${value}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
}

/**
 * Build Set-Cookie header to clear session
 */
export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`
}

/**
 * Create a new session from WorkOS user data
 */
export function createSession(user: {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}, organizationId?: string): SessionData {
  const name = user.firstName || user.lastName
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
    : undefined

  return {
    userId: user.id,
    email: user.email,
    name,
    organizationId,
    exp: Date.now() + (SESSION_TTL_SECONDS * 1000),
  }
}
