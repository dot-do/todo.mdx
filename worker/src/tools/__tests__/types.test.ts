import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import type { Integration, Tool, Connection, ToolConfig, ResolvedTools } from '../types'

describe('tool types', () => {
  describe('Integration', () => {
    it('has correct structure', () => {
      const integration: Integration = {
        name: 'GitHub',
        tools: []
      }

      expect(integration.name).toBe('GitHub')
      expect(Array.isArray(integration.tools)).toBe(true)
    })

    it('can contain tools', () => {
      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: async () => ({ success: true })
      }

      const integration: Integration = {
        name: 'GitHub',
        tools: [tool]
      }

      expect(integration.tools).toHaveLength(1)
      expect(integration.tools[0].name).toBe('createPullRequest')
    })
  })

  describe('Tool', () => {
    it('has correct structure', () => {
      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({
          title: z.string(),
          body: z.string().optional()
        }),
        execute: async (params, connection) => {
          return { id: '123', title: params.title }
        }
      }

      expect(tool.name).toBe('createPullRequest')
      expect(tool.fullName).toBe('github.createPullRequest')
      expect(tool.schema).toBeDefined()
      expect(typeof tool.execute).toBe('function')
    })

    it('execute function accepts params and connection', async () => {
      const mockConnection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'ext-1',
        externalRef: { installationId: '123' },
        status: 'active',
        scopes: ['repo']
      }

      const tool: Tool = {
        name: 'test',
        fullName: 'github.test',
        schema: z.object({ value: z.string() }),
        execute: async (params, connection) => {
          return { params, app: connection.app }
        }
      }

      const result = await tool.execute({ value: 'test' }, mockConnection)
      expect(result.params.value).toBe('test')
      expect(result.app).toBe('GitHub')
    })
  })

  describe('Connection', () => {
    it('has correct structure for native provider', () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'install-123',
        externalRef: { installationId: 123, accountId: 456 },
        status: 'active',
        scopes: ['repo', 'issues']
      }

      expect(connection.provider).toBe('native')
      expect(connection.app).toBe('GitHub')
      expect(connection.status).toBe('active')
    })

    it('has correct structure for composio provider', () => {
      const connection: Connection = {
        id: 'conn-2',
        user: 'user-1',
        app: 'Linear',
        provider: 'composio',
        externalId: 'composio-123',
        externalRef: { connectionId: 'abc123' },
        status: 'active',
        scopes: ['read', 'write']
      }

      expect(connection.provider).toBe('composio')
      expect(connection.app).toBe('Linear')
    })

    it('supports different status values', () => {
      const active: Connection['status'] = 'active'
      const expired: Connection['status'] = 'expired'
      const revoked: Connection['status'] = 'revoked'

      expect(['active', 'expired', 'revoked']).toContain(active)
      expect(['active', 'expired', 'revoked']).toContain(expired)
      expect(['active', 'expired', 'revoked']).toContain(revoked)
    })
  })

  describe('ToolConfig', () => {
    it('supports enabled tools list', () => {
      const config: ToolConfig = {
        enabled: ['github.createPullRequest', 'linear.createIssue']
      }

      expect(config.enabled).toHaveLength(2)
    })

    it('supports disabled tools list', () => {
      const config: ToolConfig = {
        disabled: ['github.deleteRepo']
      }

      expect(config.disabled).toHaveLength(1)
    })

    it('supports includeDefaults flag', () => {
      const config: ToolConfig = {
        includeDefaults: true,
        disabled: ['github.deleteRepo']
      }

      expect(config.includeDefaults).toBe(true)
    })

    it('supports requiredApps list', () => {
      const config: ToolConfig = {
        requiredApps: ['GitHub', 'Linear']
      }

      expect(config.requiredApps).toHaveLength(2)
    })

    it('can be empty object', () => {
      const config: ToolConfig = {}
      expect(config).toBeDefined()
    })
  })

  describe('ResolvedTools', () => {
    it('has correct structure', () => {
      const resolved: ResolvedTools = {
        enabled: ['github.createPullRequest', 'linear.createIssue'],
        required: ['GitHub', 'Linear'],
        connections: []
      }

      expect(resolved.enabled).toHaveLength(2)
      expect(resolved.required).toHaveLength(2)
      expect(Array.isArray(resolved.connections)).toBe(true)
    })

    it('can contain connections', () => {
      const connection: Connection = {
        id: 'conn-1',
        user: 'user-1',
        app: 'GitHub',
        provider: 'native',
        externalId: 'ext-1',
        externalRef: {},
        status: 'active',
        scopes: []
      }

      const resolved: ResolvedTools = {
        enabled: ['github.createPullRequest'],
        required: ['GitHub'],
        connections: [connection]
      }

      expect(resolved.connections).toHaveLength(1)
      expect(resolved.connections[0].app).toBe('GitHub')
    })
  })
})
