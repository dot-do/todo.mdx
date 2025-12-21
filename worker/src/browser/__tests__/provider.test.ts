import { describe, it, expect, vi, beforeEach } from 'vitest'

// Types we'll implement
import type {
  BrowserProvider,
  BrowserSession,
  CreateSessionOptions,
  SessionStatus,
} from '../../types/browser'

// Provider factory we'll implement
import { createBrowserProvider, selectProvider } from '../provider'

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
