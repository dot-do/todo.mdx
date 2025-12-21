import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getComposio,
  getComposioTools,
  parseComposioToolName,
  normalizeComposioTool,
} from '../index'
import type { Connection } from '../../types'
import type { Env } from '../../../types/env'

// Mock @composio/core
vi.mock('@composio/core', () => ({
  Composio: vi.fn().mockImplementation(() => ({
    tools: {
      get: vi.fn().mockResolvedValue([
        {
          name: 'GITHUB_CREATE_ISSUE',
          description: 'Create a new GitHub issue',
          parameters: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: 'Repository owner' },
              repo: { type: 'string', description: 'Repository name' },
              title: { type: 'string', description: 'Issue title' },
              body: { type: 'string', description: 'Issue body' },
              labels: { type: 'array', description: 'Issue labels' },
            },
            required: ['owner', 'repo', 'title'],
          },
        },
        {
          name: 'GITHUB_ADD_COMMENT',
          description: 'Add comment to issue or PR',
          parameters: {
            type: 'object',
            properties: {
              owner: { type: 'string' },
              repo: { type: 'string' },
              issue_number: { type: 'number' },
              body: { type: 'string' },
            },
            required: ['owner', 'repo', 'issue_number', 'body'],
          },
        },
      ]),
      execute: vi.fn(),
    },
  })),
}))

