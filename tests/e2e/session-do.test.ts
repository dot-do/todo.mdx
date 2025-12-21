/**
 * E2E: SessionDO Tests
 *
 * Tests the SessionDO token/session storage:
 * - Token hashing handles any length (no KV 512 byte limit)
 * - Session creation and validation
 * - Session expiration
 * - Embed endpoint authentication
 *
 * Requires:
 * - WORKER_BASE_URL (default: https://todo.mdx.do)
 * - TEST_API_KEY for authentication
 */

import { describe, test, expect, afterAll, beforeEach } from 'vitest'
import {
  createSession,
  deleteSession,
  getWorkerBaseUrl,
} from '../helpers/stdio'
import { hasWorkerCredentials } from '../helpers/worker'

// Track created sessions for cleanup
const createdSessions: string[] = []

afterAll(async () => {
  for (const sessionId of createdSessions) {
    try {
      await deleteSession(sessionId)
    } catch {
      // Ignore cleanup errors
    }
  }
})

describe('SessionDO token storage', () => {
  beforeEach((ctx) => {
    if (!hasWorkerCredentials()) ctx.skip()
  })

  test('handles short session IDs', async () => {
    const shortId = 'short'
    const session = await createSession({ sandboxId: shortId })

    expect(session.sandboxId).toBe(shortId)
    expect(session.wsUrl).toContain(shortId)
    createdSessions.push(session.sandboxId)
  })

  test('handles long session IDs', async () => {
    // Create a very long ID that would exceed KV key limit
    const longId = `test-${'x'.repeat(500)}-${Date.now()}`
    const session = await createSession({ sandboxId: longId })

    expect(session.sandboxId).toBe(longId)
    createdSessions.push(session.sandboxId)
  })

  test('handles special characters in session ID', async () => {
    const specialId = `test-special-!@#$%^&*()_+-=${Date.now()}`
    const session = await createSession({ sandboxId: specialId })

    expect(session.sandboxId).toBe(specialId)
    createdSessions.push(session.sandboxId)
  })

  test('session includes user metadata', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    // Fetch session status to verify metadata
    const response = await fetch(`${getWorkerBaseUrl()}/api/stdio/${session.sandboxId}/status`, {
      headers: {
        Authorization: `Bearer ${await getAuthToken()}`,
      },
    })

    expect(response.ok).toBe(true)
    const status = await response.json() as any

    // Should have user info from SessionDO
    expect(status.session).toBeDefined()
    expect(status.session.userId).toBeDefined()
  })

  test('session respects TTL', async () => {
    // Create session with short TTL
    // Note: We can't easily test expiration without waiting,
    // but we verify the session includes expiration metadata
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    expect(session.expiresIn).toBe(3600) // Default 1 hour
  })

  test('deleted session is no longer accessible', async () => {
    const session = await createSession()

    // Delete immediately
    await deleteSession(session.sandboxId)

    // Status should now fail
    const response = await fetch(`${getWorkerBaseUrl()}/api/stdio/${session.sandboxId}/status`, {
      headers: {
        Authorization: `Bearer ${await getAuthToken()}`,
      },
    })

    expect(response.ok).toBe(false)
    expect(response.status).toBe(404)
  })
})

describe('embed endpoint', () => {
  beforeEach((ctx) => {
    if (!hasWorkerCredentials()) ctx.skip()
  })

  test('returns HTML with valid token', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const token = getAuthToken()
    const response = await fetch(
      `${getWorkerBaseUrl()}/api/stdio/${session.sandboxId}/embed?token=${encodeURIComponent(token!)}`,
      { redirect: 'manual' }
    )

    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('text/html')

    const html = await response.text()
    expect(html).toContain('xterm')
    expect(html).toContain('WebSocket')
  })

  test('returns redirect without token', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const response = await fetch(
      `${getWorkerBaseUrl()}/api/stdio/${session.sandboxId}/embed`,
      { redirect: 'manual' }
    )

    // Should return 302 redirect to login page when no token provided
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('/api/auth/login')
  })

  test('returns error with invalid token', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const response = await fetch(
      `${getWorkerBaseUrl()}/api/stdio/${session.sandboxId}/embed?token=invalid-token`
    )

    // Should return 401 for invalid token
    expect(response.status).toBe(401)
    const body = await response.json() as { error: string }
    expect(body.error).toBe('Invalid token')
  })

  test('includes cmd and args in WebSocket URL', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const token = getAuthToken()
    const response = await fetch(
      `${getWorkerBaseUrl()}/api/stdio/${session.sandboxId}/embed?token=${encodeURIComponent(token!)}&cmd=node&arg=-v`
    )

    expect(response.ok).toBe(true)
    const html = await response.text()

    // Should have cmd and args in the embedded JavaScript
    expect(html).toContain('"node"')
    expect(html).toContain('["-v"]')
  })
})

describe('concurrent session stress test', () => {
  beforeEach((ctx) => {
    if (!hasWorkerCredentials()) ctx.skip()
  })

  test('can create many sessions concurrently', async () => {
    const sessionCount = 10
    const sessions = await Promise.all(
      Array.from({ length: sessionCount }, () => createSession())
    )

    expect(sessions).toHaveLength(sessionCount)

    // All should have unique IDs
    const ids = new Set(sessions.map(s => s.sandboxId))
    expect(ids.size).toBe(sessionCount)

    // Add to cleanup list
    sessions.forEach(s => createdSessions.push(s.sandboxId))
  })

  test('can delete many sessions concurrently', async () => {
    const sessionCount = 5
    const sessions = await Promise.all(
      Array.from({ length: sessionCount }, () => createSession())
    )

    // Delete all concurrently
    await Promise.all(sessions.map(s => deleteSession(s.sandboxId)))

    // All should be gone
    const token = getAuthToken()
    const statusResults = await Promise.allSettled(
      sessions.map(s =>
        fetch(`${getWorkerBaseUrl()}/api/stdio/${s.sandboxId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    )

    for (const result of statusResults) {
      if (result.status === 'fulfilled') {
        expect(result.value.status).toBe(404)
      }
    }
  })
})

// Helper to get auth token - use TEST_API_KEY consistently with createSession/deleteSession
function getAuthToken(): string | null {
  return process.env.TEST_API_KEY || null
}
