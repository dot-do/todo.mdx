/**
 * E2E: Terminal & Code Widget Tests
 *
 * Tests the embeddable terminal and Claude Code widget endpoints:
 * - /terminal - Terminal widget page (requires auth)
 * - /code/:org/:repo - Claude Code widget (requires auth)
 * - /api/terminal/* - Terminal session API
 * - /api/code/* - Claude Code session API
 *
 * NOTE: These tests require the worker to be deployed with the latest changes.
 * Run `cd worker && pnpm deploy` before running these tests.
 */

import { describe, test, expect, beforeAll } from 'vitest'

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const TEST_API_KEY = process.env.TEST_API_KEY

// Check if we have valid credentials for production
// TEST_API_KEY='test' is not a valid OAuth token
const hasCredentials = !!TEST_API_KEY
const hasValidCredentials = hasCredentials && TEST_API_KEY !== 'test'

beforeAll(() => {
  if (!hasValidCredentials) {
    console.log('Some tests require valid OAuth token - set TEST_API_KEY (not "test")')
  }
})

// Helper for authenticated requests
function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${WORKER_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(TEST_API_KEY ? { Authorization: `Bearer ${TEST_API_KEY}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  })
}

describe('widget pages (unauthenticated)', () => {
  test('GET /terminal redirects to login when not authenticated', async () => {
    const response = await fetch(`${WORKER_BASE_URL}/terminal`, {
      redirect: 'manual',
    })

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('/api/auth/login')
    expect(location).toContain('return=')
  })

  test('GET /terminal preserves query params in redirect', async () => {
    const response = await fetch(
      `${WORKER_BASE_URL}/terminal?repo=test/repo&task=hello`,
      { redirect: 'manual' }
    )

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('/api/auth/login')
    expect(location).toContain('return=')
  })

  test('GET /code/:org/:repo redirects to login when not authenticated', async () => {
    const response = await fetch(`${WORKER_BASE_URL}/code/test-org/test-repo`, {
      redirect: 'manual',
    })

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('/api/auth/login')
    expect(location).toContain('return=')
  })

  test('GET /code/:org/:repo/:ref redirects to login when not authenticated', async () => {
    const response = await fetch(
      `${WORKER_BASE_URL}/code/test-org/test-repo/feature-branch`,
      { redirect: 'manual' }
    )

    expect(response.status).toBe(302)
    const location = response.headers.get('Location')
    expect(location).toContain('/api/auth/login')
  })
})

describe('static assets (public)', () => {
  test('GET /assets/terminal.css returns CSS', async () => {
    const response = await fetch(`${WORKER_BASE_URL}/assets/terminal.css`)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/css')

    const text = await response.text()
    expect(text).toContain('#terminal-container')
    expect(text).toContain('.status-bar')
  })

  test('GET /assets/terminal.js returns JavaScript', async () => {
    const response = await fetch(`${WORKER_BASE_URL}/assets/terminal.js`)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('javascript')

    const text = await response.text()
    expect(text).toContain('TerminalWidget')
    expect(text).toContain('WebSocket')
  })

  test('GET /terminal.html returns HTML', async () => {
    const response = await fetch(`${WORKER_BASE_URL}/terminal.html`)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')

    const text = await response.text()
    expect(text).toContain('<!DOCTYPE html>')
    expect(text).toContain('terminal-container')
  })

  test('GET /code.html returns HTML', async () => {
    const response = await fetch(`${WORKER_BASE_URL}/code.html`)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')

    const text = await response.text()
    expect(text).toContain('<!DOCTYPE html>')
    expect(text).toContain('Claude Code')
  })
})

describe.skipIf(!hasCredentials)('terminal API (unauthenticated)', () => {
  test('POST /api/terminal/start returns 401 or 403 without auth', async () => {
    const response = await fetch(`${WORKER_BASE_URL}/api/terminal/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: 'test/repo',
        task: 'test task',
        installationId: 123,
      }),
    })

    // Should return 401 or 403 (depending on worker config)
    expect([401, 403]).toContain(response.status)
  })

  test('GET /api/terminal/:id returns 401 without auth', async () => {
    const response = await fetch(
      `${WORKER_BASE_URL}/api/terminal/test-session-id`
    )

    expect(response.status).toBe(401)
  })

  test('GET /api/terminal/:id/events returns 401 without auth', async () => {
    const response = await fetch(
      `${WORKER_BASE_URL}/api/terminal/test-session-id/events`
    )

    expect(response.status).toBe(401)
  })

  test('POST /api/terminal/:id/terminate returns 401 or 403 without auth', async () => {
    const response = await fetch(
      `${WORKER_BASE_URL}/api/terminal/test-session-id/terminate`,
      { method: 'POST' }
    )

    // Should return 401 or 403 (depending on worker config)
    expect([401, 403]).toContain(response.status)
  })
})

