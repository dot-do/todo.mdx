import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  onIssueClosed,
  onEpicCompleted,
  onIssueBlocked,
  onPRMerged,
} from './triggers'
import type { Issue } from 'beads-workflows'
import type { WorkflowRuntime } from '@todo.mdx/agents.mdx'

describe('Priya triggers', () => {
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

  describe('onIssueClosed', () => {
    it('should find and assign newly unblocked issues', async () => {
      const closedIssue: Issue = {
        id: 'test-1',
        title: 'Implement feature A',
        status: 'closed',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: ['test-2', 'test-3'],
      }

      const unblockedIssue1: Issue = {
        id: 'test-2',
        title: 'Build on feature A',
        description: 'This requires TypeScript',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-1'],
        blocks: [],
      }

      const unblockedIssue2: Issue = {
        id: 'test-3',
        title: 'Another feature depending on A',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-1'],
        blocks: [],
      }

      const allIssues = [closedIssue, unblockedIssue1, unblockedIssue2]

      // Mock issues.list to return all issues
      vi.mocked(mockRuntime.issues.list).mockResolvedValue(allIssues)

      // Mock dag.unblocks to return newly unblocked issues
      vi.mocked(mockRuntime.dag.unblocks).mockResolvedValue([
        unblockedIssue1,
        unblockedIssue2,
      ])

      // Mock dag.ready to return issues with no blockers
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([
        unblockedIssue1,
        unblockedIssue2,
      ])

      // Mock agents.list
      const mockAgents = [
        {
          name: 'tom',
          capabilities: [{ name: 'code' }],
          focus: ['**/*.ts', '**/*.tsx'],
        },
        {
          name: 'cody',
          capabilities: [{ name: 'code' }],
        },
      ]
      vi.mocked(mockRuntime.agents.list).mockResolvedValue(mockAgents as any)

      // Mock agents.match for each issue
      vi.mocked(mockRuntime.agents.match)
        .mockResolvedValueOnce({
          agent: mockAgents[0] as any,
          confidence: 0.9,
          reason: 'TypeScript specialist',
        })
        .mockResolvedValueOnce({
          agent: mockAgents[1] as any,
          confidence: 0.7,
          reason: 'General developer',
        })

      await onIssueClosed(mockRuntime, closedIssue)

      // Should update newly unblocked issues with matched agents
      expect(mockRuntime.issues.update).toHaveBeenCalledWith('test-2', {
        assignee: 'tom',
      })
      expect(mockRuntime.issues.update).toHaveBeenCalledWith('test-3', {
        assignee: 'cody',
      })
    })

    it('should not assign if no agent matches', async () => {
      const closedIssue: Issue = {
        id: 'test-1',
        title: 'Fixed bug',
        status: 'closed',
        type: 'bug',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: ['test-2'],
      }

      const unblockedIssue: Issue = {
        id: 'test-2',
        title: 'Issue with no matching agent',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-1'],
        blocks: [],
      }

      vi.mocked(mockRuntime.issues.list).mockResolvedValue([
        closedIssue,
        unblockedIssue,
      ])
      vi.mocked(mockRuntime.dag.unblocks).mockResolvedValue([unblockedIssue])
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([unblockedIssue])
      vi.mocked(mockRuntime.agents.list).mockResolvedValue([])
      vi.mocked(mockRuntime.agents.match).mockResolvedValue(null)

      await onIssueClosed(mockRuntime, closedIssue)

      // Should not update issue if no match
      expect(mockRuntime.issues.update).not.toHaveBeenCalled()
    })

    it('should only assign issues that are actually ready', async () => {
      const closedIssue: Issue = {
        id: 'test-1',
        title: 'Feature A',
        status: 'closed',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: ['test-2'],
      }

      const stillBlockedIssue: Issue = {
        id: 'test-2',
        title: 'Depends on test-1 AND test-3',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-1', 'test-3'], // Still has open blocker test-3
        blocks: [],
      }

      const otherBlocker: Issue = {
        id: 'test-3',
        title: 'Another blocker',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: ['test-2'],
      }

      vi.mocked(mockRuntime.issues.list).mockResolvedValue([
        closedIssue,
        stillBlockedIssue,
        otherBlocker,
      ])
      vi.mocked(mockRuntime.dag.unblocks).mockResolvedValue([stillBlockedIssue])
      // dag.ready excludes test-2 because test-3 is still open
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([])
      vi.mocked(mockRuntime.agents.list).mockResolvedValue([])

      await onIssueClosed(mockRuntime, closedIssue)

      // Should not assign because issue is still blocked
      expect(mockRuntime.issues.update).not.toHaveBeenCalled()
    })
  })

  describe('onEpicCompleted', () => {
    it('should close epic when all children are closed', async () => {
      const epic: Issue = {
        id: 'epic-1',
        title: 'Build authentication system',
        status: 'in_progress',
        type: 'epic',
        priority: 1,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
        children: ['test-1', 'test-2', 'test-3'],
      }

      const child1: Issue = {
        id: 'test-1',
        title: 'Login flow',
        status: 'closed',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: [],
        parent: 'epic-1',
      }

      const child2: Issue = {
        id: 'test-2',
        title: 'Signup flow',
        status: 'closed',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: [],
        parent: 'epic-1',
      }

      const child3: Issue = {
        id: 'test-3',
        title: 'Password reset',
        status: 'closed',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: [],
        parent: 'epic-1',
      }

      const children = [child1, child2, child3]

      // Mock epics.progress to return completion status
      vi.mocked(mockRuntime.epics.progress).mockResolvedValue({
        total: 3,
        completed: 3,
        percentage: 100,
      })

      await onEpicCompleted(mockRuntime, epic, children)

      // Should close the epic
      expect(mockRuntime.issues.close).toHaveBeenCalledWith(
        'epic-1',
        'All child tasks completed'
      )
    })

    it('should not close epic if children are not all closed', async () => {
      const epic: Issue = {
        id: 'epic-1',
        title: 'Build dashboard',
        status: 'in_progress',
        type: 'epic',
        priority: 1,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
        children: ['test-1', 'test-2'],
      }

      const child1: Issue = {
        id: 'test-1',
        title: 'Charts component',
        status: 'closed',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: [],
        parent: 'epic-1',
      }

      const child2: Issue = {
        id: 'test-2',
        title: 'Data fetching',
        status: 'in_progress', // Still in progress
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
        parent: 'epic-1',
      }

      const children = [child1, child2]

      vi.mocked(mockRuntime.epics.progress).mockResolvedValue({
        total: 2,
        completed: 1,
        percentage: 50,
      })

      await onEpicCompleted(mockRuntime, epic, children)

      // Should not close epic
      expect(mockRuntime.issues.close).not.toHaveBeenCalled()
    })
  })

  describe('onIssueBlocked', () => {
    it('should reassign agent to other ready work when issue becomes blocked', async () => {
      const blockedIssue: Issue = {
        id: 'test-1',
        title: 'Feature X',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-2'], // Just got blocked by test-2
        blocks: [],
      }

      const blocker: Issue = {
        id: 'test-2',
        title: 'Dependency',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: ['test-1'],
      }

      const readyIssue: Issue = {
        id: 'test-3',
        title: 'Other task',
        description: 'Write code',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      // Mock dag.ready to return other ready issues
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([readyIssue])

      // Mock agents.list
      const mockAgents = [
        {
          name: 'cody',
          capabilities: [{ name: 'code' }],
        },
      ]
      vi.mocked(mockRuntime.agents.list).mockResolvedValue(mockAgents as any)

      // Mock agents.match for the ready issue
      vi.mocked(mockRuntime.agents.match).mockResolvedValue({
        agent: mockAgents[0] as any,
        confidence: 0.8,
        reason: 'Code capability match',
      })

      await onIssueBlocked(mockRuntime, blockedIssue, blocker)

      // Should clear assignee from blocked issue
      expect(mockRuntime.issues.update).toHaveBeenCalledWith('test-1', {
        assignee: undefined,
        status: 'open',
      })

      // Should assign agent to ready issue
      expect(mockRuntime.issues.update).toHaveBeenCalledWith('test-3', {
        assignee: 'cody',
      })
    })

    it('should not reassign if no ready work available', async () => {
      const blockedIssue: Issue = {
        id: 'test-1',
        title: 'Feature X',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        dependsOn: ['test-2'],
        blocks: [],
      }

      const blocker: Issue = {
        id: 'test-2',
        title: 'Dependency',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: ['test-1'],
      }

      // No ready issues available
      vi.mocked(mockRuntime.dag.ready).mockResolvedValue([])

      await onIssueBlocked(mockRuntime, blockedIssue, blocker)

      // Should clear assignee from blocked issue
      expect(mockRuntime.issues.update).toHaveBeenCalledWith('test-1', {
        assignee: undefined,
        status: 'open',
      })

      // Should not assign to any other issue (only called once)
      expect(mockRuntime.issues.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('onPRMerged', () => {
    it('should verify linked issue is closed when PR is merged', async () => {
      const pr = {
        number: 123,
        title: 'Fix: resolve login bug',
        body: 'Closes #test-1',
        branch: 'fix/login-bug',
        url: 'https://github.com/test-org/test-repo/pull/123',
        state: 'merged' as const,
      }

      const linkedIssue: Issue = {
        id: 'test-1',
        title: 'Login bug',
        status: 'closed', // Already closed
        type: 'bug',
        priority: 1,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: [],
      }

      // Mock issues.show to return the linked issue
      vi.mocked(mockRuntime.issues.show).mockResolvedValue(linkedIssue)

      await onPRMerged(mockRuntime, pr)

      // Should verify issue is closed (show was called)
      expect(mockRuntime.issues.show).toHaveBeenCalledWith('test-1')

      // Should not close again since already closed
      expect(mockRuntime.issues.close).not.toHaveBeenCalled()
    })

    it('should close issue if PR is merged but issue is still open', async () => {
      const pr = {
        number: 456,
        title: 'feat: add dark mode',
        body: 'Implements feature from #test-2',
        branch: 'feature/dark-mode',
        url: 'https://github.com/test-org/test-repo/pull/456',
        state: 'merged' as const,
      }

      const linkedIssue: Issue = {
        id: 'test-2',
        title: 'Add dark mode',
        status: 'in_progress', // Still in progress
        type: 'feature',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      vi.mocked(mockRuntime.issues.show).mockResolvedValue(linkedIssue)

      await onPRMerged(mockRuntime, pr)

      // Should close the issue
      expect(mockRuntime.issues.close).toHaveBeenCalledWith(
        'test-2',
        'Closed by merged PR #456'
      )
    })

    it('should handle PR with no linked issue gracefully', async () => {
      const pr = {
        number: 789,
        title: 'chore: update dependencies',
        body: 'Updates packages',
        branch: 'chore/deps',
        url: 'https://github.com/test-org/test-repo/pull/789',
        state: 'merged' as const,
      }

      await onPRMerged(mockRuntime, pr)

      // Should not attempt to show or close any issue
      expect(mockRuntime.issues.show).not.toHaveBeenCalled()
      expect(mockRuntime.issues.close).not.toHaveBeenCalled()
    })

    it('should handle issue not found gracefully', async () => {
      const pr = {
        number: 999,
        title: 'Fix: broken link',
        body: 'Fixes #nonexistent-issue',
        branch: 'fix/link',
        url: 'https://github.com/test-org/test-repo/pull/999',
        state: 'merged' as const,
      }

      // Mock issues.show to throw (issue not found)
      vi.mocked(mockRuntime.issues.show).mockRejectedValue(
        new Error('Issue not found')
      )

      // Should not throw
      await expect(onPRMerged(mockRuntime, pr)).resolves.not.toThrow()

      expect(mockRuntime.issues.close).not.toHaveBeenCalled()
    })
  })
})
