import { describe, it, expect } from 'vitest'
import { matchAgent, type AgentMatch } from './matcher'
import type { Issue, AgentConfig } from './types'

/**
 * Helper to create test issues
 */
function createIssue(overrides: Partial<Issue>): Issue {
  return {
    id: overrides.id || 'test-1',
    title: overrides.title || 'Test Issue',
    description: overrides.description,
    status: overrides.status || 'open',
    type: overrides.type || 'task',
    priority: overrides.priority ?? 2,
    assignee: overrides.assignee,
    labels: overrides.labels || [],
    created: overrides.created || new Date(),
    updated: overrides.updated || new Date(),
    closed: overrides.closed,
    dependsOn: overrides.dependsOn || [],
    blocks: overrides.blocks || [],
    parent: overrides.parent,
    children: overrides.children,
  }
}

/**
 * Helper to create test agent configs
 */
function createAgent(overrides: Partial<AgentConfig>): AgentConfig {
  return {
    name: overrides.name || 'test-agent',
    capabilities: overrides.capabilities,
    focus: overrides.focus,
    autonomy: overrides.autonomy || 'supervised',
    triggers: overrides.triggers,
    description: overrides.description,
    extends: overrides.extends,
    model: overrides.model,
    instructions: overrides.instructions,
  }
}

describe('matchAgent', () => {
  describe('capability-based matching', () => {
    it('should match agent with exact capability coverage', () => {
      const issue = createIssue({
        labels: ['bug'],
        description: 'Fix authentication issue',
      })

      const agents = [
        createAgent({
          name: 'cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('cody')
      expect(match!.confidence).toBeGreaterThan(0)
    })

    it('should prefer agent with more capability coverage', () => {
      const issue = createIssue({
        labels: ['bug', 'security'],
        description: 'Security vulnerability in auth',
      })

      const agents = [
        createAgent({
          name: 'cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
        createAgent({
          name: 'sam',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'security', operations: ['*'] },
          ],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('sam')
    })

    it('should return null when no agent has required capabilities', () => {
      const issue = createIssue({
        labels: ['bug'],
        description: 'Fix issue',
      })

      const agents = [
        createAgent({
          name: 'reed',
          capabilities: [{ name: 'docs', operations: ['*'] }],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).toBeNull()
    })

    it('should handle agents with no capabilities defined', () => {
      const issue = createIssue({
        labels: ['bug'],
        description: 'Fix issue',
      })

      const agents = [
        createAgent({
          name: 'fiona',
          capabilities: undefined,
        }),
      ]

      const match = matchAgent(issue, agents)

      // Agent with no capabilities can't match any specific requirement
      expect(match).toBeNull()
    })
  })

  describe('focus area matching', () => {
    it('should boost score for matching focus patterns', () => {
      const issue = createIssue({
        title: 'Update TypeScript types',
        description: 'Fix type definitions in src/types.ts',
        labels: ['bug'],
      })

      const agents = [
        createAgent({
          name: 'cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
          focus: ['src/**/*.js'],
        }),
        createAgent({
          name: 'tom',
          capabilities: [{ name: 'code', operations: ['*'] }],
          focus: ['**/*.ts', '**/*.tsx'],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('tom')
    })

    it('should handle issues with no file paths mentioned', () => {
      const issue = createIssue({
        title: 'General refactoring',
        description: 'Clean up the codebase',
        labels: ['feature'],
      })

      const agents = [
        createAgent({
          name: 'cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
          focus: ['src/**/*.ts'],
        }),
      ]

      const match = matchAgent(issue, agents)

      // Should still match based on capabilities, focus doesn't hurt
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('cody')
    })

    it('should extract file paths from description', () => {
      const issue = createIssue({
        description: 'Update README.md and CHANGELOG.md',
        labels: ['docs'],
      })

      const agents = [
        createAgent({
          name: 'dana-docs',
          capabilities: [{ name: 'docs', operations: ['*'] }],
          focus: ['**/*.md', 'docs/**'],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('dana-docs')
      expect(match!.confidence).toBeGreaterThan(0.5)
    })
  })

  describe('confidence scoring', () => {
    it('should return confidence score between 0 and 1', () => {
      const issue = createIssue({
        labels: ['bug'],
        description: 'Fix issue in src/auth.ts',
      })

      const agents = [
        createAgent({
          name: 'cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
          focus: ['src/**/*.ts'],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).not.toBeNull()
      expect(match!.confidence).toBeGreaterThanOrEqual(0)
      expect(match!.confidence).toBeLessThanOrEqual(1)
    })

    it('should have higher confidence for perfect matches', () => {
      const issue = createIssue({
        labels: ['security', 'bug'],
        description: 'Security vulnerability in authentication',
      })

      const agents = [
        createAgent({
          name: 'partial',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
        createAgent({
          name: 'perfect',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'security', operations: ['*'] },
          ],
        }),
      ]

      const partialMatch = matchAgent(issue, [agents[0]])
      const perfectMatch = matchAgent(issue, [agents[1]])

      expect(perfectMatch!.confidence).toBeGreaterThan(partialMatch!.confidence)
    })
  })

  describe('multiple agents', () => {
    it('should return best match from multiple candidates', () => {
      const issue = createIssue({
        title: 'Write tests for authentication',
        description: 'Add test coverage for auth module',
        labels: ['test'],
      })

      const agents = [
        createAgent({
          name: 'cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
        createAgent({
          name: 'quinn',
          capabilities: [
            { name: 'test', operations: ['*'] },
            { name: 'code', operations: ['*'] },
          ],
        }),
        createAgent({
          name: 'dana-docs',
          capabilities: [{ name: 'docs', operations: ['*'] }],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('quinn')
    })

    it('should handle tie-breaking with focus areas', () => {
      const issue = createIssue({
        title: 'Fix bug in src/components/Button.tsx',
        labels: ['bug'],
      })

      const agents = [
        createAgent({
          name: 'cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
          focus: ['src/**/*.ts'],
        }),
        createAgent({
          name: 'react-specialist',
          capabilities: [{ name: 'code', operations: ['*'] }],
          focus: ['src/components/**/*.tsx'],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('react-specialist')
    })
  })

  describe('edge cases', () => {
    it('should return null when no agents provided', () => {
      const issue = createIssue({
        labels: ['bug'],
      })

      const match = matchAgent(issue, [])

      expect(match).toBeNull()
    })

    it('should handle issue with no capability signals', () => {
      const issue = createIssue({
        title: 'General task',
        description: 'Do something',
        labels: [],
        type: 'task',
      })

      const agents = [
        createAgent({
          name: 'cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
      ]

      const match = matchAgent(issue, agents)

      // No capabilities required, so no match
      expect(match).toBeNull()
    })

    it('should handle wildcard capabilities', () => {
      const issue = createIssue({
        title: 'Complex multi-file refactoring',
        description: 'Refactor authentication system',
        labels: ['feature', 'security'],
      })

      const agents = [
        createAgent({
          name: 'fiona',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'security', operations: ['*'] },
            { name: 'test', operations: ['*'] },
            { name: 'review', operations: ['*'] },
            { name: 'docs', operations: ['*'] },
          ],
        }),
      ]

      const match = matchAgent(issue, agents)

      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('fiona')
    })
  })
})
