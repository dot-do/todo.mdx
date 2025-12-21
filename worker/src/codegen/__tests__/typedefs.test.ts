import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { generateTypeDefs } from '../typedefs'
import { ToolRegistry } from '../../tools/registry'
import type { Connection, Integration, Tool } from '../../tools/types'

describe('generateTypeDefs', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  describe('basic type generation', () => {
    it('generates empty typedefs for no connections', () => {
      const typedefs = generateTypeDefs([], registry)
      expect(typedefs).toBe('// Auto-generated tool type definitions')
    })

    it('generates typedef for single integration with one tool', () => {
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
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('declare const github:')
      expect(typedefs).toContain('createPullRequest(params: { title: string }): Promise<any>')
    })

    it('generates typedefs for multiple tools', () => {
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

      const tool1: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({ title: z.string() }),
        execute: async () => ({})
      }

      const tool2: Tool = {
        name: 'createIssue',
        fullName: 'github.createIssue',
        schema: z.object({ title: z.string(), body: z.string() }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool1, tool2] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('createPullRequest(params: { title: string }): Promise<any>')
      expect(typedefs).toContain('createIssue(params: { title: string; body: string }): Promise<any>')
    })

    it('generates typedefs for multiple integrations', () => {
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
        execute: async () => ({})
      }

      const linearTool: Tool = {
        name: 'createIssue',
        fullName: 'linear.createIssue',
        schema: z.object({ title: z.string() }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [githubTool] })
      registry.register({ name: 'Linear', tools: [linearTool] })

      const typedefs = generateTypeDefs([githubConn, linearConn], registry)

      expect(typedefs).toContain('declare const github:')
      expect(typedefs).toContain('declare const linear:')
      expect(typedefs).toContain('createPullRequest(params: { title: string }): Promise<any>')
      expect(typedefs).toContain('createIssue(params: { title: string }): Promise<any>')
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
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('declare const github:')
      expect(typedefs).not.toContain('declare const GitHub:')
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
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('declare const googleDrive:')
    })
  })

  describe('zod to TypeScript type conversion', () => {
    it('converts string type', () => {
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
        name: 'test',
        fullName: 'github.test',
        schema: z.object({ name: z.string() }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('{ name: string }')
    })

    it('converts number type', () => {
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
        name: 'test',
        fullName: 'github.test',
        schema: z.object({ count: z.number() }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('{ count: number }')
    })

    it('converts boolean type', () => {
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
        name: 'test',
        fullName: 'github.test',
        schema: z.object({ enabled: z.boolean() }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('{ enabled: boolean }')
    })

    it('converts array type', () => {
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
        name: 'test',
        fullName: 'github.test',
        schema: z.object({ items: z.array(z.string()) }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('{ items: string[] }')
    })

    it('marks optional fields with ?', () => {
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
        name: 'test',
        fullName: 'github.test',
        schema: z.object({
          title: z.string(),
          body: z.string().optional()
        }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('{ title: string; body?: string }')
    })

    it('handles multiple fields', () => {
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
        name: 'test',
        fullName: 'github.test',
        schema: z.object({
          title: z.string(),
          count: z.number(),
          enabled: z.boolean(),
          tags: z.array(z.string())
        }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('title: string')
      expect(typedefs).toContain('count: number')
      expect(typedefs).toContain('enabled: boolean')
      expect(typedefs).toContain('tags: string[]')
    })

    it('handles nested objects', () => {
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
        name: 'test',
        fullName: 'github.test',
        schema: z.object({
          user: z.object({
            name: z.string(),
            email: z.string()
          })
        }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('user: { name: string; email: string }')
    })

    it('falls back to any for unknown types', () => {
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
        name: 'test',
        fullName: 'github.test',
        schema: z.object({ data: z.any() }),
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('{ data: any }')
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

      const typedefs = generateTypeDefs([connection], registry)
      expect(typedefs).toBe('// Auto-generated tool type definitions')
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
      const typedefs = generateTypeDefs([connection], registry)

      expect(typedefs).toContain('declare const github: {')
      expect(typedefs).toContain('}')
    })

    it('generates valid TypeScript syntax', () => {
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
        execute: async () => ({})
      }

      registry.register({ name: 'GitHub', tools: [tool] })
      const typedefs = generateTypeDefs([connection], registry)

      // Check for proper structure
      expect(typedefs).toContain('// Auto-generated tool type definitions')
      expect(typedefs).toContain('declare const github: {')
      expect(typedefs).toContain('  createPullRequest(params:')
      expect(typedefs).toContain('}')
    })
  })
})
