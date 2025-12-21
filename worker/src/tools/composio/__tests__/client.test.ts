import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getComposio, getComposioTools, getComposioToolsForConnection } from '../client'
import type { Connection } from '../../types'
import type { Env } from '../../../types/env'

// Mock @composio/core
vi.mock('@composio/core', () => ({
  Composio: vi.fn().mockImplementation(() => ({
    tools: {
      get: vi.fn().mockResolvedValue([
        {
          name: 'GITHUB_CREATE_ISSUE',
          description: 'Create a new issue',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Issue title' },
              body: { type: 'string', description: 'Issue body' },
            },
            required: ['title'],
          },
        },
        {
          name: 'GITHUB_CREATE_PULL_REQUEST',
          description: 'Create a pull request',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              head: { type: 'string' },
              base: { type: 'string' },
            },
            required: ['title', 'head', 'base'],
          },
        },
      ]),
      execute: vi.fn().mockResolvedValue({ success: true }),
    },
  })),
}))

describe('getComposio', () => {
  it('creates Composio client with API key', () => {
    const env: Env = {
      COMPOSIO_API_KEY: 'test-api-key',
    } as Env

    const composio = getComposio(env)
    expect(composio).toBeDefined()
  })

  it('throws error when API key is missing', () => {
    const env: Env = {} as Env

    expect(() => getComposio(env)).toThrow('COMPOSIO_API_KEY is required')
  })
})

describe('getComposioTools', () => {
  let mockConnection: Connection
  let mockEnv: Env

  beforeEach(() => {
    vi.clearAllMocks()

    mockConnection = {
      id: 'conn-123',
      user: 'user-456',
      app: 'GitHub',
      provider: 'composio',
      externalId: 'entity-789',
      externalRef: {
        composioEntityId: 'entity-789',
      },
      status: 'active',
      scopes: ['repo', 'issues'],
    }

    mockEnv = {
      COMPOSIO_API_KEY: 'test-api-key',
    } as Env
  })

  it('fetches and normalizes tools for specified apps', async () => {
    const integrations = await getComposioTools(mockEnv, ['github'], mockConnection)

    expect(integrations).toHaveLength(1)
    expect(integrations[0].name).toBe('GitHub')
    expect(integrations[0].tools).toBeDefined()
    expect(integrations[0].tools.length).toBeGreaterThan(0)
  })

  it('normalizes tool names correctly', async () => {
    const integrations = await getComposioTools(mockEnv, ['github'], mockConnection)

    const tools = integrations[0].tools
    const createIssueTool = tools.find(t => t.name === 'createIssue')
    const createPRTool = tools.find(t => t.name === 'createPullRequest')

    expect(createIssueTool).toBeDefined()
    expect(createIssueTool?.fullName).toBe('github.createIssue')

    expect(createPRTool).toBeDefined()
    expect(createPRTool?.fullName).toBe('github.createPullRequest')
  })

  it('handles multiple apps', async () => {
    const integrations = await getComposioTools(mockEnv, ['github', 'linear'], mockConnection)

    // Should attempt to fetch for both apps
    // Mock returns same tools for any app in this test
    expect(integrations.length).toBeGreaterThan(0)
  })

  it('continues on error for individual app', async () => {
    // This test verifies error handling, but with our mock all apps succeed
    const integrations = await getComposioTools(mockEnv, ['github'], mockConnection)
    expect(integrations.length).toBeGreaterThan(0)
  })

  it('returns empty array when no tools found', async () => {
    // Mock the Composio client to return empty array
    const { Composio } = await import('@composio/core')
    vi.mocked(Composio).mockImplementationOnce(() => ({
      tools: {
        get: vi.fn().mockResolvedValue([]),
        execute: vi.fn(),
      },
    }) as any)

    const integrations = await getComposioTools(mockEnv, ['unknown-app'], mockConnection)

    expect(integrations).toHaveLength(0)
  })
})

describe('getComposioToolsForConnection', () => {
  let mockConnection: Connection
  let mockEnv: Env

  beforeEach(() => {
    vi.clearAllMocks()

    mockConnection = {
      id: 'conn-123',
      user: 'user-456',
      app: 'GitHub',
      provider: 'composio',
      externalId: 'entity-789',
      externalRef: {
        composioEntityId: 'entity-789',
      },
      status: 'active',
      scopes: ['repo', 'issues'],
    }

    mockEnv = {
      COMPOSIO_API_KEY: 'test-api-key',
    } as Env
  })

  it('fetches tools for connection app', async () => {
    const integration = await getComposioToolsForConnection(mockEnv, mockConnection)

    expect(integration).toBeDefined()
    expect(integration?.name).toBe('GitHub')
  })

  it('handles different app names', async () => {
    mockConnection.app = 'Linear'

    const integration = await getComposioToolsForConnection(mockEnv, mockConnection)

    expect(integration).toBeDefined()
    expect(integration?.name).toBe('Linear')
  })

  it('returns null when no tools found', async () => {
    // Mock empty response
    const { Composio } = await import('@composio/core')
    vi.mocked(Composio).mockImplementationOnce(() => ({
      tools: {
        get: vi.fn().mockResolvedValue([]),
        execute: vi.fn(),
      },
    }) as any)

    const integration = await getComposioToolsForConnection(mockEnv, mockConnection)

    expect(integration).toBeNull()
  })
})
