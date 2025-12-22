/**
 * Browser API Route Tests
 *
 * TDD RED phase: Tests for /api/browser/* routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
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
  message?: string
}

interface SuccessResponse {
  success: boolean
}

// Mock DB for getUserRepos authorization check
const createMockDb = (userRepos: Array<{ owner: string; name: string }> = []) => ({
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      all: vi.fn().mockResolvedValue({
        results: userRepos.map((r, i) => ({
          id: i + 1,
          github_id: 1000 + i,
          name: r.name,
          fullName: `${r.owner}/${r.name}`,
          owner: r.owner,
          private: false,
          installation_id: 1,
        })),
      }),
    })),
  })),
})

// Mock environment
const createMockEnv = (overrides = {}): Partial<Env> => ({
  OAUTH_KV: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as any,
  DB: createMockDb([]) as any,
  BROWSER_BASE_API_KEY: 'test-api-key',
  BROWSER_BASE_PROJECT_ID: 'test-project-id',
  ...overrides,
})

// Helper to create app with auth middleware that sets userId
const createAppWithAuth = (userId: string | null) => {
  const app = new Hono<{ Bindings: Env }>()

  // Mock auth middleware that sets auth context
  app.use('/*', async (c: Context, next: Next) => {
    if (userId) {
      c.set('auth', { userId })
    }
    await next()
  })

  app.route('/api/browser', browser)
  return app
}

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
      // Need auth and repo access for issue-scoped routes
      const env = createMockEnv({
        DB: createMockDb([{ owner: 'owner', name: 'repo' }]) as any,
      })
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

      const appWithAuth = createAppWithAuth('test-user')

      const res = await appWithAuth.request('/api/browser/owner/repo/123/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session.id).toBe('browser:owner/repo#123')
    })

    it('should return existing running session for same issue', async () => {
      const env = createMockEnv({
        DB: createMockDb([{ owner: 'owner', name: 'repo' }]) as any,
      })
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

      const appWithAuth = createAppWithAuth('test-user')

      const res = await appWithAuth.request('/api/browser/owner/repo/123/start', {
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
      const env = createMockEnv({
        DB: createMockDb([{ owner: 'owner', name: 'repo' }]) as any,
      })
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

      const appWithAuth = createAppWithAuth('test-user')

      const res = await appWithAuth.request('/api/browser/owner/repo/123', {}, env as Env)

      expect(res.status).toBe(200)
      const data = await res.json() as SessionResponse
      expect(data.session.id).toBe('browser:owner/repo#123')
    })

    it('should return 404 when no issue session exists', async () => {
      const env = createMockEnv({
        DB: createMockDb([{ owner: 'owner', name: 'repo' }]) as any,
      })
      ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)

      const appWithAuth = createAppWithAuth('test-user')

      const res = await appWithAuth.request('/api/browser/owner/repo/123', {}, env as Env)

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

  describe('Input Validation', () => {
    describe('POST /api/browser/start - CreateSessionOptions validation', () => {
      it('should reject timeout below minimum (1000ms)', async () => {
        const env = createMockEnv()

        const res = await app.request('/api/browser/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeout: 500 }),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should reject timeout above maximum (3600000ms / 1 hour)', async () => {
        const env = createMockEnv()

        const res = await app.request('/api/browser/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeout: 4000000 }),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should reject invalid provider value', async () => {
        const env = createMockEnv()

        const res = await app.request('/api/browser/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'invalid-provider' }),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should reject contextId exceeding max length (256 chars)', async () => {
        const env = createMockEnv()
        const longContextId = 'a'.repeat(257)

        const res = await app.request('/api/browser/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contextId: longContextId }),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should reject non-boolean keepAlive', async () => {
        const env = createMockEnv()

        const res = await app.request('/api/browser/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keepAlive: 'yes' }),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should accept valid options', async () => {
        const env = createMockEnv()

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'bb-session-valid', status: 'RUNNING' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              debuggerFullscreenUrl: 'https://debug.browserbase.com/valid',
              wsUrl: 'wss://connect.browserbase.com/valid',
            }),
          })

        const res = await app.request('/api/browser/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeout: 60000,
            provider: 'browserbase',
            contextId: 'my-context',
            keepAlive: true,
          }),
        }, env as Env)

        expect(res.status).toBe(200)
      })
    })

    describe('POST /api/browser/:org/:repo/:issue/start - path param validation', () => {
      it('should reject org with invalid characters', async () => {
        const env = createMockEnv()
        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/org<script>/repo/123/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should reject repo with invalid characters', async () => {
        const env = createMockEnv()
        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/owner/repo%00evil/123/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should reject issue with non-numeric characters', async () => {
        const env = createMockEnv()
        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/owner/repo/abc/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should accept valid path params with hyphens and underscores', async () => {
        // User needs access to the repo for this to succeed
        const env = createMockEnv({
          DB: createMockDb([{ owner: 'my-org', name: 'my_repo' }]) as any,
        })
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)
        const appWithAuth = createAppWithAuth('user-123')

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'bb-session-valid', status: 'RUNNING' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              debuggerFullscreenUrl: 'https://debug.browserbase.com/valid',
              wsUrl: 'wss://connect.browserbase.com/valid',
            }),
          })

        const res = await appWithAuth.request('/api/browser/my-org/my_repo/456/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(200)
      })
    })

    describe('GET /api/browser/:org/:repo/:issue - path param validation', () => {
      it('should reject invalid org format', async () => {
        const env = createMockEnv()
        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/bad@org/repo/123', {}, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })

      it('should reject invalid issue format', async () => {
        const env = createMockEnv()
        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/owner/repo/-1/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(400)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('validation_error')
      })
    })
  })

  describe('Authorization - Issue-scoped routes require repo access', () => {
    describe('POST /api/browser/:org/:repo/:issue/start', () => {
      it('should return 403 when user does not have access to the repo', async () => {
        // User has access to different repos, not the requested one
        const env = createMockEnv({
          DB: createMockDb([
            { owner: 'other-owner', name: 'other-repo' },
          ]) as any,
        })
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)

        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/owner/repo/123/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(403)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('forbidden')
        expect(data.message).toContain('access')
      })

      it('should allow access when user has access to the repo', async () => {
        const env = createMockEnv({
          DB: createMockDb([
            { owner: 'owner', name: 'repo' },
          ]) as any,
        })
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'bb-session-auth', status: 'RUNNING' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              debuggerFullscreenUrl: 'https://debug.browserbase.com/auth',
              wsUrl: 'wss://connect.browserbase.com/auth',
            }),
          })

        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/owner/repo/123/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(200)
        const data = await res.json() as SessionResponse
        expect(data.session.id).toBe('browser:owner/repo#123')
      })

      it('should return 401 when no auth context is present', async () => {
        const env = createMockEnv()
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)

        // Create app without auth context
        const appNoAuth = createAppWithAuth(null)

        const res = await appNoAuth.request('/api/browser/owner/repo/123/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(401)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('unauthorized')
      })
    })

    describe('GET /api/browser/:org/:repo/:issue', () => {
      it('should return 403 when user does not have access to the repo', async () => {
        const env = createMockEnv({
          DB: createMockDb([
            { owner: 'other-owner', name: 'other-repo' },
          ]) as any,
        })
        const session = {
          sessionId: 'browser:owner/repo#123',
          providerSessionId: 'bb-issue',
          provider: 'browserbase',
          status: 'running',
          createdAt: Date.now(),
          userId: 'user-123',
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/owner/repo/123', {}, env as Env)

        expect(res.status).toBe(403)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('forbidden')
      })

      it('should allow access when user has access to the repo', async () => {
        const env = createMockEnv({
          DB: createMockDb([
            { owner: 'owner', name: 'repo' },
          ]) as any,
        })
        const session = {
          sessionId: 'browser:owner/repo#123',
          providerSessionId: 'bb-issue',
          provider: 'browserbase',
          status: 'running',
          createdAt: Date.now(),
          userId: 'user-123',
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'bb-issue', status: 'RUNNING' }),
        })

        const appWithAuth = createAppWithAuth('user-123')

        const res = await appWithAuth.request('/api/browser/owner/repo/123', {}, env as Env)

        expect(res.status).toBe(200)
        const data = await res.json() as SessionResponse
        expect(data.session.id).toBe('browser:owner/repo#123')
      })
    })
  })

  describe('Session Ownership - userId storage and verification', () => {
    describe('POST /api/browser/start', () => {
      it('should store userId in session when auth context is present', async () => {
        const env = createMockEnv()

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'bb-session-owned', status: 'RUNNING' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              debuggerFullscreenUrl: 'https://debug.browserbase.com/owned',
              wsUrl: 'wss://connect.browserbase.com/owned',
            }),
          })

        const appWithAuth = createAppWithAuth('user-456')

        const res = await appWithAuth.request('/api/browser/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeout: 60000 }),
        }, env as Env)

        expect(res.status).toBe(200)

        // Verify userId was stored in KV
        expect(env.OAUTH_KV!.put).toHaveBeenCalled()
        const putCall = (env.OAUTH_KV!.put as any).mock.calls[0]
        const storedData = JSON.parse(putCall[1])
        expect(storedData.userId).toBe('user-456')
      })
    })

    describe('GET /api/browser/:sessionId', () => {
      it('should return 403 when session belongs to different user', async () => {
        const env = createMockEnv()
        const session = {
          sessionId: 'browser:test-123',
          providerSessionId: 'bb-test',
          provider: 'browserbase',
          status: 'running',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
          userId: 'user-owner',
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

        const appWithAuth = createAppWithAuth('user-other')

        const res = await appWithAuth.request('/api/browser/browser:test-123', {}, env as Env)

        expect(res.status).toBe(403)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('forbidden')
        expect(data.message).toContain('own')
      })

      it('should allow access when session belongs to the requesting user', async () => {
        const env = createMockEnv()
        const session = {
          sessionId: 'browser:test-123',
          providerSessionId: 'bb-test',
          provider: 'browserbase',
          status: 'running',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
          userId: 'user-owner',
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'bb-test', status: 'RUNNING' }),
        })

        const appWithAuth = createAppWithAuth('user-owner')

        const res = await appWithAuth.request('/api/browser/browser:test-123', {}, env as Env)

        expect(res.status).toBe(200)
        const data = await res.json() as SessionResponse
        expect(data.session.status).toBe('running')
      })

      it('should allow access to legacy sessions without userId (backward compatibility)', async () => {
        const env = createMockEnv()
        const session = {
          sessionId: 'browser:test-123',
          providerSessionId: 'bb-test',
          provider: 'browserbase',
          status: 'running',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
          // No userId - legacy session
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'bb-test', status: 'RUNNING' }),
        })

        const appWithAuth = createAppWithAuth('any-user')

        const res = await appWithAuth.request('/api/browser/browser:test-123', {}, env as Env)

        expect(res.status).toBe(200)
      })
    })

    describe('POST /api/browser/:sessionId/release', () => {
      it('should return 403 when session belongs to different user', async () => {
        const env = createMockEnv()
        const session = {
          sessionId: 'browser:test-123',
          providerSessionId: 'bb-test',
          provider: 'browserbase',
          status: 'running',
          createdAt: Date.now(),
          userId: 'user-owner',
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

        const appWithAuth = createAppWithAuth('user-other')

        const res = await appWithAuth.request('/api/browser/browser:test-123/release', {
          method: 'POST',
        }, env as Env)

        expect(res.status).toBe(403)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('forbidden')
      })

      it('should allow release when session belongs to the requesting user', async () => {
        const env = createMockEnv()
        const session = {
          sessionId: 'browser:test-123',
          providerSessionId: 'bb-test',
          provider: 'browserbase',
          status: 'running',
          createdAt: Date.now(),
          userId: 'user-owner',
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

        mockFetch.mockResolvedValueOnce({ ok: true })

        const appWithAuth = createAppWithAuth('user-owner')

        const res = await appWithAuth.request('/api/browser/browser:test-123/release', {
          method: 'POST',
        }, env as Env)

        expect(res.status).toBe(200)
        const data = await res.json() as SuccessResponse
        expect(data.success).toBe(true)
      })
    })

    describe('DELETE /api/browser/:sessionId', () => {
      it('should return 403 when session belongs to different user', async () => {
        const env = createMockEnv()
        const session = {
          sessionId: 'browser:test-123',
          providerSessionId: 'bb-test',
          provider: 'browserbase',
          status: 'completed',
          createdAt: Date.now(),
          userId: 'user-owner',
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))

        const appWithAuth = createAppWithAuth('user-other')

        const res = await appWithAuth.request('/api/browser/browser:test-123', {
          method: 'DELETE',
        }, env as Env)

        expect(res.status).toBe(403)
        const data = await res.json() as ErrorResponse
        expect(data.error).toBe('forbidden')
      })

      it('should allow delete when session belongs to the requesting user', async () => {
        const env = createMockEnv()
        const session = {
          sessionId: 'browser:test-123',
          providerSessionId: 'bb-test',
          provider: 'browserbase',
          status: 'completed',
          createdAt: Date.now(),
          userId: 'user-owner',
        }
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(JSON.stringify(session))
        ;(env.OAUTH_KV!.delete as any).mockResolvedValue(undefined)

        const appWithAuth = createAppWithAuth('user-owner')

        const res = await appWithAuth.request('/api/browser/browser:test-123', {
          method: 'DELETE',
        }, env as Env)

        expect(res.status).toBe(200)
        expect(env.OAUTH_KV!.delete).toHaveBeenCalledWith('browser:test-123')
      })
    })

    describe('POST /api/browser/:org/:repo/:issue/start - stores userId', () => {
      it('should store userId when creating new issue-scoped session', async () => {
        const env = createMockEnv({
          DB: createMockDb([
            { owner: 'owner', name: 'repo' },
          ]) as any,
        })
        ;(env.OAUTH_KV!.get as any).mockResolvedValue(null)

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: 'bb-session-issue', status: 'RUNNING' }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              debuggerFullscreenUrl: 'https://debug.browserbase.com/issue',
              wsUrl: 'wss://connect.browserbase.com/issue',
            }),
          })

        const appWithAuth = createAppWithAuth('user-789')

        const res = await appWithAuth.request('/api/browser/owner/repo/123/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }, env as Env)

        expect(res.status).toBe(200)

        // Verify userId was stored in KV
        expect(env.OAUTH_KV!.put).toHaveBeenCalled()
        const putCall = (env.OAUTH_KV!.put as any).mock.calls[0]
        const storedData = JSON.parse(putCall[1])
        expect(storedData.userId).toBe('user-789')
      })
    })
  })
})
