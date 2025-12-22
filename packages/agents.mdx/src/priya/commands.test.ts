/**
 * Priya Commands Test Suite
 *
 * Tests for on-demand Priya commands (reviewRoadmap, planSprint, triageBacklog)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { priyaReviewRoadmap, priyaPlanSprint, priyaTriageBacklog } from './commands'
import type { Issue, AgentConfig, WorkflowRuntime } from '../types'

/**
 * Create a mock runtime for testing
 */
function createMockRuntime(issues: Issue[], agents: AgentConfig[] = []): WorkflowRuntime {
  return {
    repo: {
      owner: 'test',
      name: 'test-repo',
      defaultBranch: 'main',
      url: 'https://github.com/test/test-repo',
    },
    issues: {
      list: vi.fn(async (filter?: any) => {
        if (!filter) return issues
        let filtered = issues
        if (filter.status) {
          filtered = filtered.filter(i => i.status === filter.status)
        }
        if (filter.priority !== undefined) {
          filtered = filtered.filter(i => i.priority === filter.priority)
        }
        if (filter.type) {
          filtered = filtered.filter(i => i.type === filter.type)
        }
        return filtered
      }),
      ready: vi.fn(async () => issues.filter(i => i.status === 'open' && i.dependsOn.length === 0)),
      blocked: vi.fn(async () => issues.filter(i => i.status === 'blocked' || i.dependsOn.length > 0)),
      create: vi.fn(),
      update: vi.fn(async (id: string, fields: Partial<Issue>) => {
        const issue = issues.find(i => i.id === id)!
        return { ...issue, ...fields }
      }),
      close: vi.fn(),
      show: vi.fn(async (id: string) => issues.find(i => i.id === id) || null),
    },
    dag: {
      ready: vi.fn(async () => issues.filter(i => i.status === 'open' && i.dependsOn.length === 0)),
      criticalPath: vi.fn(async () => {
        // Simple mock: return highest priority open/in_progress/blocked issues
        return issues
          .filter(i => i.status === 'open' || i.status === 'in_progress' || i.status === 'blocked')
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 3)
      }),
      blockedBy: vi.fn(async (id: string) => {
        const issue = issues.find(i => i.id === id)
        return issue?.dependsOn.map(depId => issues.find(i => i.id === depId)).filter(Boolean) || []
      }),
      unblocks: vi.fn(async (id: string) => {
        return issues.filter(i => i.dependsOn.includes(id))
      }),
    },
    agents: {
      match: vi.fn(async (issue: Issue) => ({
        agent: agents[0],
        confidence: 0.8,
        reason: 'Test match',
      })),
      list: vi.fn(async () => agents),
    },
    epics: {
      list: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      close: vi.fn(),
    },
    claude: {} as any,
    pr: {} as any,
    git: {} as any,
    todo: {} as any,
  }
}

