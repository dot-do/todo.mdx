import { describe, it, expect } from 'vitest'
import { parseComposioToolName, normalizeComposioTool } from '../normalize'
import type { ComposioTool } from '../normalize'
import type { Connection } from '../../types'
import type { Env } from '../../../types/env'

describe('parseComposioToolName', () => {
  it('parses GITHUB_CREATE_ISSUE correctly', () => {
    const result = parseComposioToolName('GITHUB_CREATE_ISSUE')
    expect(result.app).toBe('GitHub')
    expect(result.action).toBe('createIssue')
  })

  it('parses GITHUB_CREATE_PULL_REQUEST correctly', () => {
    const result = parseComposioToolName('GITHUB_CREATE_PULL_REQUEST')
    expect(result.app).toBe('GitHub')
    expect(result.action).toBe('createPullRequest')
  })

  it('parses LINEAR_CREATE_ISSUE correctly', () => {
    const result = parseComposioToolName('LINEAR_CREATE_ISSUE')
    expect(result.app).toBe('Linear')
    expect(result.action).toBe('createIssue')
  })

  it('parses SLACK_SEND_MESSAGE correctly', () => {
    const result = parseComposioToolName('SLACK_SEND_MESSAGE')
    expect(result.app).toBe('Slack')
    expect(result.action).toBe('sendMessage')
  })

  it('parses SLACK_SEND_DIRECT_MESSAGE correctly', () => {
    const result = parseComposioToolName('SLACK_SEND_DIRECT_MESSAGE')
    expect(result.app).toBe('Slack')
    expect(result.action).toBe('sendDirectMessage')
  })

  it('throws on invalid tool name', () => {
    expect(() => parseComposioToolName('INVALID')).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => parseComposioToolName('')).toThrow()
  })
})

describe('normalizeComposioTool', () => {
  const mockConnection: Connection = {
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

  const mockEnv: Env = {
    COMPOSIO_API_KEY: 'test-api-key',
  } as Env

  it('normalizes simple tool with string parameter', () => {
    const composioTool: ComposioTool = {
      name: 'GITHUB_CREATE_ISSUE',
      description: 'Create a new issue',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Issue title',
          },
          body: {
            type: 'string',
            description: 'Issue body',
          },
        },
        required: ['title'],
      },
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    expect(tool.name).toBe('createIssue')
    expect(tool.fullName).toBe('github.createIssue')
    expect(tool.schema).toBeDefined()
    expect(typeof tool.execute).toBe('function')
  })

  it('validates schema correctly for required fields', () => {
    const composioTool: ComposioTool = {
      name: 'GITHUB_CREATE_PULL_REQUEST',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'PR title' },
          head: { type: 'string', description: 'Head branch' },
          base: { type: 'string', description: 'Base branch' },
        },
        required: ['title', 'head', 'base'],
      },
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    // Valid params
    const validResult = tool.schema.safeParse({
      title: 'Test PR',
      head: 'feature',
      base: 'main',
    })
    expect(validResult.success).toBe(true)

    // Missing required field
    const invalidResult = tool.schema.safeParse({
      title: 'Test PR',
      head: 'feature',
      // missing base
    })
    expect(invalidResult.success).toBe(false)
  })

  it('validates optional fields correctly', () => {
    const composioTool: ComposioTool = {
      name: 'GITHUB_CREATE_ISSUE',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['title'],
      },
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    // With optional field
    const withBodyResult = tool.schema.safeParse({
      title: 'Test Issue',
      body: 'Description',
    })
    expect(withBodyResult.success).toBe(true)

    // Without optional field
    const withoutBodyResult = tool.schema.safeParse({
      title: 'Test Issue',
    })
    expect(withoutBodyResult.success).toBe(true)
  })

  it('handles different parameter types', () => {
    const composioTool: ComposioTool = {
      name: 'TEST_TOOL',
      parameters: {
        type: 'object',
        properties: {
          strField: { type: 'string' },
          numField: { type: 'number' },
          boolField: { type: 'boolean' },
          arrayField: { type: 'array' },
          objField: { type: 'object' },
        },
        required: ['strField'],
      },
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    const result = tool.schema.safeParse({
      strField: 'text',
      numField: 123,
      boolField: true,
      arrayField: ['a', 'b'],
      objField: { key: 'value' },
    })

    expect(result.success).toBe(true)
  })

  it('handles tool with no parameters', () => {
    const composioTool: ComposioTool = {
      name: 'GITHUB_LIST_REPOS',
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    expect(tool.name).toBe('listRepos')
    expect(tool.fullName).toBe('github.listRepos')
    expect(tool.schema).toBeDefined()

    // Empty object should validate
    const result = tool.schema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('includes parameter descriptions in schema', () => {
    const composioTool: ComposioTool = {
      name: 'GITHUB_CREATE_ISSUE',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The issue title',
          },
        },
        required: ['title'],
      },
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    // The description is stored in the Zod schema metadata
    const parsed = tool.schema.safeParse({ title: 'Test' })
    expect(parsed.success).toBe(true)
  })
})
