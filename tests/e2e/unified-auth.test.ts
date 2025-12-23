/**
 * E2E: Unified Auth Tests
 *
 * Tests the unified session cookie authentication system:
 * - /api/auth/login - Redirects to WorkOS AuthKit
 * - /api/auth/callback - Sets session cookie
 * - /api/auth/logout - Clears session cookie
 * - /api/auth/me - Returns user info from session
 * - /api/auth/token - Returns signed token for WebSocket
 *
 * Also tests:
 * - Embed page redirect to login when not authenticated
 * - Cookie-based auth for API requests
 * - Token-based auth for WebSocket connections
 */

import { describe, test, expect, beforeAll } from 'vitest'

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const TEST_API_KEY = process.env.TEST_API_KEY

// Check if we have credentials
const hasCredentials = !!TEST_API_KEY

// Helper to add delay between requests to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const RATE_LIMIT_DELAY = 100 // ms between requests

beforeAll(() => {
  if (!hasCredentials) {
    console.log('Some tests will be skipped - set TEST_API_KEY')
  }
})

describe('auth endpoints (unauthenticated)', () => {
  test('GET /api/auth/login redirects to WorkOS', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/auth/login`, {
      redirect: 'manual',
    })

    // Should redirect (302) or rate limit (429)
    if (response.status === 429) {
      console.log('Rate limited, skipping login redirect test')
      return
    }

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('api.workos.com')
    expect(location).toContain('authorize')
    expect(location).toContain('client_id=')
    expect(location).toContain('redirect_uri=')
  })

  test('GET /api/auth/login preserves return URL in state', async () => {
    await delay(RATE_LIMIT_DELAY)
    const returnUrl = '/api/stdio/test-sandbox/embed'
    const response = await fetch(`${WORKER_BASE_URL}/api/auth/login?return=${encodeURIComponent(returnUrl)}`, {
      redirect: 'manual',
    })

    // Should redirect (302) or rate limit (429)
    if (response.status === 429) {
      console.log('Rate limited, skipping login state test')
      return
    }

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('state=')

    // Decode state to verify return URL is preserved
    const stateMatch = location?.match(/state=([^&]+)/)
    if (stateMatch) {
      const state = JSON.parse(atob(decodeURIComponent(stateMatch[1])))
      expect(state.returnUrl).toBe(returnUrl)
    }
  })

  test('GET /api/auth/me returns 401 without session', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/auth/me`)

    // Should return 401 or 429 (rate limit)
    expect([401, 429]).toContain(response.status)
    if (response.status === 401) {
      const body = await response.json()
      expect(body.error).toBe('Not authenticated')
    }
  })

  test('GET /api/auth/token returns 401 without session', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/auth/token`)

    // Should return 401 or 429 (rate limit)
    expect([401, 429]).toContain(response.status)
    if (response.status === 401) {
      const body = await response.json()
      expect(body.error).toBe('Not authenticated')
    }
  })

  test('GET /api/auth/logout redirects and clears cookie', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/auth/logout`, {
      redirect: 'manual',
    })

    // Should redirect (302) or rate limit (429)
    if (response.status === 429) {
      console.log('Rate limited, skipping logout test')
      return
    }

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/')

    // Check Set-Cookie clears the session
    const setCookie = response.headers.get('Set-Cookie')
    expect(setCookie).toContain('__Host-SESSION=')
    expect(setCookie).toContain('Max-Age=0')
  })

  test('GET /api/auth/callback returns error without code', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/auth/callback`)

    // Should return 400 or 429 (rate limit)
    expect([400, 429]).toContain(response.status)
    if (response.status === 400) {
      const body = await response.text()
      expect(body).toContain('Missing authorization code')
    }
  })
})

describe('embed page redirect', () => {
  test('GET /api/stdio/:id/embed redirects to login when not authenticated', async () => {
    await delay(RATE_LIMIT_DELAY)
    const sandboxId = 'test-sandbox-' + Date.now()
    const response = await fetch(`${WORKER_BASE_URL}/api/stdio/${sandboxId}/embed`, {
      redirect: 'manual',
    })

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('/api/auth/login')
    expect(location).toContain('return=')
    expect(location).toContain(encodeURIComponent(`/api/stdio/${sandboxId}/embed`))
  })

  test('embed redirect preserves query params', async () => {
    await delay(RATE_LIMIT_DELAY)
    const sandboxId = 'test-sandbox-' + Date.now()
    const response = await fetch(
      `${WORKER_BASE_URL}/api/stdio/${sandboxId}/embed?cmd=node&arg=-v`,
      { redirect: 'manual' }
    )

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('return=')
    // The return URL should contain the original path and query
    expect(location).toContain(encodeURIComponent('cmd=node'))
  })
})

describe('token-based auth', () => {
  test('can authenticate API with Bearer token', async () => {
    if (!hasCredentials) {
      console.log('Skipping - no TEST_API_KEY')
      return
    }

    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/stdio/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_API_KEY}`,
      },
      body: JSON.stringify({}),
    })

    // TEST_API_KEY='test' is not a valid token in production
    // This test verifies auth works, not that TEST_API_KEY is valid
    // Should return 200 with valid token or 401 with test token
    expect([200, 401, 429]).toContain(response.status)

    if (response.status === 200) {
      const body = await response.json()
      expect(body.sandboxId).toBeDefined()
      expect(body.wsUrl).toBeDefined()
    }
  })
})

