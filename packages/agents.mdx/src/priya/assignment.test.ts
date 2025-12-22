/**
 * Priya Assignment Service - Test Suite
 *
 * Tests the assignment algorithm that matches ready issues to best-fit agents
 */

import { describe, it, expect, vi } from 'vitest'
import { assignReadyIssues } from './assignment'
import type { Issue, AgentConfig, WorkflowRuntime } from '../types'

/**
 * Create a mock runtime for testing
 */
function createMockRuntime(
  issues: Issue[],
  agents: AgentConfig[],
  readyIssues: Issue[]
): WorkflowRuntime {
  const updatedIssues: Map<string, Partial<Issue>> = new Map()

  return {
    repo: {
      owner: 'test',
      name: 'test-repo',
      defaultBranch: 'main',
      url: 'https://github.com/test/test-repo',
    },
    issues: {
      list: vi.fn(async () => issues),
      ready: vi.fn(async () => readyIssues),
      blocked: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(async (id: string, fields: Partial<Issue>) => {
        updatedIssues.set(id, fields)
        const issue = issues.find(i => i.id === id)!
        return { ...issue, ...fields }
      }),
      close: vi.fn(),
      show: vi.fn(),
    },
    dag: {
      ready: vi.fn(async () => readyIssues),
      criticalPath: vi.fn(async () => []),
      blockedBy: vi.fn(async () => []),
      unblocks: vi.fn(async () => []),
    },
    agents: {
      match: vi.fn(async (issue: Issue) => {
        // Simple mock matching logic
        const { matchAgent } = await import('../matcher')
        return matchAgent(issue, agents)
      }),
      list: vi.fn(async () => agents),
    },
    claude: {} as any,
    pr: {} as any,
    epics: {} as any,
    git: {} as any,
    todo: {} as any,
  }
}

describe('Priya Assignment Service', () => {
  // Test agents with different capabilities
  const testAgents: AgentConfig[] = [
    {
      name: 'Cody',
      description: 'General development',
      capabilities: [
        { name: 'code', operations: ['*'] },
        { name: 'test', operations: ['*'] },
      ],
      autonomy: 'full',
      model: 'sonnet',
    },
    {
      name: 'Dana',
      description: 'Documentation specialist',
      capabilities: [
        { name: 'docs', operations: ['*'] },
      ],
      focus: ['**/*.md', 'docs/**'],
      autonomy: 'full',
      model: 'haiku',
    },
    {
      name: 'Tom',
      description: 'TypeScript specialist',
      capabilities: [
        { name: 'code', operations: ['*'] },
        { name: 'typescript', operations: ['*'] },
      ],
      focus: ['**/*.ts', '**/*.tsx'],
      autonomy: 'full',
      model: 'sonnet',
    },
  ]

  // Test issues
  const testIssues: Issue[] = [
    {
      id: 'test-1',
      title: 'Fix bug in auth.ts',
      description: 'The authentication logic has a TypeScript error',
      type: 'bug',
      status: 'open',
      priority: 1,
      labels: ['code', 'typescript'],
      dependsOn: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'test-2',
      title: 'Update README.md documentation',
      description: 'Add setup instructions to README.md',
      type: 'task',
      status: 'open',
      priority: 2,
      labels: ['docs'],
      dependsOn: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'test-3',
      title: 'Blocked issue',
      description: 'This issue depends on test-1',
      type: 'task',
      status: 'open',
      priority: 2,
      labels: ['code'],
      dependsOn: ['test-1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'test-4',
      title: 'Already assigned issue',
      description: 'This issue already has an assignee',
      type: 'task',
      status: 'open',
      priority: 2,
      labels: ['code'],
      dependsOn: [],
      assignee: 'Cody',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  describe('assignReadyIssues', () => {
    it('should assign ready issues to best-fit agents', async () => {
      // Only test-1 and test-2 are ready (no dependencies)
      const readyIssues = [testIssues[0], testIssues[1]]
      const runtime = createMockRuntime(testIssues, testAgents, readyIssues)

      const results = await assignReadyIssues(runtime)

      // Should assign 2 issues (test-1 and test-2)
      // test-3 is blocked by test-1, test-4 is already assigned
      expect(results).toHaveLength(2)

      // Find results by issue ID
      const result1 = results.find(r => r.issue.id === 'test-1')
      const result2 = results.find(r => r.issue.id === 'test-2')

      // test-1 should be assigned to Tom (TypeScript specialist)
      expect(result1).toBeDefined()
      expect(result1?.agent.name).toBe('Tom')
      expect(result1?.confidence).toBeGreaterThan(0)

      // test-2 should be assigned to Dana (Documentation specialist)
      expect(result2).toBeDefined()
      expect(result2?.agent.name).toBe('Dana')
      expect(result2?.confidence).toBeGreaterThan(0)
    })

    it('should skip issues that are already assigned', async () => {
      // Only test issue with assignee (test-4)
      const assignedIssues: Issue[] = [testIssues[3]]
      const runtime = createMockRuntime(assignedIssues, testAgents, assignedIssues)

      const results = await assignReadyIssues(runtime)

      // Should not assign already assigned issues
      expect(results).toHaveLength(0)
    })

    it('should skip blocked issues (with open dependencies)', async () => {
      // test-1 is ready, test-3 is blocked (depends on test-1)
      const blockedIssues: Issue[] = [testIssues[2], testIssues[0]]
      const readyOnly = [testIssues[0]] // Only test-1 is ready

      const runtime = createMockRuntime(blockedIssues, testAgents, readyOnly)

      const results = await assignReadyIssues(runtime)

      // Should only assign test-1 (ready), not test-3 (blocked)
      expect(results).toHaveLength(1)
      expect(results[0].issue.id).toBe('test-1')
    })

    it('should handle issues with no matching agent', async () => {
      // Issue with capabilities not covered by any agent
      const unmatchableIssue: Issue = {
        id: 'test-5',
        title: 'Design new UI',
        description: 'Create wireframes',
        type: 'task',
        status: 'open',
        priority: 2,
        labels: ['design'], // No agent has 'design' capability
        dependsOn: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const runtime = createMockRuntime([unmatchableIssue], testAgents, [unmatchableIssue])

      const results = await assignReadyIssues(runtime)

      // Should not assign issues without matching agent
      expect(results).toHaveLength(0)
    })

    it('should update issue assignee when assigning', async () => {
      const readyIssues = [testIssues[0]] // test-1
      const runtime = createMockRuntime(testIssues, testAgents, readyIssues)

      const results = await assignReadyIssues(runtime)

      expect(results).toHaveLength(1)
      expect(runtime.issues.update).toHaveBeenCalledWith('test-1', { assignee: 'Tom' })
    })
  })
})
