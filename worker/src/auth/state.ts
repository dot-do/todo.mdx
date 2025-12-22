/**
 * OAuth State Signing Utilities
 *
 * Signs and validates OAuth state parameters to prevent CSRF and state injection attacks.
 * Uses HMAC-SHA256 for signature generation/verification.
 */

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Create a signed state parameter for OAuth flows
 * Format: base64url(JSON({userId, ts})).signature
 */
export async function createSignedState(
  data: { userId?: string; [key: string]: unknown },
  secret: string
): Promise<string> {
  const payload = {
    ...data,
    ts: Date.now(),
  }

  const payloadStr = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  const signature = await signPayload(payloadStr, secret)

  return `${payloadStr}.${signature}`
}

/**
 * Validate and parse a signed state parameter
 * Returns null if invalid or expired
 */
export async function validateSignedState(
  state: string,
  secret: string
): Promise<{ userId?: string; [key: string]: unknown } | null> {
  if (!state || typeof state !== 'string') {
    return null
  }

  const parts = state.split('.')
  if (parts.length !== 2) {
    return null
  }

  const [payloadStr, signature] = parts

  // Verify signature
  const expectedSignature = await signPayload(payloadStr, secret)
  if (!timingSafeEqual(signature, expectedSignature)) {
    console.warn('[OAuth State] Invalid signature')
    return null
  }

  // Decode and parse payload
  try {
    // Convert base64url back to standard base64
    const base64 = payloadStr.replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(atob(base64 + padding))

    // Check expiration
    if (typeof payload.ts !== 'number' || Date.now() - payload.ts > STATE_TTL_MS) {
      console.warn('[OAuth State] Expired state')
      return null
    }

    return payload
  } catch (e) {
    console.warn('[OAuth State] Failed to parse payload:', e)
    return null
  }
}

/**
 * Generate HMAC-SHA256 signature for a payload
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))

  // Convert to base64url
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