describe('Priya Commands - Review Roadmap', () => {
  const sampleIssues: Issue[] = [
    {
      id: 'issue-1',
      title: 'Critical security fix',
      description: 'Fix auth vulnerability',
      type: 'bug',
      status: 'open',
      priority: 0,
      labels: ['security', 'critical'],
      dependsOn: [],
      blocks: [],
      created: new Date('2025-01-01'),
      updated: new Date('2025-01-01'),
    },
    {
      id: 'issue-2',
      title: 'Add user dashboard',
      description: 'Create user dashboard page',
      type: 'feature',
      status: 'in_progress',
      priority: 1,
      labels: ['frontend'],
      dependsOn: [],
      blocks: [],
      created: new Date('2025-01-02'),
      updated: new Date('2025-01-02'),
    },
    {
      id: 'issue-3',
      title: 'Update documentation',
      description: 'Update API docs',
      type: 'task',
      status: 'open',
      priority: 3,
      labels: ['docs'],
      dependsOn: [],
      blocks: [],
      created: new Date('2025-01-03'),
      updated: new Date('2025-01-03'),
    },
    {
      id: 'issue-4',
      title: 'Refactor database layer',
      description: 'Refactor database access',
      type: 'chore',
      status: 'blocked',
      priority: 2,
      labels: ['backend'],
      dependsOn: ['issue-1'],
      blocks: [],
      created: new Date('2025-01-04'),
      updated: new Date('2025-01-04'),
    },
    {
      id: 'issue-5',
      title: 'Completed task',
      description: 'This is done',
      type: 'task',
      status: 'closed',
      priority: 2,
      labels: [],
      dependsOn: [],
      blocks: [],
      created: new Date('2025-01-05'),
      updated: new Date('2025-01-05'),
    },
  ]

  it('should analyze roadmap and return structured suggestions', async () => {
    const runtime = createMockRuntime(sampleIssues)
    const result = await priyaReviewRoadmap(runtime)

    // Should return structured analysis
    expect(result).toBeDefined()
    expect(result.summary).toBeDefined()
    expect(result.suggestions).toBeDefined()
    expect(Array.isArray(result.suggestions)).toBe(true)
    expect(result.stats).toBeDefined()
  })

  it('should identify high-priority unassigned issues', async () => {
    const runtime = createMockRuntime(sampleIssues)
    const result = await priyaReviewRoadmap(runtime)

    // Should include suggestions about critical unassigned issues
    expect(result.suggestions.length).toBeGreaterThan(0)
    const criticalSuggestion = result.suggestions.find(s =>
      s.type === 'critical_unassigned' || s.priority === 'high'
    )
    expect(criticalSuggestion).toBeDefined()
  })

  it('should identify blocked issues on critical path', async () => {
    const runtime = createMockRuntime(sampleIssues)
    const result = await priyaReviewRoadmap(runtime)

    // Should identify blocked issues
    const blockedSuggestion = result.suggestions.find(s =>
      s.type === 'blocked' || s.message?.includes('blocked')
    )
    expect(blockedSuggestion).toBeDefined()
  })

  it('should provide summary statistics', async () => {
    const runtime = createMockRuntime(sampleIssues)
    const result = await priyaReviewRoadmap(runtime)

    // Should have stats
    expect(result.stats.total).toBeGreaterThan(0)
    expect(result.stats.open).toBeDefined()
    expect(result.stats.inProgress).toBeDefined()
    expect(result.stats.closed).toBeDefined()
    expect(result.stats.blocked).toBeDefined()
  })
})

describe('Priya Commands - Plan Sprint', () => {
  const sprintIssues: Issue[] = [
    {
      id: 'sprint-1',
      title: 'High priority feature',
      description: 'Important feature',
      type: 'feature',
      status: 'open',
      priority: 0,
      labels: ['sprint-ready'],
      dependsOn: [],
      blocks: [],
      created: new Date(),
      updated: new Date(),
    },
    {
      id: 'sprint-2',
      title: 'Medium priority task',
      description: 'Regular task',
      type: 'task',
      status: 'open',
      priority: 1,
      labels: ['sprint-ready'],
      dependsOn: [],
      blocks: [],
      created: new Date(),
      updated: new Date(),
    },
    {
      id: 'sprint-3',
      title: 'Low priority chore',
      description: 'Can wait',
      type: 'chore',
      status: 'open',
      priority: 3,
      labels: [],
      dependsOn: [],
      blocks: [],
      created: new Date(),
      updated: new Date(),
    },
    {
      id: 'sprint-4',
      title: 'Blocked task',
      description: 'Depends on sprint-1',
      type: 'task',
      status: 'open',
      priority: 1,
      labels: ['sprint-ready'],
      dependsOn: ['sprint-1'],
      blocks: [],
      created: new Date(),
      updated: new Date(),
    },
  ]

  it('should select appropriate issues for sprint based on priority', async () => {
    const runtime = createMockRuntime(sprintIssues)
    const result = await priyaPlanSprint(runtime, { capacity: 5 })

    // Should return sprint plan
    expect(result).toBeDefined()
    expect(result.selectedIssues).toBeDefined()
    expect(Array.isArray(result.selectedIssues)).toBe(true)
    expect(result.selectedIssues.length).toBeGreaterThan(0)
    expect(result.selectedIssues.length).toBeLessThanOrEqual(5)
  })

  it('should prioritize higher priority issues', async () => {
    const runtime = createMockRuntime(sprintIssues)
    const result = await priyaPlanSprint(runtime, { capacity: 2 })

    // Should select high priority issues first
    expect(result.selectedIssues.length).toBeLessThanOrEqual(2)
    const priorities = result.selectedIssues.map(i => i.priority)
    expect(Math.min(...priorities)).toBeLessThanOrEqual(1) // Should include P0 or P1
  })

  it('should only select ready issues (no blockers)', async () => {
    const runtime = createMockRuntime(sprintIssues)
    const result = await priyaPlanSprint(runtime, { capacity: 10 })

    // All selected issues should have no dependencies or closed dependencies
    for (const issue of result.selectedIssues) {
      expect(issue.dependsOn.length).toBe(0)
    }
  })

  it('should respect capacity limit', async () => {
    const runtime = createMockRuntime(sprintIssues)
    const result = await priyaPlanSprint(runtime, { capacity: 2 })

    expect(result.selectedIssues.length).toBeLessThanOrEqual(2)
  })

  it('should provide sprint summary and metrics', async () => {
    const runtime = createMockRuntime(sprintIssues)
    const result = await priyaPlanSprint(runtime, { capacity: 5 })

    expect(result.summary).toBeDefined()
    expect(result.metrics).toBeDefined()
    expect(result.metrics.totalSelected).toBe(result.selectedIssues.length)
    expect(result.metrics.byPriority).toBeDefined()
    expect(result.metrics.byType).toBeDefined()
  })

  it('should allow filtering by labels', async () => {
    const runtime = createMockRuntime(sprintIssues)
    const result = await priyaPlanSprint(runtime, {
      capacity: 10,
      labels: ['sprint-ready']
    })

    // All selected issues should have sprint-ready label
    for (const issue of result.selectedIssues) {
      expect(issue.labels).toContain('sprint-ready')
    }
  })
})

