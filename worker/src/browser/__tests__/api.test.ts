/**
 * Browser API Route Tests
 *
 * TDD RED phase: Tests for /api/browser/* routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../../types/env'
import type { BrowserSession, RrwebEvent } from '../../types/browser'

// Will be implemented
import { browser } from '../api'

// Response types for type-safe testing
interface SessionResponse {
  session: BrowserSession
  recording?: RrwebEvent[] | null
}

interface ErrorResponse {
  error: string
}

interface SuccessResponse {
  success: boolean
}

// Mock environment
const createMockEnv = (overrides = {}): Partial<Env> => ({
  OAUTH_KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as any,
  BROWSER_BASE_API_KEY: 'test-api-key',
  BROWSER_BASE_PROJECT_ID: 'test-project-id',
  ...overrides,
})

// Mock fetch for Browserbase API
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('Browser API Routes', () => {
  let app: Hono<{ Bindings: Env }>

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>()
    app.route('/api/browser', browser)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/browser/start', () => {
    it('should create a new browser session', async () => {
      const env = createMockEnv()

      // Mock Browserbase API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'bb-session-123', status: 'RUNNING' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            debuggerFullscreenUrl: 'https://debug.browserbase.com/123',
            wsUrl: 'wss://connect.browserbase.com/123',
          }),
        })

      const res = await app.request('/api/browser/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: 60000 }),
      }, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session).toBeDefined()
      expect(data.session.id).toMatch(/^browser:/)
      expect(data.session.provider).toBeDefined()
    })

    it('should use cloudflare provider when browserbase not configured', async () => {
      const env = createMockEnv({
        BROWSER_BASE_API_KEY: undefined,
        BROWSER_BASE_PROJECT_ID: undefined,
        BROWSER_PROVIDER: 'cloudflare',
      })

      const res = await app.request('/api/browser/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session.provider).toBe('cloudflare')
    })

    it('should allow explicit provider override', async () => {
      const env = createMockEnv()

      const res = await app.request('/api/browser/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'cloudflare' }),
      }, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session.provider).toBe('cloudflare')
    })
  })

  describe('POST /api/browser/:org/:repo/:issue/start', () => {
    it('should create issue-scoped session', async () => {
      const env = createMockEnv()
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(null) // No existing session

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'bb-session-456', status: 'RUNNING' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            debuggerFullscreenUrl: 'https://debug.browserbase.com/456',
            wsUrl: 'wss://connect.browserbase.com/456',
          }),
        })

      const res = await app.request('/api/browser/owner/repo/123/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session.id).toBe('browser:owner/repo#123')
    })

    it('should return existing running session for same issue', async () => {
      const env = createMockEnv()
      const existingSession = {
        sessionId: 'browser:owner/repo#123',
        providerSessionId: 'bb-existing',
        provider: 'browserbase',
        status: 'running',
        connectUrl: 'wss://existing',
        debuggerUrl: 'https://existing',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      }
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(existingSession))

      // Mock status check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bb-existing', status: 'RUNNING' }),
      })

      const res = await app.request('/api/browser/owner/repo/123/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session.id).toBe('browser:owner/repo#123')
      expect(data.session.connectUrl).toBe('wss://existing')
    })
  })

  describe('GET /api/browser/:sessionId', () => {
    it('should return session status', async () => {
      const env = createMockEnv()
      const session = {
        sessionId: 'browser:test-123',
        providerSessionId: 'bb-test',
        provider: 'browserbase',
        status: 'running',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
      }
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bb-test', status: 'RUNNING' }),
      })

      const res = await app.request('/api/browser/browser:test-123', {}, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session).toBeDefined()
      expect(data.session.status).toBe('running')
    })

    it('should return 404 for unknown session', async () => {
      const env = createMockEnv()
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)

      const res = await app.request('/api/browser/browser:unknown', {}, env as Env)

      expect(res.status).toBe(404)
    })

    it('should include recording for completed browserbase session', async () => {
      const env = createMockEnv()
      const session = {
        sessionId: 'browser:test-123',
        providerSessionId: 'bb-test',
        provider: 'browserbase',
        status: 'completed',
        createdAt: Date.now() - 60000,
        expiresAt: Date.now() - 1000,
      }
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'bb-test', status: 'COMPLETED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ events: [{ type: 4, data: {}, timestamp: 1234 }] }),
        })

      const res = await app.request('/api/browser/browser:test-123', {}, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session.status).toBe('completed')
      expect(data.recording).toBeDefined()
      expect(data.recording).toHaveLength(1)
    })
  })

  describe('GET /api/browser/:org/:repo/:issue', () => {
    it('should return issue-scoped session', async () => {
      const env = createMockEnv()
      const session = {
        sessionId: 'browser:owner/repo#123',
        providerSessionId: 'bb-issue',
        provider: 'browserbase',
        status: 'running',
        createdAt: Date.now(),
      }
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bb-issue', status: 'RUNNING' }),
      })

      const res = await app.request('/api/browser/owner/repo/123', {}, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session.id).toBe('browser:owner/repo#123')
    })

    it('should return 404 when no issue session exists', async () => {
      const env = createMockEnv()
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)

      const res = await app.request('/api/browser/owner/repo/123', {}, env as Env)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/browser/:sessionId/release', () => {
    it('should release a running session', async () => {
      const env = createMockEnv()
      const session = {
        sessionId: 'browser:test-123',
        providerSessionId: 'bb-test',
        provider: 'browserbase',
        status: 'running',
        createdAt: Date.now(),
      }
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

      mockFetch.mockResolvedValueOnce({ ok: true }) // DELETE session

      const res = await app.request('/api/browser/browser:test-123/release', {
        method: 'POST',
      }, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SuccessResponse
      expect(data.success).toBe(true)
    })

    it('should return 404 for unknown session', async () => {
      const env = createMockEnv()
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)

      const res = await app.request('/api/browser/browser:unknown/release', {
        method: 'POST',
      }, env as Env)

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/browser/:sessionId', () => {
    it('should delete session from KV', async () => {
      const env = createMockEnv()
      ;(env.OAUTH_KV!.delete as any).mockResolvedValue(undefined)

      const res = await app.request('/api/browser/browser:test-123', {
        method: 'DELETE',
      }, env as Env)

      expect(res.status).toBe(200)
      expect(env.OAUTH_KV!.delete).toHaveBeenCalledWith('browser:test-123')
    })
  })
})
