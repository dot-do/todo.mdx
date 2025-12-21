import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import { createToolBindings } from '../bindings'
import { ToolRegistry } from '../registry'
import type { Connection, Integration, Tool } from '../types'

describe('createToolBindings', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  describe('basic binding creation', () => {
    it('creates empty bindings for no connections', () => {
      const bindings = createToolBindings([], registry)
      expect(bindings).toEqual({})
    })

    it('creates bindings for single integration with one tool', async () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: { token: 'token-123' },
        status: 'active',
        scopes: ['repo']
      }

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: async (params) => ({ pr: params.title })
      }

      const integration: Integration = {
        name: 'GitHub',
        tools: [tool]
      }

      registry.register(integration)
      const bindings = createToolBindings([connection], registry)

      expect(bindings).toHaveProperty('github')
      expect(bindings.github).toHaveProperty('createPullRequest')
      expect(typeof bindings.github.createPullRequest).toBe('function')

      const result = await bindings.github.createPullRequest({ title: 'Test PR' })
      expect(result).toEqual({ pr: 'Test PR' })
    })

    it('creates bindings for multiple tools in same integration', async () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: { token: 'token-123' },
        status: 'active',
        scopes: ['repo']
      }

      const tool1: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: async (params) => ({ type: 'pr', title: params.title })
      }

      const tool2: Tool = {
        name: 'createIssue',
        fullName: 'github.createIssue',
        schema: z.object({ title: z.string() }),
        execute: async (params) => ({ type: 'issue', title: params.title })
      }

      const integration: Integration = {
        name: 'GitHub',
        tools: [tool1, tool2]
      }

      registry.register(integration)
      const bindings = createToolBindings([connection], registry)

      expect(bindings.github).toHaveProperty('createPullRequest')
      expect(bindings.github).toHaveProperty('createIssue')

      const pr = await bindings.github.createPullRequest({ title: 'Test PR' })
      const issue = await bindings.github.createIssue({ title: 'Test Issue' })

      expect(pr).toEqual({ type: 'pr', title: 'Test PR' })
      expect(issue).toEqual({ type: 'issue', title: 'Test Issue' })
    })

    it('creates bindings for multiple integrations', async () => {
      const githubConn: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const linearConn: Connection = {
        id: 'conn-2',
        user: 'user-1',
        app: 'Linear',
        provider: 'native',
        externalId: 'linear-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const githubTool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: async () => ({ app: 'github' })
      }

      const linearTool: Tool = {
        name: 'createIssue',
        fullName: 'linear.createIssue',
        schema: z.object({ title: z.string() }),
        execute: async () => ({ app: 'linear' })
      }

      registry.register({ name: 'GitHub', tools: [githubTool] })
      registry.register({ name: 'Linear', tools: [linearTool] })

      const bindings = createToolBindings([githubConn, linearConn], registry)

      expect(bindings).toHaveProperty('github')
      expect(bindings).toHaveProperty('linear')
      expect(bindings.github).toHaveProperty('createPullRequest')
      expect(bindings.linear).toHaveProperty('createIssue')

      const githubResult = await bindings.github.createPullRequest({ title: 'Test' })
      const linearResult = await bindings.linear.createIssue({ title: 'Test' })

      expect(githubResult).toEqual({ app: 'github' })
      expect(linearResult).toEqual({ app: 'linear' })
    })
  })

  describe('binding name conversion', () => {
    it('converts GitHub to github', () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const bindings = createToolBindings([connection], registry)

      expect(bindings).toHaveProperty('github')
      expect(bindings).not.toHaveProperty('GitHub')
    })

    it('converts GoogleDrive to googleDrive', () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GoogleDrive',
        provider: 'native',
        externalId: 'drive-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const tool: Tool = {
        name: 'listFiles',
        fullName: 'googleDrive.listFiles',
        schema: z.object({}),
        execute: async () => ({})
      }

      registry.register({ name: 'GoogleDrive', tools: [tool] })
      const bindings = createToolBindings([connection], registry)

      expect(bindings).toHaveProperty('googleDrive')
    })
  })

  describe('schema validation', () => {
    it('validates params against tool schema', async () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({
          title: z.string(),
          body: z.string().optional()
        }),
        execute: async (params) => params
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const bindings = createToolBindings([connection], registry)

      // Valid params
      const result = await bindings.github.createPullRequest({ title: 'Test' })
      expect(result).toEqual({ title: 'Test' })

      // Invalid params - missing title
      await expect(
        bindings.github.createPullRequest({})
      ).rejects.toThrow()
    })

    it('passes validated params to execute function', async () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const executeSpy = vi.fn(async (params) => params)

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: executeSpy
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const bindings = createToolBindings([connection], registry)

      await bindings.github.createPullRequest({ title: 'Test' })

      expect(executeSpy).toHaveBeenCalledWith(
        { title: 'Test' },
        connection,
        undefined
      )
    })
  })

  describe('connection passing', () => {
    it('passes connection to tool execute function', async () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: { token: 'secret-token' },
        status: 'active',
        scopes: ['repo']
      }

      const executeSpy = vi.fn(async () => ({}))

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: executeSpy
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const bindings = createToolBindings([connection], registry)

      await bindings.github.createPullRequest({})

      expect(executeSpy).toHaveBeenCalledWith({}, connection, undefined)
    })
  })

  describe('logging', () => {
    it('calls logToolExecution on success', async () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: async (params) => ({ pr: params.title })
      }

      registry.register({ name: 'GitHub', tools: [tool] })

      const logSpy = vi.fn(async () => {})
      const bindings = createToolBindings([connection], registry, undefined, logSpy)

      await bindings.github.createPullRequest({ title: 'Test' })

      expect(logSpy).toHaveBeenCalledWith(
        'github.createPullRequest',
        { title: 'Test' },
        { pr: 'Test' },
        undefined,
        expect.any(Number)
      )
    })

    it('calls logToolExecution on error', async () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: async () => {
          throw new Error('API error')
        }
      }

      registry.register({ name: 'GitHub', tools: [tool] })

      const logSpy = vi.fn(async () => {})
      const bindings = createToolBindings([connection], registry, undefined, logSpy)

      await expect(
        bindings.github.createPullRequest({ title: 'Test' })
      ).rejects.toThrow('API error')

      expect(logSpy).toHaveBeenCalledWith(
        'github.createPullRequest',
        { title: 'Test' },
        undefined,
        'API error',
        expect.any(Number)
      )
    })

    it('works without logToolExecution callback', async () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: async (params) => ({ pr: params.title })
      }

      registry.register({ name: 'GitHub', tools: [tool] })

      // No logging callback
      const bindings = createToolBindings([connection], registry)

      const result = await bindings.github.createPullRequest({ title: 'Test' })
      expect(result).toEqual({ pr: 'Test' })
    })
  })

  describe('edge cases', () => {
    it('skips connections with non-existent integrations', () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'NonExistent',
        provider: 'native',
        externalId: 'ne-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const bindings = createToolBindings([connection], registry)
      expect(bindings).toEqual({})
    })

    it('handles integration with no tools', () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      registry.register({ name: 'GitHub', tools: [] })
      const bindings = createToolBindings([connection], registry)

      expect(bindings.github).toEqual({})
    })

    it('handles multiple connections to same integration', async () => {
      const conn1: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-123',
        externalRef: { token: 'token-1' },
        status: 'active',
        scopes: []
      }

      const conn2: Connection = {
        id: 'conn-2',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'github-456',
        externalRef: { token: 'token-2' },
        status: 'active',
        scopes: []
      }

      const executeSpy = vi.fn(async (params, conn) => ({ connId: conn.id }))

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: executeSpy
      }

      registry.register({ name: 'GitHub', tools: [tool] })

      // First connection
      const bindings1 = createToolBindings([conn1], registry)
      const result1 = await bindings1.github.createPullRequest({})
      expect(result1).toEqual({ connId: 'conn-1' })

      // Second connection
      const bindings2 = createToolBindings([conn2], registry)
      const result2 = await bindings2.github.createPullRequest({})
      expect(result2).toEqual({ connId: 'conn-2' })
    })
  })
})