describe('Priya Commands - Triage Backlog', () => {
  const backlogIssues: Issue[] = [
    {
      id: 'backlog-1',
      title: 'Urgent bug in production',
      description: 'Critical production issue',
      type: 'bug',
      status: 'open',
      priority: 2, // Incorrectly prioritized
      labels: ['bug'],
      dependsOn: [],
      blocks: [],
      created: new Date(),
      updated: new Date(),
    },
    {
      id: 'backlog-2',
      title: 'Nice to have feature',
      description: 'Low priority enhancement',
      type: 'feature',
      status: 'open',
      priority: 1, // Should be lower priority
      labels: ['enhancement'],
      dependsOn: [],
      blocks: [],
      created: new Date(),
      updated: new Date(),
    },
    {
      id: 'backlog-3',
      title: 'Needs categorization',
      description: 'Issue without proper labels',
      type: 'task',
      status: 'open',
      priority: 2,
      labels: [],
      dependsOn: [],
      blocks: [],
      created: new Date(),
      updated: new Date(),
    },
    {
      id: 'backlog-4',
      title: 'Old stale issue',
      description: 'Issue from 7 months ago',
      type: 'task',
      status: 'open',
      priority: 2,
      labels: ['stale'],
      dependsOn: [],
      blocks: [],
      created: new Date('2024-05-01'),
      updated: new Date('2024-05-01'),
    },
  ]

  it('should analyze backlog and return triage suggestions', async () => {
    const runtime = createMockRuntime(backlogIssues)
    const result = await priyaTriageBacklog(runtime)

    // Should return structured triage results
    expect(result).toBeDefined()
    expect(result.suggestions).toBeDefined()
    expect(Array.isArray(result.suggestions)).toBe(true)
    expect(result.categorized).toBeDefined()
  })

  it('should identify priority mismatches', async () => {
    const runtime = createMockRuntime(backlogIssues)
    const result = await priyaTriageBacklog(runtime)

    // Should suggest priority changes
    const prioritySuggestions = result.suggestions.filter(s =>
      s.action === 'reprioritize' || s.type === 'priority'
    )
    expect(prioritySuggestions.length).toBeGreaterThan(0)
  })

  it('should identify issues needing labels', async () => {
    const runtime = createMockRuntime(backlogIssues)
    const result = await priyaTriageBacklog(runtime)

    // Should suggest adding labels
    const labelSuggestions = result.suggestions.filter(s =>
      s.action === 'add_labels' || s.type === 'labels'
    )
    expect(labelSuggestions.length).toBeGreaterThan(0)
  })

  it('should categorize issues by urgency and type', async () => {
    const runtime = createMockRuntime(backlogIssues)
    const result = await priyaTriageBacklog(runtime)

    // Should have categorization
    expect(result.categorized).toBeDefined()
    expect(result.categorized.urgent).toBeDefined()
    expect(result.categorized.normal).toBeDefined()
    expect(result.categorized.low).toBeDefined()
  })

  it('should identify stale issues', async () => {
    const runtime = createMockRuntime(backlogIssues)
    const result = await priyaTriageBacklog(runtime)

    // Should flag stale issues
    const staleSuggestions = result.suggestions.filter(s =>
      s.action === 'review' && s.reason?.includes('stale')
    )
    expect(staleSuggestions.length).toBeGreaterThan(0)
  })

  it('should provide summary statistics', async () => {
    const runtime = createMockRuntime(backlogIssues)
    const result = await priyaTriageBacklog(runtime)

    expect(result.stats).toBeDefined()
    expect(result.stats.total).toBe(backlogIssues.length)
    expect(result.stats.needsAction).toBeDefined()
  })
})
