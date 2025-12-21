import { describe, it, expect } from 'vitest'
import {
  resolveToolConfig,
  validateRequiredApps,
  extractAppFromToolName,
  getAvailableTools
} from '../config'
import type { ToolConfig, Connection } from '../types'

describe('tool configuration', () => {
  const mockConnections: Connection[] = [
    {
      id: 'conn-1',
      user: 'user-1',
      app: 'GitHub',
      provider: 'native',
      externalId: 'install-123',
      externalRef: { installationId: 123 },
      status: 'active',
      scopes: ['repo', 'issues']
    },
    {
      id: 'conn-2',
      user: 'user-1',
      app: 'Linear',
      provider: 'composio',
      externalId: 'linear-456',
      externalRef: { connectionId: 'abc123' },
      status: 'active',
      scopes: ['read', 'write']
    },
    {
      id: 'conn-3',
      user: 'user-1',
      app: 'Slack',
      provider: 'composio',
      externalId: 'slack-789',
      externalRef: { connectionId: 'xyz789' },
      status: 'expired',
      scopes: ['chat:write']
    }
  ]

  describe('resolveToolConfig', () => {
    it('merges empty hierarchy', () => {
      const resolved = resolveToolConfig([])
      expect(resolved.enabled).toEqual([])
      expect(resolved.required).toEqual([])
      expect(resolved.connections).toEqual([])
    })

    it('resolves single config', () => {
      const config: ToolConfig = {
        enabled: ['github.createPullRequest', 'github.createIssue'],
        requiredApps: ['GitHub']
      }

      const resolved = resolveToolConfig([config], mockConnections)
      expect(resolved.enabled).toEqual(['github.createIssue', 'github.createPullRequest'])
      expect(resolved.required).toEqual(['GitHub'])
      expect(resolved.connections).toHaveLength(2) // Only active connections
    })

    it('accumulates enabled tools from hierarchy', () => {
      const orgConfig: ToolConfig = {
        enabled: ['github.createPullRequest']
      }
      const repoConfig: ToolConfig = {
        enabled: ['linear.createIssue']
      }
      const issueConfig: ToolConfig = {
        enabled: ['github.createIssue']
      }

      const resolved = resolveToolConfig([orgConfig, repoConfig, issueConfig], mockConnections)
      expect(resolved.enabled).toEqual([
        'github.createIssue',
        'github.createPullRequest',
        'linear.createIssue'
      ])
    })

    it('disabled tools override enabled tools', () => {
      const orgConfig: ToolConfig = {
        enabled: ['github.createPullRequest', 'github.deleteRepo', 'slack.sendMessage']
      }
      const repoConfig: ToolConfig = {
        disabled: ['github.deleteRepo']
      }
      const issueConfig: ToolConfig = {
        disabled: ['slack.sendMessage']
      }

      const resolved = resolveToolConfig([orgConfig, repoConfig, issueConfig], mockConnections)
      expect(resolved.enabled).toEqual(['github.createPullRequest'])
      expect(resolved.enabled).not.toContain('github.deleteRepo')
      expect(resolved.enabled).not.toContain('slack.sendMessage')
    })

    it('accumulates required apps', () => {
      const orgConfig: ToolConfig = {
        requiredApps: ['GitHub']
      }
      const repoConfig: ToolConfig = {
        requiredApps: ['Linear']
      }
      const issueConfig: ToolConfig = {
        requiredApps: ['Slack']
      }

      const resolved = resolveToolConfig([orgConfig, repoConfig, issueConfig], mockConnections)
      expect(resolved.required).toEqual(['GitHub', 'Linear', 'Slack'])
    })

    it('includes defaults when includeDefaults is true', () => {
      const config: ToolConfig = {
        includeDefaults: true
      }
      const defaultTools = ['github.listRepos', 'github.getRepo']

      const resolved = resolveToolConfig([config], mockConnections, defaultTools)
      expect(resolved.enabled).toEqual(['github.getRepo', 'github.listRepos'])
    })

    it('excludes defaults when includeDefaults is false', () => {
      const config: ToolConfig = {
        includeDefaults: false,
        enabled: ['github.createPullRequest']
      }
      const defaultTools = ['github.listRepos', 'github.getRepo']

      const resolved = resolveToolConfig([config], mockConnections, defaultTools)
      expect(resolved.enabled).toEqual(['github.createPullRequest'])
      expect(resolved.enabled).not.toContain('github.listRepos')
    })

    it('defaults to including defaults when not specified', () => {
      const config: ToolConfig = {}
      const defaultTools = ['github.listRepos']

      const resolved = resolveToolConfig([config], mockConnections, defaultTools)
      expect(resolved.enabled).toEqual(['github.listRepos'])
    })

    it('can disable default tools', () => {
      const config: ToolConfig = {
        includeDefaults: true,
        disabled: ['github.listRepos']
      }
      const defaultTools = ['github.listRepos', 'github.getRepo']

      const resolved = resolveToolConfig([config], mockConnections, defaultTools)
      expect(resolved.enabled).toEqual(['github.getRepo'])
      expect(resolved.enabled).not.toContain('github.listRepos')
    })

    it('filters out inactive connections', () => {
      const resolved = resolveToolConfig([], mockConnections)
      expect(resolved.connections).toHaveLength(2)
      expect(resolved.connections.every(conn => conn.status === 'active')).toBe(true)
      expect(resolved.connections.find(conn => conn.app === 'Slack')).toBeUndefined()
    })

    it('handles complex hierarchy', () => {
      const orgConfig: ToolConfig = {
        enabled: ['github.createPullRequest', 'github.deleteRepo'],
        requiredApps: ['GitHub'],
        includeDefaults: true
      }
      const repoConfig: ToolConfig = {
        enabled: ['linear.createIssue'],
        disabled: ['github.deleteRepo'],
        requiredApps: ['Linear']
      }
      const issueConfig: ToolConfig = {
        enabled: ['slack.sendMessage'],
        requiredApps: ['Slack']
      }
      const defaultTools = ['github.listRepos']

      const resolved = resolveToolConfig(
        [orgConfig, repoConfig, issueConfig],
        mockConnections,
        defaultTools
      )

      expect(resolved.enabled).toEqual([
        'github.createPullRequest',
        'github.listRepos',
        'linear.createIssue',
        'slack.sendMessage'
      ])
      expect(resolved.enabled).not.toContain('github.deleteRepo')
      expect(resolved.required).toEqual(['GitHub', 'Linear', 'Slack'])
      expect(resolved.connections).toHaveLength(2) // Only GitHub and Linear active
    })

    it('removes duplicates from enabled and required', () => {
      const orgConfig: ToolConfig = {
        enabled: ['github.createPullRequest'],
        requiredApps: ['GitHub']
      }
      const repoConfig: ToolConfig = {
        enabled: ['github.createPullRequest'], // Duplicate
        requiredApps: ['GitHub'] // Duplicate
      }

      const resolved = resolveToolConfig([orgConfig, repoConfig], mockConnections)
      expect(resolved.enabled).toEqual(['github.createPullRequest'])
      expect(resolved.required).toEqual(['GitHub'])
    })

    it('sorts enabled and required arrays', () => {
      const config: ToolConfig = {
        enabled: ['slack.sendMessage', 'github.createPullRequest', 'linear.createIssue'],
        requiredApps: ['Slack', 'GitHub', 'Linear']
      }

      const resolved = resolveToolConfig([config], mockConnections)
      expect(resolved.enabled).toEqual([
        'github.createPullRequest',
        'linear.createIssue',
        'slack.sendMessage'
      ])
      expect(resolved.required).toEqual(['GitHub', 'Linear', 'Slack'])
    })
  })

  describe('validateRequiredApps', () => {
    it('validates when all required apps have connections', () => {
      const resolved = resolveToolConfig(
        [{ requiredApps: ['GitHub', 'Linear'] }],
        mockConnections
      )

      const validation = validateRequiredApps(resolved)
      expect(validation.valid).toBe(true)
      expect(validation.missingApps).toEqual([])
    })

    it('returns missing apps when connections are unavailable', () => {
      const resolved = resolveToolConfig(
        [{ requiredApps: ['GitHub', 'Linear', 'Slack', 'Notion'] }],
        mockConnections
      )

      const validation = validateRequiredApps(resolved)
      expect(validation.valid).toBe(false)
      expect(validation.missingApps).toEqual(['Notion', 'Slack']) // Slack is expired
    })

    it('validates when no apps are required', () => {
      const resolved = resolveToolConfig([], mockConnections)

      const validation = validateRequiredApps(resolved)
      expect(validation.valid).toBe(true)
      expect(validation.missingApps).toEqual([])
    })

    it('handles empty connections', () => {
      const resolved = resolveToolConfig([{ requiredApps: ['GitHub'] }], [])

      const validation = validateRequiredApps(resolved)
      expect(validation.valid).toBe(false)
      expect(validation.missingApps).toEqual(['GitHub'])
    })
  })

  describe('extractAppFromToolName', () => {
    it('extracts app from github tool', () => {
      expect(extractAppFromToolName('github.createPullRequest')).toBe('GitHub')
    })

    it('extracts app from linear tool', () => {
      expect(extractAppFromToolName('linear.createIssue')).toBe('Linear')
    })

    it('extracts app from slack tool', () => {
      expect(extractAppFromToolName('slack.sendMessage')).toBe('Slack')
    })

    it('handles single word tool names', () => {
      expect(extractAppFromToolName('notion.createPage')).toBe('Notion')
    })

    it('handles empty string', () => {
      expect(extractAppFromToolName('')).toBe('')
    })

    it('handles tool name without dot', () => {
      expect(extractAppFromToolName('invalidtool')).toBe('Invalidtool')
    })

    it('converts camelCase to PascalCase', () => {
      expect(extractAppFromToolName('gitHub.test')).toBe('GitHub')
      expect(extractAppFromToolName('linearApp.test')).toBe('LinearApp')
    })
  })

  describe('getAvailableTools', () => {
    it('returns tools with active connections', () => {
      const resolved = resolveToolConfig(
        [{
          enabled: [
            'github.createPullRequest',
            'linear.createIssue',
            'slack.sendMessage',
            'notion.createPage'
          ]
        }],
        mockConnections
      )

      const available = getAvailableTools(resolved)
      expect(available).toEqual(['github.createPullRequest', 'linear.createIssue'])
      expect(available).not.toContain('slack.sendMessage') // Slack is expired
      expect(available).not.toContain('notion.createPage') // No connection
    })

    it('returns empty array when no tools are enabled', () => {
      const resolved = resolveToolConfig([], mockConnections)
      const available = getAvailableTools(resolved)
      expect(available).toEqual([])
    })

    it('returns empty array when no connections are available', () => {
      const resolved = resolveToolConfig(
        [{ enabled: ['github.createPullRequest'] }],
        []
      )
      const available = getAvailableTools(resolved)
      expect(available).toEqual([])
    })

    it('handles multiple tools from same app', () => {
      const resolved = resolveToolConfig(
        [{
          enabled: [
            'github.createPullRequest',
            'github.createIssue',
            'github.listRepos'
          ]
        }],
        mockConnections
      )

      const available = getAvailableTools(resolved)
      expect(available).toEqual([
        'github.createIssue',
        'github.createPullRequest',
        'github.listRepos'
      ])
    })
  })
})
