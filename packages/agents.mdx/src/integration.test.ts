import { describe, it, expect } from 'vitest'
import { matchAgent, parseRequiredCapabilities } from './index'
import type { Issue, AgentConfig } from './types'

/**
 * Integration tests for end-to-end capability matching
 */

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

describe('End-to-end capability matching', () => {
  describe('realistic agent roster scenarios', () => {
    it('should match bug fix to Coder Cody', () => {
      const issue = createIssue({
        title: 'Fix authentication bug',
        description: 'Users cannot log in with GitHub OAuth',
        labels: ['bug'],
        type: 'bug',
      })

      const agents = [
        createAgent({
          name: 'Coder Cody',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'git', operations: ['*'] },
          ],
        }),
        createAgent({
          name: 'Docs Dana',
          capabilities: [{ name: 'docs', operations: ['*'] }],
        }),
      ]

      const capabilities = parseRequiredCapabilities(issue)
      expect(capabilities).toContain('code')

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Coder Cody')
    })

    it('should match security vulnerability to Security Sam', () => {
      const issue = createIssue({
        title: 'SQL injection vulnerability in user search',
        description: 'User input is not sanitized in search queries',
        labels: ['security', 'bug'],
        type: 'bug',
      })

      const agents = [
        createAgent({
          name: 'Coder Cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
        createAgent({
          name: 'Security Sam',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'security', operations: ['*'] },
          ],
        }),
      ]

      const capabilities = parseRequiredCapabilities(issue)
      expect(capabilities).toContain('code')
      expect(capabilities).toContain('security')

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Security Sam')
    })

    it('should match test writing to Quinn QA', () => {
      const issue = createIssue({
        title: 'Add test coverage for payment processing',
        description: 'Write tests for the new payment flow',
        labels: ['test'],
        type: 'task',
      })

      const agents = [
        createAgent({
          name: 'Quinn QA',
          capabilities: [
            { name: 'test', operations: ['*'] },
            { name: 'code', operations: ['*'] },
          ],
        }),
        createAgent({
          name: 'Coder Cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
      ]

      const capabilities = parseRequiredCapabilities(issue)
      expect(capabilities).toContain('test')

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Quinn QA')
    })

    it('should match documentation to Docs Dana', () => {
      const issue = createIssue({
        title: 'Update API documentation',
        description: 'Document the new REST endpoints in README.md',
        labels: ['docs'],
        type: 'task',
      })

      const agents = [
        createAgent({
          name: 'Docs Dana',
          capabilities: [{ name: 'docs', operations: ['*'] }],
          focus: ['**/*.md', 'docs/**'],
        }),
        createAgent({
          name: 'Coder Cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
      ]

      const capabilities = parseRequiredCapabilities(issue)
      expect(capabilities).toContain('docs')

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Docs Dana')
    })

    it('should match TypeScript work to Typescript Tom with focus area boost', () => {
      const issue = createIssue({
        title: 'Fix type errors in src/types.ts',
        description: 'TypeScript strict mode is failing in type definitions',
        labels: ['bug'],
        type: 'bug',
      })

      const agents = [
        createAgent({
          name: 'Coder Cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
        createAgent({
          name: 'Typescript Tom',
          capabilities: [{ name: 'code', operations: ['*'] }],
          focus: ['**/*.ts', '**/*.tsx', 'tsconfig.json'],
        }),
      ]

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Typescript Tom')
      expect(match!.confidence).toBeGreaterThan(0.5)
    })
  })

  describe('edge case scenarios', () => {
    it('should handle complex multi-requirement issues', () => {
      const issue = createIssue({
        title: 'Implement secure authentication with tests',
        description: 'Add OAuth 2.0 flow with comprehensive test coverage and security audit',
        labels: ['feature', 'security', 'test'],
        type: 'feature',
      })

      const agents = [
        createAgent({
          name: 'Full-Stack Fiona',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'security', operations: ['*'] },
            { name: 'test', operations: ['*'] },
          ],
        }),
        createAgent({
          name: 'Security Sam',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'security', operations: ['*'] },
          ],
        }),
      ]

      const capabilities = parseRequiredCapabilities(issue)
      expect(capabilities).toContain('code')
      expect(capabilities).toContain('security')
      expect(capabilities).toContain('test')

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Full-Stack Fiona')
      expect(match!.confidence).toBe(1.0) // Perfect capability coverage
    })

    it('should return null when no agent matches requirements', () => {
      const issue = createIssue({
        title: 'Design new logo',
        description: 'Create visual assets for rebrand',
        labels: ['design'],
        type: 'task',
      })

      const agents = [
        createAgent({
          name: 'Coder Cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
      ]

      // No capabilities extracted from 'design' label
      const capabilities = parseRequiredCapabilities(issue)
      expect(capabilities).toHaveLength(0)

      const match = matchAgent(issue, agents)
      expect(match).toBeNull()
    })

    it('should handle partial capability matches', () => {
      const issue = createIssue({
        title: 'Add security headers and update docs',
        description: 'Implement CSP headers and document the security configuration',
        labels: ['security', 'docs'],
      })

      const agents = [
        createAgent({
          name: 'Security Sam',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'security', operations: ['*'] },
          ],
        }),
      ]

      const capabilities = parseRequiredCapabilities(issue)
      expect(capabilities).toContain('security')
      expect(capabilities).toContain('docs')

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Security Sam')
      // Only covers 1 of 2 capabilities
      expect(match!.confidence).toBeLessThan(1.0)
      expect(match!.confidence).toBeGreaterThan(0)
    })
  })

  describe('real-world issue patterns', () => {
    it('should match GitHub issue with code blocks', () => {
      const issue = createIssue({
        title: 'TypeError in authentication middleware',
        description: `
The auth middleware is throwing a TypeError when processing JWT tokens.

\`\`\`
TypeError: Cannot read property 'sub' of undefined
  at verify (/src/auth/middleware.ts:42)
\`\`\`

Need to fix the null check in src/auth/middleware.ts
        `,
        labels: ['bug'],
        type: 'bug',
      })

      const agents = [
        createAgent({
          name: 'Coder Cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
          focus: ['src/**/*.ts'],
        }),
      ]

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Coder Cody')
    })

    it('should handle Linear-style issue descriptions', () => {
      const issue = createIssue({
        title: 'Refactor payment processing',
        description: `
## Context
The current payment processing code is tightly coupled and hard to test.

## Tasks
- [ ] Extract payment provider interface
- [ ] Write unit tests for each provider
- [ ] Update integration tests

## Files to change
- src/payments/processor.ts
- src/payments/providers/stripe.ts
- tests/payments/processor.test.ts
        `,
        labels: ['feature'],
        type: 'feature',
      })

      const agents = [
        createAgent({
          name: 'Quinn QA',
          capabilities: [
            { name: 'code', operations: ['*'] },
            { name: 'test', operations: ['*'] },
          ],
          focus: ['tests/**'],
        }),
        createAgent({
          name: 'Coder Cody',
          capabilities: [{ name: 'code', operations: ['*'] }],
        }),
      ]

      const capabilities = parseRequiredCapabilities(issue)
      expect(capabilities).toContain('code')
      expect(capabilities).toContain('test')

      const match = matchAgent(issue, agents)
      expect(match).not.toBeNull()
      expect(match!.agent.name).toBe('Quinn QA')
    })
  })
})
