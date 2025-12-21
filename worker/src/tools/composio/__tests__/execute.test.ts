import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeComposioTool } from '../execute'
import type { Connection } from '../../types'
import type { Env } from '../../../types/env'

// Mock the client module
vi.mock('../client', () => ({
  getComposio: vi.fn(() => ({
    tools: {
      execute: vi.fn().mockResolvedValue({
        data: { success: true, issueNumber: 123 },
      }),
    },
  })),
}))

describe('executeComposioTool', () => {
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

  it('executes tool with correct parameters', async () => {
    const result = await executeComposioTool(
      'GITHUB_CREATE_ISSUE',
      { title: 'Test Issue', body: 'Test body' },
      mockConnection,
      mockEnv
    )

    expect(result).toBeDefined()
  })

  it('uses entityId from externalRef.composioEntityId', async () => {
    const { getComposio } = await import('../client')
    const mockExecute = vi.fn().mockResolvedValue({ data: { success: true } })

    vi.mocked(getComposio).mockReturnValue({
      tools: {
        execute: mockExecute,
      },
    } as any)

    await executeComposioTool(
      'GITHUB_CREATE_ISSUE',
      { title: 'Test' },
      mockConnection,
      mockEnv
    )

    expect(mockExecute).toHaveBeenCalledWith({
      action: 'GITHUB_CREATE_ISSUE',
      params: { title: 'Test' },
      entityId: 'entity-789',
    })
  })

  it('falls back to externalId if composioEntityId not present', async () => {
    const { getComposio } = await import('../client')
    const mockExecute = vi.fn().mockResolvedValue({ data: { success: true } })

    vi.mocked(getComposio).mockReturnValue({
      tools: {
        execute: mockExecute,
      },
    } as any)

    const connectionWithoutComposioEntityId: Connection = {
      ...mockConnection,
      externalRef: {},
    }

    await executeComposioTool(
      'GITHUB_CREATE_ISSUE',
      { title: 'Test' },
      connectionWithoutComposioEntityId,
      mockEnv
    )

    expect(mockExecute).toHaveBeenCalledWith({
      action: 'GITHUB_CREATE_ISSUE',
      params: { title: 'Test' },
      entityId: 'entity-789',
    })
  })

  it('throws error when entityId is missing', async () => {
    const connectionWithoutEntityId: Connection = {
      ...mockConnection,
      externalId: '',
      externalRef: {},
    }

    await expect(
      executeComposioTool(
        'GITHUB_CREATE_ISSUE',
        { title: 'Test' },
        connectionWithoutEntityId,
        mockEnv
      )
    ).rejects.toThrow('Connection missing Composio entityId')
  })

  it('handles execution errors', async () => {
    const { getComposio } = await import('../client')
    const mockExecute = vi.fn().mockRejectedValue(new Error('API error'))

    vi.mocked(getComposio).mockReturnValue({
      tools: {
        execute: mockExecute,
      },
    } as any)

    await expect(
      executeComposioTool(
        'GITHUB_CREATE_ISSUE',
        { title: 'Test' },
        mockConnection,
        mockEnv
      )
    ).rejects.toThrow('API error')
  })

  it('passes through tool result', async () => {
    const { getComposio } = await import('../client')
    const expectedResult = {
      data: {
        id: 123,
        number: 456,
        url: 'https://github.com/owner/repo/issues/456',
      },
    }

    const mockExecute = vi.fn().mockResolvedValue(expectedResult)

    vi.mocked(getComposio).mockReturnValue({
      tools: {
        execute: mockExecute,
      },
    } as any)

    const result = await executeComposioTool(
      'GITHUB_CREATE_ISSUE',
      { title: 'Test', body: 'Description' },
      mockConnection,
      mockEnv
    )

    expect(result).toEqual(expectedResult)
  })

  it('handles different tool names', async () => {
    const { getComposio } = await import('../client')
    const mockExecute = vi.fn().mockResolvedValue({ data: { success: true } })

    vi.mocked(getComposio).mockReturnValue({
      tools: {
        execute: mockExecute,
      },
    } as any)

    await executeComposioTool(
      'LINEAR_CREATE_ISSUE',
      { title: 'Linear Issue' },
      { ...mockConnection, app: 'Linear' },
      mockEnv
    )

    expect(mockExecute).toHaveBeenCalledWith({
      action: 'LINEAR_CREATE_ISSUE',
      params: { title: 'Linear Issue' },
      entityId: 'entity-789',
    })
  })
})