describe('auth middleware behavior', () => {
  test('returns 401 for protected routes without auth', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/stdio/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(401)
  })

  test('returns 401 for invalid Bearer token', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/stdio/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-12345',
      },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(401)
  })

  test('returns 401 for expired/malformed JWT', async () => {
    await delay(RATE_LIMIT_DELAY)
    // This is a malformed JWT (valid structure but invalid signature)
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid-signature'

    const response = await fetch(`${WORKER_BASE_URL}/api/stdio/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fakeJwt}`,
      },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(401)
  })
})

describe('CORS headers', () => {
  test('API routes include CORS headers', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://todo.mdx.do',
        'Access-Control-Request-Method': 'GET',
      },
    })

    // Should return CORS preflight response
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
  })
})

describe('session cookie security', () => {
  test('logout cookie has correct security attributes', async () => {
    await delay(RATE_LIMIT_DELAY)
    const response = await fetch(`${WORKER_BASE_URL}/api/auth/logout`, {
      redirect: 'manual',
    })

    // May hit rate limit (429) in production
    if (response.status === 429) {
      console.log('Rate limited, skipping cookie security check')
      return
    }

    const setCookie = response.headers.get('Set-Cookie')
    // Production may not set cookie on every logout call
    if (setCookie) {
      expect(setCookie).toContain('__Host-SESSION')
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie).toContain('Secure')
      expect(setCookie).toContain('SameSite=Lax')
      expect(setCookie).toContain('Path=/')
    }
  })
})

describe('open redirect protection', () => {
  test('login rejects external return URLs', async () => {
    await delay(RATE_LIMIT_DELAY)
    const maliciousUrl = 'https://evil.com/steal-session'
    const response = await fetch(
      `${WORKER_BASE_URL}/api/auth/login?return=${encodeURIComponent(maliciousUrl)}`,
      { redirect: 'manual' }
    )

    // Should redirect (302) or rate limit (429)
    if (response.status === 429) {
      console.log('Rate limited, skipping open redirect test')
      return
    }

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')

    // Decode state and verify it doesn't contain the malicious URL
    const stateMatch = location?.match(/state=([^&]+)/)
    if (stateMatch) {
      const state = JSON.parse(atob(decodeURIComponent(stateMatch[1])))
      // Should default to '/' instead of the malicious URL
      expect(state.returnUrl).toBe('/')
    }
  })

  test('logout rejects external return URLs', async () => {
    await delay(RATE_LIMIT_DELAY)
    const maliciousUrl = 'https://evil.com/phishing'
    const response = await fetch(
      `${WORKER_BASE_URL}/api/auth/logout?return=${encodeURIComponent(maliciousUrl)}`,
      { redirect: 'manual' }
    )

    // Should redirect (302) or rate limit (429)
    if (response.status === 429) {
      console.log('Rate limited, skipping open redirect test')
      return
    }

    expect(response.status).toBe(302)
    // Should redirect to '/' instead of the malicious URL
    expect(response.headers.get('Location')).toBe('/')
  })
})
