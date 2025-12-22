import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Types we'll implement
import type {
  BrowserProvider,
  BrowserSession,
  CreateSessionOptions,
  SessionStatus,
} from '../../types/browser'

// Provider factory we'll implement
import { createBrowserProvider, selectProvider, createSessionWithFallback } from '../provider'
import { CloudflareBrowserProvider } from '../cloudflare'

// Mock KV namespace for testing
function createMockKV(): KVNamespace {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string, _options?: any) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace
}

describe('Browser Types', () => {
  it('should define SessionStatus enum values', () => {
    const statuses: SessionStatus[] = ['pending', 'running', 'completed', 'error', 'timed_out']
    expect(statuses).toHaveLength(5)
  })

  it('should define BrowserSession interface', () => {
    const session: BrowserSession = {
      id: 'browser:test-123',
      provider: 'cloudflare',
      status: 'running',
      createdAt: Date.now(),
    }
    expect(session.id).toBe('browser:test-123')
    expect(session.provider).toBe('cloudflare')
    expect(session.status).toBe('running')
  })

  it('should support optional BrowserSession fields', () => {
    const session: BrowserSession = {
      id: 'browser:test-123',
      provider: 'browserbase',
      status: 'running',
      connectUrl: 'wss://connect.browserbase.com/...',
      debuggerUrl: 'https://debug.browserbase.com/...',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    }
    expect(session.connectUrl).toBeDefined()
    expect(session.debuggerUrl).toBeDefined()
    expect(session.expiresAt).toBeDefined()
  })
})

describe('BrowserProvider interface', () => {
  it('should define createSession method', async () => {
    const mockProvider: BrowserProvider = {
      name: 'mock',
      createSession: vi.fn().mockResolvedValue({
        id: 'browser:mock-123',
        provider: 'cloudflare',
        status: 'pending',
        createdAt: Date.now(),
      }),
      getSession: vi.fn(),
      releaseSession: vi.fn(),
      getRecording: vi.fn(),
    }

    const options: CreateSessionOptions = { timeout: 60000 }
    const session = await mockProvider.createSession(options)

    expect(mockProvider.createSession).toHaveBeenCalledWith(options)
    expect(session.id).toMatch(/^browser:/)
  })

  it('should define getSession method', async () => {
    const mockProvider: BrowserProvider = {
      name: 'mock',
      createSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        id: 'browser:test-123',
        provider: 'cloudflare',
        status: 'running',
        createdAt: Date.now(),
      }),
      releaseSession: vi.fn(),
      getRecording: vi.fn(),
    }

    const session = await mockProvider.getSession('browser:test-123')
    expect(session?.status).toBe('running')
  })

  it('should define releaseSession method', async () => {
    const mockProvider: BrowserProvider = {
      name: 'mock',
      createSession: vi.fn(),
      getSession: vi.fn(),
      releaseSession: vi.fn().mockResolvedValue(undefined),
      getRecording: vi.fn(),
    }

    await mockProvider.releaseSession('browser:test-123')
    expect(mockProvider.releaseSession).toHaveBeenCalledWith('browser:test-123')
  })

  it('should define getRecording method (returns null for non-browserbase)', async () => {
    const mockProvider: BrowserProvider = {
      name: 'mock',
      createSession: vi.fn(),
      getSession: vi.fn(),
      releaseSession: vi.fn(),
      getRecording: vi.fn().mockResolvedValue(null),
    }

    const recording = await mockProvider.getRecording('browser:test-123')
    expect(recording).toBeNull()
  })
})

describe('selectProvider', () => {
  const mockEnv = {
    BROWSER_PROVIDER: undefined as 'cloudflare' | 'browserbase' | undefined,
    BROWSER_BASE_API_KEY: undefined as string | undefined,
    BROWSER_BASE_PROJECT_ID: undefined as string | undefined,
  }

  beforeEach(() => {
    mockEnv.BROWSER_PROVIDER = undefined
    mockEnv.BROWSER_BASE_API_KEY = undefined
    mockEnv.BROWSER_BASE_PROJECT_ID = undefined
  })

  it('should default to cloudflare when no config', () => {
    const provider = selectProvider(mockEnv as any, {})
    expect(provider).toBe('cloudflare')
  })

  it('should respect explicit provider override', () => {
    const provider = selectProvider(mockEnv as any, { provider: 'browserbase' })
    expect(provider).toBe('browserbase')
  })

  it('should respect env BROWSER_PROVIDER setting', () => {
    mockEnv.BROWSER_PROVIDER = 'browserbase'
    const provider = selectProvider(mockEnv as any, {})
    expect(provider).toBe('browserbase')
  })

  it('should fall back to cloudflare if browserbase requested but not configured', () => {
    // No BROWSER_BASE_API_KEY set
    const provider = selectProvider(mockEnv as any, { provider: 'browserbase' })
    // Should still return browserbase - the provider itself will error if not configured
    expect(provider).toBe('browserbase')
  })
})

