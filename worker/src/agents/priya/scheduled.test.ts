import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dailyStandup, weeklyPlanning } from './scheduled'
import type { Issue } from 'beads-workflows'
import type { WorkflowRuntime } from '@todo.mdx/agents.mdx'

describe('Priya scheduled triggers', () => {
  let mockRuntime: WorkflowRuntime

  beforeEach(() => {
    mockRuntime = {
      repo: {
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        url: 'https://github.com/test-org/test-repo',
      },
      issues: {
        list: vi.fn(),
        ready: vi.fn(),
        blocked: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        close: vi.fn(),
        show: vi.fn(),
      },
      agents: {
        list: vi.fn(),
        match: vi.fn(),
      },
      dag: {
        ready: vi.fn(),
        criticalPath: vi.fn(),
        blockedBy: vi.fn(),
        unblocks: vi.fn(),
      },
      pr: {
        create: vi.fn(),
        merge: vi.fn(),
        comment: vi.fn(),
        waitForApproval: vi.fn(),
        list: vi.fn(),
      },
      epics: {
        list: vi.fn(),
        progress: vi.fn(),
        create: vi.fn(),
      },
      git: {
        commit: vi.fn(),
        push: vi.fn(),
        pull: vi.fn(),
        branch: vi.fn(),
        checkout: vi.fn(),
        status: vi.fn(),
        diff: vi.fn(),
        worktree: {
          create: vi.fn(),
          remove: vi.fn(),
          list: vi.fn(),
        },
      },
      todo: {
        render: vi.fn(),
        ready: vi.fn(),
        blocked: vi.fn(),
        inProgress: vi.fn(),
      },
      claude: vi.fn() as any,
    }
  })

  describe('dailyStandup', () => {
    it('should generate status summary with in-progress, blocked, and ready counts', async () => {
      const inProgressIssue: Issue = {
        id: 'test-1',
        title: 'Implement auth',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        assignee: 'tom',
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const blockedIssue: Issue = {
        id: 'test-2',
        title: 'Build dashboard',
        status: 'blocked',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-1'],
        blocks: [],
      }

      const readyIssue: Issue = {
        id: 'test-3',
        title: 'Write tests',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      // Mock issues.list to return all issues
      vi.mocked(mockRuntime.issues.list).mockResolvedValue([
        inProgressIssue,
        blockedIssue,
        readyIssue,
      ])

      // Mock issues.blocked
      vi.mocked(mockRuntime.issues.blocked).mockResolvedValue([blockedIssue])

      // Mock dag.ready
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([readyIssue])

      const summary = await dailyStandup(mockRuntime)

      // Should contain correct counts
      expect(summary).toContain('1')
      expect(summary).toContain('in progress')
      expect(summary).toContain('blocked')
      expect(summary).toContain('ready')

      // Should call the appropriate methods
      expect(mockRuntime.issues.list).toHaveBeenCalledWith({ status: 'in_progress' })
      expect(mockRuntime.issues.blocked).toHaveBeenCalled()
      expect(mockRuntime.dag.ready).toHaveBeenCalled()
    })

    it('should flag blocked issues with high priority', async () => {
      const highPriorityBlocked: Issue = {
        id: 'test-1',
        title: 'Critical feature',
        status: 'blocked',
        type: 'feature',
        priority: 1, // High priority
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-2'],
        blocks: [],
      }

      const lowPriorityBlocked: Issue = {
        id: 'test-3',
        title: 'Minor task',
        status: 'blocked',
        type: 'task',
        priority: 3, // Low priority
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-4'],
        blocks: [],
      }

      vi.mocked(mockRuntime.issues.list).mockResolvedValue([])
      vi.mocked(mockRuntime.issues.blocked).mockResolvedValue([
        highPriorityBlocked,
        lowPriorityBlocked,
      ])
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([])

      const summary = await dailyStandup(mockRuntime)

      // Should highlight the high-priority blocked issue
      expect(summary).toContain('Critical feature')
      expect(summary).toContain('priority 1')
    })

    it('should return summary even when no issues exist', async () => {
      vi.mocked(mockRuntime.issues.list).mockResolvedValue([])
      vi.mocked(mockRuntime.issues.blocked).mockResolvedValue([])
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([])

      const summary = await dailyStandup(mockRuntime)

      // Should have a summary message
      expect(summary).toBeTruthy()
      expect(summary.length).toBeGreaterThan(0)
      expect(summary).toContain('0')
    })
  })

  describe('weeklyPlanning', () => {
    it('should identify high-priority ready issues for prioritization', async () => {
      const highPriorityReady: Issue = {
        id: 'test-1',
        title: 'Critical bug fix',
        status: 'open',
        type: 'bug',
        priority: 1,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: ['test-2', 'test-3'],
      }

      const lowPriorityReady: Issue = {
        id: 'test-4',
        title: 'Nice to have feature',
        status: 'open',
        type: 'feature',
        priority: 3,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([
        highPriorityReady,
        lowPriorityReady,
      ])
      vi.mocked(mockRuntime.dag.criticalPath).mockResolvedValue([])
      vi.mocked(mockRuntime.agents.list).mockResolvedValue([])

      const plan = await weeklyPlanning(mockRuntime)

      // Should prioritize high-priority issues
      expect(plan).toContain('Critical bug fix')
      expect(plan).toContain('priority 1')
      expect(plan).toContain('blocks 2')
    })

    it('should suggest assignments for unassigned ready issues', async () => {
      const unassignedIssue: Issue = {
        id: 'test-1',
        title: 'Implement TypeScript feature',
        description: 'Work with TypeScript and React',
        status: 'open',
        type: 'feature',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([unassignedIssue])
      vi.mocked(mockRuntime.dag.criticalPath).mockResolvedValue([])

      const mockAgents = [
        {
          name: 'tom',
          capabilities: [{ name: 'code' }],
          focus: ['**/*.ts', '**/*.tsx'],
        },
      ]
      vi.mocked(mockRuntime.agents.list).mockResolvedValue(mockAgents as any)

      vi.mocked(mockRuntime.agents.match).mockResolvedValue({
        agent: mockAgents[0] as any,
        confidence: 0.9,
        reason: 'TypeScript specialist',
      })

      const plan = await weeklyPlanning(mockRuntime)

      // Should suggest agent assignment
      expect(plan).toContain('tom')
      expect(plan).toContain('Implement TypeScript feature')
    })

    it('should analyze critical path and flag long chains', async () => {
      const criticalPathIssues: Issue[] = [
        {
          id: 'test-1',
          title: 'Foundation',
          status: 'in_progress',
          type: 'task',
          priority: 1,
          created: new Date(),
          updated: new Date(),
          dependsOn: [],
          blocks: ['test-2'],
        },
        {
          id: 'test-2',
          title: 'Core feature',
          status: 'open',
          type: 'task',
          priority: 1,
          created: new Date(),
          updated: new Date(),
          dependsOn: ['test-1'],
          blocks: ['test-3'],
        },
        {
          id: 'test-3',
          title: 'Polish',
          status: 'open',
          type: 'task',
          priority: 2,
          created: new Date(),
          updated: new Date(),
          dependsOn: ['test-2'],
          blocks: [],
        },
      ]

      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([])
      vi.mocked(mockRuntime.dag.criticalPath).mockResolvedValue(criticalPathIssues)

      const plan = await weeklyPlanning(mockRuntime)

      // Should mention critical path
      expect(plan).toContain('critical path')
      expect(plan).toContain('3')
      expect(mockRuntime.dag.criticalPath).toHaveBeenCalled()
    })

    it('should return planning summary even when no issues exist', async () => {
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([])
      vi.mocked(mockRuntime.dag.criticalPath).mockResolvedValue([])

      const plan = await weeklyPlanning(mockRuntime)

      // Should have a summary message
      expect(plan).toBeTruthy()
      expect(plan.length).toBeGreaterThan(0)
    })
  })
})