describe('Composio Integration - End-to-End', () => {
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
      scopes: ['repo', 'issues', 'write:discussion'],
    }

    mockEnv = {
      COMPOSIO_API_KEY: 'test-composio-key',
      GITHUB_APP_ID: 'test-app-id',
      GITHUB_PRIVATE_KEY: 'test-key',
      GITHUB_WEBHOOK_SECRET: 'test-secret',
      WORKOS_API_KEY: 'test-workos-key',
      WORKOS_CLIENT_ID: 'test-client-id',
      WORKOS_CLIENT_SECRET: 'test-client-secret',
      COOKIE_ENCRYPTION_KEY: 'test-cookie-key',
      PAYLOAD_SECRET: 'test-payload-secret',
    } as Env
  })

  it('completes full flow: fetch, normalize, and validate tools', async () => {
    // 1. Get Composio client
    const composio = getComposio(mockEnv)
    expect(composio).toBeDefined()

    // 2. Fetch tools from Composio
    const integrations = await getComposioTools(mockEnv, ['github'], mockConnection)

    expect(integrations).toHaveLength(1)
    expect(integrations[0].name).toBe('GitHub')
    expect(integrations[0].tools).toHaveLength(2)

    // 3. Verify tool normalization
    const createIssueTool = integrations[0].tools.find(t => t.name === 'createIssue')
    const addCommentTool = integrations[0].tools.find(t => t.name === 'addComment')

    expect(createIssueTool).toBeDefined()
    expect(createIssueTool?.fullName).toBe('github.createIssue')

    expect(addCommentTool).toBeDefined()
    expect(addCommentTool?.fullName).toBe('github.addComment')

    // 4. Validate schemas work correctly
    if (createIssueTool) {
      const validParams = {
        owner: 'octocat',
        repo: 'hello-world',
        title: 'Bug report',
        body: 'Something is broken',
        labels: ['bug', 'high-priority'],
      }

      const result = createIssueTool.schema.safeParse(validParams)
      expect(result.success).toBe(true)

      // Missing required field
      const invalidResult = createIssueTool.schema.safeParse({
        owner: 'octocat',
        repo: 'hello-world',
        // missing title
      })
      expect(invalidResult.success).toBe(false)
    }
  })

  it('converts SCREAMING_SNAKE_CASE to camelCase correctly', () => {
    const testCases = [
      { input: 'GITHUB_CREATE_ISSUE', expectedApp: 'GitHub', expectedAction: 'createIssue' },
      {
        input: 'GITHUB_CREATE_PULL_REQUEST',
        expectedApp: 'GitHub',
        expectedAction: 'createPullRequest',
      },
      { input: 'LINEAR_CREATE_ISSUE', expectedApp: 'Linear', expectedAction: 'createIssue' },
      {
        input: 'LINEAR_UPDATE_ISSUE_STATE',
        expectedApp: 'Linear',
        expectedAction: 'updateIssueState',
      },
      { input: 'SLACK_SEND_MESSAGE', expectedApp: 'Slack', expectedAction: 'sendMessage' },
      {
        input: 'SLACK_SEND_DIRECT_MESSAGE',
        expectedApp: 'Slack',
        expectedAction: 'sendDirectMessage',
      },
    ]

    testCases.forEach(({ input, expectedApp, expectedAction }) => {
      const result = parseComposioToolName(input)
      expect(result.app).toBe(expectedApp)
      expect(result.action).toBe(expectedAction)
    })
  })

  it('normalizes different parameter types correctly', () => {
    const composioTool = {
      name: 'GITHUB_CREATE_ISSUE',
      parameters: {
        type: 'object' as const,
        properties: {
          owner: { type: 'string', description: 'Owner' },
          repo: { type: 'string', description: 'Repo' },
          issue_number: { type: 'number', description: 'Issue number' },
          draft: { type: 'boolean', description: 'Is draft' },
          labels: { type: 'array', description: 'Labels' },
          metadata: { type: 'object', description: 'Extra metadata' },
        },
        required: ['owner', 'repo'],
      },
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    // Test all parameter types
    const validParams = {
      owner: 'octocat',
      repo: 'hello-world',
      issue_number: 123,
      draft: true,
      labels: ['bug', 'feature'],
      metadata: { key: 'value' },
    }

    const result = tool.schema.safeParse(validParams)
    expect(result.success).toBe(true)
  })

  it('handles tools with no parameters', () => {
    const composioTool = {
      name: 'GITHUB_LIST_REPOS',
      description: 'List all repositories',
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    expect(tool.name).toBe('listRepos')
    expect(tool.fullName).toBe('github.listRepos')

    // Empty params should be valid
    const result = tool.schema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('handles tools with complex nested structures', () => {
    const composioTool = {
      name: 'GITHUB_CREATE_PULL_REQUEST',
      parameters: {
        type: 'object' as const,
        properties: {
          owner: { type: 'string', description: 'Owner' },
          repo: { type: 'string', description: 'Repo' },
          title: { type: 'string', description: 'PR title' },
          body: { type: 'string', description: 'PR body' },
          head: { type: 'string', description: 'Head branch' },
          base: { type: 'string', description: 'Base branch' },
          reviewers: { type: 'array', description: 'Reviewers' },
          draft: { type: 'boolean', description: 'Create as draft' },
        },
        required: ['owner', 'repo', 'title', 'head', 'base'],
      },
    }

    const tool = normalizeComposioTool(composioTool, mockConnection, mockEnv)

    // Full params
    const validParams = {
      owner: 'octocat',
      repo: 'hello-world',
      title: 'Add new feature',
      body: 'This PR adds...',
      head: 'feature-branch',
      base: 'main',
      reviewers: ['reviewer1', 'reviewer2'],
      draft: false,
    }

    const result = tool.schema.safeParse(validParams)
    expect(result.success).toBe(true)

    // Minimal params (only required)
    const minimalParams = {
      owner: 'octocat',
      repo: 'hello-world',
      title: 'Add new feature',
      head: 'feature-branch',
      base: 'main',
    }

    const minimalResult = tool.schema.safeParse(minimalParams)
    expect(minimalResult.success).toBe(true)
  })

  it('provides execute function for each tool', async () => {
    const integrations = await getComposioTools(mockEnv, ['github'], mockConnection)
    const tool = integrations[0].tools[0]

    expect(typeof tool.execute).toBe('function')

    // Execute function should be async
    const executePromise = tool.execute({ owner: 'test', repo: 'test', title: 'test' })
    expect(executePromise).toBeInstanceOf(Promise)
  })
})