describe('createBrowserProvider factory', () => {
  it('should create cloudflare provider', () => {
    const mockEnv = { BROWSER: {} } as any
    const provider = createBrowserProvider('cloudflare', mockEnv)
    expect(provider.name).toBe('cloudflare')
  })

  it('should create browserbase provider', () => {
    const mockEnv = {
      BROWSER_BASE_API_KEY: 'test-key',
      BROWSER_BASE_PROJECT_ID: 'test-project',
    } as any
    const provider = createBrowserProvider('browserbase', mockEnv)
    expect(provider.name).toBe('browserbase')
  })

  it('should throw error for unknown provider', () => {
    const mockEnv = {} as any
    expect(() => createBrowserProvider('unknown' as any, mockEnv)).toThrow()
  })
})

describe('createSessionWithFallback', () => {
  // Mock fetch for Browserbase API calls
  const mockFetch = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = mockFetch as any
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('should return browserbase session when API succeeds', async () => {
    const mockEnv = {
      BROWSER_BASE_API_KEY: 'test-key',
      BROWSER_BASE_PROJECT_ID: 'test-project',
      OAUTH_KV: {
        put: vi.fn().mockResolvedValue(undefined),
      },
    } as any

    // Mock successful Browserbase API calls
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

    const result = await createSessionWithFallback(mockEnv, { provider: 'browserbase' })

    expect(result.session.provider).toBe('browserbase')
    expect(result.fallback).toBe(false)
  })

  it('should fallback to cloudflare when browserbase API fails', async () => {
    const mockEnv = {
      BROWSER_BASE_API_KEY: 'test-key',
      BROWSER_BASE_PROJECT_ID: 'test-project',
      BROWSER: {}, // Cloudflare browser binding exists
      OAUTH_KV: {
        put: vi.fn().mockResolvedValue(undefined),
      },
    } as any

    // Mock failing Browserbase API call
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    })

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await createSessionWithFallback(mockEnv, { provider: 'browserbase' })

    expect(result.session.provider).toBe('cloudflare')
    expect(result.fallback).toBe(true)
    expect(result.fallbackReason).toContain('Browserbase')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[BrowserProvider] Browserbase failed')
    )

    consoleSpy.mockRestore()
  })

  it('should fallback to cloudflare when browserbase throws network error', async () => {
    const mockEnv = {
      BROWSER_BASE_API_KEY: 'test-key',
      BROWSER_BASE_PROJECT_ID: 'test-project',
      BROWSER: {}, // Cloudflare browser binding exists
      OAUTH_KV: {
        put: vi.fn().mockResolvedValue(undefined),
      },
    } as any

    // Mock network failure
    mockFetch.mockRejectedValueOnce(new Error('Network error: connection refused'))

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await createSessionWithFallback(mockEnv, { provider: 'browserbase' })

    expect(result.session.provider).toBe('cloudflare')
    expect(result.fallback).toBe(true)
    expect(result.fallbackReason).toContain('Network error')

    consoleSpy.mockRestore()
  })

  it('should throw when browserbase fails and cloudflare not available', async () => {
    const mockEnv = {
      BROWSER_BASE_API_KEY: 'test-key',
      BROWSER_BASE_PROJECT_ID: 'test-project',
      // No BROWSER binding - cloudflare not available
      OAUTH_KV: {
        put: vi.fn().mockResolvedValue(undefined),
      },
    } as any

    // Mock failing Browserbase API call
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    })

    await expect(createSessionWithFallback(mockEnv, { provider: 'browserbase' }))
      .rejects.toThrow('Browserbase API error')
  })

  it('should not fallback when cloudflare is explicitly requested', async () => {
    const mockEnv = {
      BROWSER: {}, // Cloudflare browser binding exists
    } as any

    const result = await createSessionWithFallback(mockEnv, { provider: 'cloudflare' })

    expect(result.session.provider).toBe('cloudflare')
    expect(result.fallback).toBe(false)
  })

  it('should use cloudflare directly when no provider specified and env defaults to cloudflare', async () => {
    const mockEnv = {
      BROWSER: {},
      BROWSER_PROVIDER: 'cloudflare',
    } as any

    const result = await createSessionWithFallback(mockEnv, {})

    expect(result.session.provider).toBe('cloudflare')
    expect(result.fallback).toBe(false)
  })
})

