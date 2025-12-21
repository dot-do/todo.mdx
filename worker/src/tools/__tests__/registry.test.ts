import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { ToolRegistry } from '../registry'
import type { Integration, Tool } from '../types'

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  describe('register', () => {
    it('registers an integration', () => {
      const integration: Integration = {
        name: 'GitHub',
        tools: []
      }

      registry.register(integration)
      expect(registry.get('GitHub')).toBe(integration)
    })

    it('registers integration with tools', () => {
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

      registry.register(integration)
      const retrieved = registry.get('GitHub')
      expect(retrieved?.tools).toHaveLength(1)
      expect(retrieved?.tools[0].name).toBe('createPullRequest')
    })

    it('overwrites existing integration with same name', () => {
      const integration1: Integration = {
        name: 'GitHub',
        tools: []
      }

      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: async () => ({})
      }

      const integration2: Integration = {
        name: 'GitHub',
        tools: [tool]
      }

      registry.register(integration1)
      registry.register(integration2)

      const retrieved = registry.get('GitHub')
      expect(retrieved?.tools).toHaveLength(1)
    })
  })

  describe('get', () => {
    it('returns undefined for non-existent integration', () => {
      expect(registry.get('NonExistent')).toBeUndefined()
    })

    it('retrieves registered integration', () => {
      const integration: Integration = {
        name: 'Linear',
        tools: []
      }

      registry.register(integration)
      expect(registry.get('Linear')).toBe(integration)
    })

    it('is case-sensitive', () => {
      const integration: Integration = {
        name: 'GitHub',
        tools: []
      }

      registry.register(integration)
      expect(registry.get('GitHub')).toBe(integration)
      expect(registry.get('github')).toBeUndefined()
    })
  })

  describe('getAll', () => {
    it('returns empty array when no integrations registered', () => {
      expect(registry.getAll()).toEqual([])
    })

    it('returns all registered integrations', () => {
      const github: Integration = {
        name: 'GitHub',
        tools: []
      }

      const linear: Integration = {
        name: 'Linear',
        tools: []
      }

      registry.register(github)
      registry.register(linear)

      const all = registry.getAll()
      expect(all).toHaveLength(2)
      expect(all).toContain(github)
      expect(all).toContain(linear)
    })
  })

  describe('getTool', () => {
    it('returns undefined for non-existent tool', () => {
      expect(registry.getTool('github.nonExistent')).toBeUndefined()
    })

    it('retrieves tool by full name', () => {
      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: async () => ({})
      }

      const integration: Integration = {
        name: 'GitHub',
        tools: [tool]
      }

      registry.register(integration)
      expect(registry.getTool('github.createPullRequest')).toBe(tool)
    })

    it('returns undefined if integration exists but tool does not', () => {
      const integration: Integration = {
        name: 'GitHub',
        tools: []
      }

      registry.register(integration)
      expect(registry.getTool('github.createPullRequest')).toBeUndefined()
    })

    it('handles multiple tools in integration', () => {
      const tool1: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: async () => ({})
      }

      const tool2: Tool = {
        name: 'createIssue',
        fullName: 'github.createIssue',
        schema: z.object({}),
        execute: async () => ({})
      }

      const integration: Integration = {
        name: 'GitHub',
        tools: [tool1, tool2]
      }

      registry.register(integration)
      expect(registry.getTool('github.createPullRequest')).toBe(tool1)
      expect(registry.getTool('github.createIssue')).toBe(tool2)
    })
  })

  describe('getToolsForApps', () => {
    it('returns empty array when no integrations registered', () => {
      expect(registry.getToolsForApps(['GitHub'])).toEqual([])
    })

    it('returns empty array when app is not registered', () => {
      const integration: Integration = {
        name: 'GitHub',
        tools: []
      }

      registry.register(integration)
      expect(registry.getToolsForApps(['Linear'])).toEqual([])
    })

    it('returns tools for single app', () => {
      const tool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: async () => ({})
      }

      const integration: Integration = {
        name: 'GitHub',
        tools: [tool]
      }

      registry.register(integration)
      const tools = registry.getToolsForApps(['GitHub'])
      expect(tools).toHaveLength(1)
      expect(tools[0]).toBe(tool)
    })

    it('returns tools for multiple apps', () => {
      const githubTool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: async () => ({})
      }

      const linearTool: Tool = {
        name: 'createIssue',
        fullName: 'linear.createIssue',
        schema: z.object({}),
        execute: async () => ({})
      }

      const github: Integration = {
        name: 'GitHub',
        tools: [githubTool]
      }

      const linear: Integration = {
        name: 'Linear',
        tools: [linearTool]
      }

      registry.register(github)
      registry.register(linear)

      const tools = registry.getToolsForApps(['GitHub', 'Linear'])
      expect(tools).toHaveLength(2)
      expect(tools).toContain(githubTool)
      expect(tools).toContain(linearTool)
    })

    it('handles apps with multiple tools', () => {
      const tool1: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: async () => ({})
      }

      const tool2: Tool = {
        name: 'createIssue',
        fullName: 'github.createIssue',
        schema: z.object({}),
        execute: async () => ({})
      }

      const integration: Integration = {
        name: 'GitHub',
        tools: [tool1, tool2]
      }

      registry.register(integration)
      const tools = registry.getToolsForApps(['GitHub'])
      expect(tools).toHaveLength(2)
    })

    it('only returns tools for requested apps', () => {
      const githubTool: Tool = {
        name: 'createPullRequest',
        fullName: 'github.createPullRequest',
        schema: z.object({}),
        execute: async () => ({})
      }

      const linearTool: Tool = {
        name: 'createIssue',
        fullName: 'linear.createIssue',
        schema: z.object({}),
        execute: async () => ({})
      }

      registry.register({
        name: 'GitHub',
        tools: [githubTool]
      })

      registry.register({
        name: 'Linear',
        tools: [linearTool]
      })

      const tools = registry.getToolsForApps(['GitHub'])
      expect(tools).toHaveLength(1)
      expect(tools[0]).toBe(githubTool)
    })
  })
})
