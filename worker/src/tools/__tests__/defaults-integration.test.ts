import { describe, it, expect } from 'vitest'
import { defaultIntegrations } from '../defaults'
import { ToolRegistry } from '../registry'

describe('defaults integration', () => {
  it('exports all default integrations', () => {
    expect(defaultIntegrations).toHaveLength(4)
    expect(defaultIntegrations.map(i => i.name)).toEqual([
      'Browser',
      'Code',
      'Search',
      'File'
    ])
  })

  it('can register all defaults in a registry', () => {
    const registry = new ToolRegistry()

    defaultIntegrations.forEach(integration => {
      registry.register(integration)
    })

    expect(registry.getAll()).toHaveLength(4)
  })

  it('can retrieve tools by fullName', () => {
    const registry = new ToolRegistry()

    defaultIntegrations.forEach(integration => {
      registry.register(integration)
    })

    expect(registry.getTool('browser.fetchPage')).toBeDefined()
    expect(registry.getTool('code.execute')).toBeDefined()
    expect(registry.getTool('search.web')).toBeDefined()
    expect(registry.getTool('file.read')).toBeDefined()
  })

  it('provides access to all tools', () => {
    const registry = new ToolRegistry()

    defaultIntegrations.forEach(integration => {
      registry.register(integration)
    })

    const allTools = defaultIntegrations.flatMap(i => i.tools)

    // Should have at least 2 tools per integration (8+ total)
    expect(allTools.length).toBeGreaterThanOrEqual(8)

    // All tools should have proper structure
    allTools.forEach(tool => {
      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('fullName')
      expect(tool).toHaveProperty('schema')
      expect(tool).toHaveProperty('execute')
      expect(typeof tool.execute).toBe('function')
    })
  })

  it('all fullNames follow integration.toolName pattern', () => {
    const allTools = defaultIntegrations.flatMap(i => i.tools)

    allTools.forEach(tool => {
      expect(tool.fullName).toMatch(/^[a-z]+\.[a-z]+$/i)
      const [integration, name] = tool.fullName.split('.')
      expect(integration).toBeTruthy()
      expect(name).toBeTruthy()
      expect(name).toBe(tool.name)
    })
  })
})