describe.skipIf(!hasCredentials)('code API (unauthenticated)', () => {
  test('POST /api/code/:org/:repo/start returns 401 or 403 without auth', async () => {
    const response = await fetch(
      `${WORKER_BASE_URL}/api/code/test-org/test-repo/start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'test task' }),
      }
    )

    // Should return 401 or 403 (depending on worker config)
    expect([401, 403]).toContain(response.status)
  })

  test('GET /api/code/:org/:repo/sessions returns 401 without auth', async () => {
    const response = await fetch(
      `${WORKER_BASE_URL}/api/code/test-org/test-repo/sessions`
    )

    expect(response.status).toBe(401)
  })
})

describe.skipIf(!hasValidCredentials)('terminal API (authenticated)', () => {
  test('POST /api/terminal/start creates session', async () => {

    const response = await authFetch('/api/terminal/start', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'nathanclevenger/todo.mdx',
        task: 'E2E test session',
        installationId: 12345,
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.sessionId).toBeDefined()
    expect(body.wsUrl).toContain('/terminal/')
  })

  test('GET /api/terminal/:id returns session status', async () => {

    // First create a session
    const createResponse = await authFetch('/api/terminal/start', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'nathanclevenger/todo.mdx',
        task: 'E2E status check',
        installationId: 12345,
      }),
    })

    expect(createResponse.status).toBe(200)
    const { sessionId } = await createResponse.json()

    // Then check status
    const statusResponse = await authFetch(`/api/terminal/${sessionId}`)

    expect(statusResponse.status).toBe(200)
    const status = await statusResponse.json()
    expect(status.repo).toBe('nathanclevenger/todo.mdx')
    expect(status.task).toBe('E2E status check')
    expect(status.status).toBeDefined()
  })

  test('DELETE /api/terminal/:id cleans up session', async () => {

    // First create a session
    const createResponse = await authFetch('/api/terminal/start', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'nathanclevenger/todo.mdx',
        task: 'E2E cleanup test',
        installationId: 12345,
      }),
    })

    expect(createResponse.status).toBe(200)
    const { sessionId } = await createResponse.json()

    // Delete it
    const deleteResponse = await authFetch(`/api/terminal/${sessionId}`, {
      method: 'DELETE',
    })

    expect(deleteResponse.status).toBe(200)
    const result = await deleteResponse.json()
    expect(result.success).toBe(true)

    // Verify it's gone
    const checkResponse = await authFetch(`/api/terminal/${sessionId}`)
    expect(checkResponse.status).toBe(404)
  })

  test('GET /api/terminal/:id returns 404 for non-existent session', async () => {

    const response = await authFetch('/api/terminal/non-existent-session-id-12345')

    expect(response.status).toBe(404)
  })
})

describe.skipIf(!hasValidCredentials)('code API (authenticated)', () => {
  test('POST /api/code/:org/:repo/start returns error for non-existent repo', async () => {

    const response = await authFetch('/api/code/fake-org/fake-repo/start', {
      method: 'POST',
      body: JSON.stringify({
        task: 'E2E test task',
        ref: 'main',
      }),
    })

    // Returns 404 if repo lookup succeeds but repo not found,
    // or 500 if Payload service call fails
    expect([404, 500]).toContain(response.status)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  test('GET /api/code/:org/:repo/sessions returns empty list for unknown repo', async () => {

    const response = await authFetch('/api/code/fake-org/fake-repo/sessions')

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.sessions).toEqual([])
  })

  test('DELETE /api/code/:org/:repo/sessions/:id returns 404 for non-existent session', async () => {

    const response = await authFetch(
      '/api/code/fake-org/fake-repo/sessions/non-existent-session',
      { method: 'DELETE' }
    )

    expect(response.status).toBe(404)
  })
})

describe.skipIf(!hasValidCredentials)('terminal terminate endpoint', () => {
  test('POST /api/terminal/:id/terminate terminates session', async () => {

    // First create a session
    const createResponse = await authFetch('/api/terminal/start', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'nathanclevenger/todo.mdx',
        task: 'E2E terminate test',
        installationId: 12345,
      }),
    })

    expect(createResponse.status).toBe(200)
    const { sessionId } = await createResponse.json()

    // Terminate it
    const terminateResponse = await authFetch(
      `/api/terminal/${sessionId}/terminate`,
      { method: 'POST' }
    )

    expect(terminateResponse.status).toBe(200)
    const result = await terminateResponse.json()
    expect(result.success).toBe(true)

    // Verify status is terminated
    const checkResponse = await authFetch(`/api/terminal/${sessionId}`)
    expect(checkResponse.status).toBe(200)
    const status = await checkResponse.json()
    expect(status.status).toBe('terminated')
  })

  test('POST /api/terminal/:id/terminate returns 404 for non-existent session', async () => {

    const response = await authFetch(
      '/api/terminal/non-existent-session/terminate',
      { method: 'POST' }
    )

    expect(response.status).toBe(404)
  })
})

describe.skipIf(!hasValidCredentials)('input validation', () => {
  test('POST /api/terminal/start validates required fields', async () => {

    const response = await authFetch('/api/terminal/start', {
      method: 'POST',
      body: JSON.stringify({}), // Missing required fields
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Missing required')
  })

  test('POST /api/code/:org/:repo/start handles missing body gracefully', async () => {

    // Should work with defaults when body is empty
    const response = await authFetch('/api/code/fake-org/fake-repo/start', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    // Will fail with 404 (repo not found) or 500 (Payload service error)
    // Key is it doesn't crash from missing body
    expect([404, 500]).toContain(response.status)
  })
})