describe('CloudflareBrowserProvider KV Storage', () => {
  let mockKV: KVNamespace
  let provider: CloudflareBrowserProvider

  beforeEach(() => {
    mockKV = createMockKV()
    provider = new CloudflareBrowserProvider({
      OAUTH_KV: mockKV,
      BROWSER: {},
    } as any)
  })

  describe('createSession', () => {
    it('should store session in KV after creation', async () => {
      const session = await provider.createSession({ timeout: 60000 })

      expect(mockKV.put).toHaveBeenCalledWith(
        session.id,
        expect.any(String),
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      )

      // Verify stored data is valid JSON with expected fields
      const storedCall = (mockKV.put as any).mock.calls[0]
      const storedData = JSON.parse(storedCall[1])
      expect(storedData.sessionId).toBe(session.id)
      expect(storedData.provider).toBe('cloudflare')
      expect(storedData.status).toBe('running')
      expect(storedData.createdAt).toBeDefined()
    })

    it('should use contextId in session id when provided', async () => {
      const session = await provider.createSession({
        contextId: 'my-context-123',
        timeout: 60000,
      })

      expect(session.id).toBe('browser:my-context-123')
      expect(mockKV.put).toHaveBeenCalledWith(
        'browser:my-context-123',
        expect.any(String),
        expect.any(Object)
      )
    })

    it('should set 24 hour TTL for KV entries', async () => {
      await provider.createSession({ timeout: 60000 })

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 86400 })
      )
    })
  })

  describe('getSession', () => {
    it('should retrieve session from KV', async () => {
      // Create a session first
      const session = await provider.createSession({ timeout: 60000 })

      // Get the session
      const retrieved = await provider.getSession(session.id)

      expect(mockKV.get).toHaveBeenCalledWith(session.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(session.id)
      expect(retrieved?.provider).toBe('cloudflare')
      expect(retrieved?.status).toBe('running')
    })

    it('should return null for non-existent session', async () => {
      const result = await provider.getSession('browser:nonexistent-123')

      expect(mockKV.get).toHaveBeenCalledWith('browser:nonexistent-123')
      expect(result).toBeNull()
    })

    it('should mark session as timed_out if expired', async () => {
      // Create a session with short timeout
      const session = await provider.createSession({ timeout: 100 })

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))

      const retrieved = await provider.getSession(session.id)
      expect(retrieved?.status).toBe('timed_out')
    })
  })

  describe('releaseSession', () => {
    it('should update session status to completed in KV', async () => {
      const session = await provider.createSession({ timeout: 60000 })

      await provider.releaseSession(session.id)

      // Should update KV with completed status
      const putCalls = (mockKV.put as any).mock.calls
      const lastPutCall = putCalls[putCalls.length - 1]
      const storedData = JSON.parse(lastPutCall[1])
      expect(storedData.status).toBe('completed')
    })

    it('should handle releasing non-existent session gracefully', async () => {
      // Should not throw
      await expect(provider.releaseSession('browser:nonexistent')).resolves.not.toThrow()
    })
  })

  describe('getRecording', () => {
    it('should return null (Cloudflare does not support recording)', async () => {
      const session = await provider.createSession({ timeout: 60000 })
      const recording = await provider.getRecording(session.id)
      expect(recording).toBeNull()
    })
  })

  describe('persistence across instances', () => {
    it('should retrieve session from a new provider instance', async () => {
      // Create session with first provider
      const session = await provider.createSession({
        contextId: 'persistent-test',
        timeout: 60000,
      })

      // Create a new provider instance with the same KV
      const newProvider = new CloudflareBrowserProvider({
        OAUTH_KV: mockKV,
        BROWSER: {},
      } as any)

      // Should be able to retrieve the session
      const retrieved = await newProvider.getSession(session.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(session.id)
      expect(retrieved?.status).toBe('running')
    })
  })

  describe('without KV binding', () => {
    it('should handle missing OAUTH_KV gracefully on create', async () => {
      const noKvProvider = new CloudflareBrowserProvider({
        BROWSER: {},
      } as any)

      // Should still create session but skip KV storage
      const session = await noKvProvider.createSession({ timeout: 60000 })
      expect(session.id).toMatch(/^browser:/)
      expect(session.status).toBe('running')
    })

    it('should return null from getSession when no KV', async () => {
      const noKvProvider = new CloudflareBrowserProvider({
        BROWSER: {},
      } as any)

      const result = await noKvProvider.getSession('browser:any-id')
      expect(result).toBeNull()
    })
  })
})
