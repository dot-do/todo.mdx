import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleAssignment, shouldTriggerWorkflow } from './assignment'
import type { Issue } from 'beads-workflows'
import { getBuiltinAgent } from '../agents/builtin'

describe('assignment trigger', () => {
  describe('shouldTriggerWorkflow', () => {
    it('should return true when issue assigned to agent with no blockers', () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const result = shouldTriggerWorkflow(issue, new Map())
      expect(result).toBe(true)
    })

    it('should return false when assignee is not an agent', () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'human-developer',
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const result = shouldTriggerWorkflow(issue, new Map())
      expect(result).toBe(false)
    })

    it('should return false when issue has no assignee', () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const result = shouldTriggerWorkflow(issue, new Map())
      expect(result).toBe(false)
    })

    it('should return false when issue is closed', () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'closed',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const result = shouldTriggerWorkflow(issue, new Map())
      expect(result).toBe(false)
    })

    it('should return false when issue has open blockers', () => {
      const blocker: Issue = {
        id: 'blocker-1',
        title: 'Blocker Issue',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: ['test-1'],
      }

      const issue: Issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        dependsOn: ['blocker-1'],
        blocks: [],
      }

      const issuesMap = new Map([
        ['blocker-1', blocker],
        ['test-1', issue],
      ])

      const result = shouldTriggerWorkflow(issue, issuesMap)
      expect(result).toBe(false)
    })

    it('should return true when blocker is closed', () => {
      const blocker: Issue = {
        id: 'blocker-1',
        title: 'Blocker Issue',
        status: 'closed',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        closed: new Date(),
        dependsOn: [],
        blocks: ['test-1'],
      }

      const issue: Issue = {
        id: 'test-1',
        title: 'Test Issue',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        dependsOn: ['blocker-1'],
        blocks: [],
      }

      const issuesMap = new Map([
        ['blocker-1', blocker],
        ['test-1', issue],
      ])

      const result = shouldTriggerWorkflow(issue, issuesMap)
      expect(result).toBe(true)
    })

    it('should work with all builtin agent IDs', () => {
      const agentIds = ['priya', 'reed', 'benny', 'cody', 'dana', 'fiona']

      agentIds.forEach(agentId => {
        const issue: Issue = {
          id: 'test-1',
          title: 'Test Issue',
          status: 'open',
          type: 'task',
          priority: 2,
          assignee: agentId,
          created: new Date(),
          updated: new Date(),
          dependsOn: [],
          blocks: [],
        }

        const result = shouldTriggerWorkflow(issue, new Map())
        expect(result).toBe(true)
      })
    })
  })

  describe('handleAssignment', () => {
    let mockWorkflowCreate: ReturnType<typeof vi.fn>
    let mockWorkflowGet: ReturnType<typeof vi.fn>
    let mockWorkflowTerminate: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockWorkflowCreate = vi.fn()
      mockWorkflowGet = vi.fn()
      mockWorkflowTerminate = vi.fn()
    })

    it('should trigger DevelopWorkflow when issue assigned to agent', async () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Implement feature X',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const mockInstance = {
        id: 'develop-test-1-123',
        status: 'running' as const,
        pause: vi.fn(),
        resume: vi.fn(),
        terminate: mockWorkflowTerminate,
        sendEvent: vi.fn(),
      }

      mockWorkflowCreate.mockResolvedValue(mockInstance)

      const env = {
        DEVELOP_WORKFLOW: {
          create: mockWorkflowCreate,
          get: mockWorkflowGet,
        },
      }

      const repo = {
        owner: 'test-owner',
        name: 'test-repo',
      }

      await handleAssignment({
        issue,
        issuesMap: new Map([['test-1', issue]]),
        env: env as any,
        repo,
        installationId: 12345,
      })

      expect(mockWorkflowCreate).toHaveBeenCalledWith({
        id: expect.stringContaining('develop-test-1-'),
        params: expect.objectContaining({
          repo,
          issue,
          installationId: 12345,
          agentConfig: expect.objectContaining({
            id: 'cody',
            name: 'Coder Cody',
          }),
        }),
      })
    })

    it('should not trigger workflow when assignee is not an agent', async () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Manual task',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'human-dev',
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const env = {
        DEVELOP_WORKFLOW: {
          create: mockWorkflowCreate,
          get: mockWorkflowGet,
        },
      }

      const repo = {
        owner: 'test-owner',
        name: 'test-repo',
      }

      await handleAssignment({
        issue,
        issuesMap: new Map([['test-1', issue]]),
        env: env as any,
        repo,
        installationId: 12345,
      })

      expect(mockWorkflowCreate).not.toHaveBeenCalled()
    })

    it('should not trigger workflow when issue has blockers', async () => {
      const blocker: Issue = {
        id: 'blocker-1',
        title: 'Blocker',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: ['test-1'],
      }

      const issue: Issue = {
        id: 'test-1',
        title: 'Blocked task',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        dependsOn: ['blocker-1'],
        blocks: [],
      }

      const env = {
        DEVELOP_WORKFLOW: {
          create: mockWorkflowCreate,
          get: mockWorkflowGet,
        },
      }

      const repo = {
        owner: 'test-owner',
        name: 'test-repo',
      }

      await handleAssignment({
        issue,
        issuesMap: new Map([
          ['blocker-1', blocker],
          ['test-1', issue],
        ]),
        env: env as any,
        repo,
        installationId: 12345,
      })

      expect(mockWorkflowCreate).not.toHaveBeenCalled()
    })

    it('should cancel previous workflow on reassignment', async () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Reassigned task',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        assignee: 'dana', // Changed from cody to dana
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      const previousWorkflowInstance = {
        id: 'develop-test-1-old',
        status: 'running' as const,
        pause: vi.fn(),
        resume: vi.fn(),
        terminate: mockWorkflowTerminate,
        sendEvent: vi.fn(),
      }

      const newWorkflowInstance = {
        id: 'develop-test-1-new',
        status: 'running' as const,
        pause: vi.fn(),
        resume: vi.fn(),
        terminate: vi.fn(),
        sendEvent: vi.fn(),
      }

      mockWorkflowGet.mockResolvedValue(previousWorkflowInstance)
      mockWorkflowCreate.mockResolvedValue(newWorkflowInstance)

      const env = {
        DEVELOP_WORKFLOW: {
          create: mockWorkflowCreate,
          get: mockWorkflowGet,
        },
      }

      const repo = {
        owner: 'test-owner',
        name: 'test-repo',
      }

      await handleAssignment({
        issue,
        issuesMap: new Map([['test-1', issue]]),
        env: env as any,
        repo,
        installationId: 12345,
        previousAssignee: 'cody',
      })

      // Should terminate the old workflow
      expect(mockWorkflowTerminate).toHaveBeenCalled()

      // Should create new workflow
      expect(mockWorkflowCreate).toHaveBeenCalledWith({
        id: expect.stringContaining('develop-test-1-'),
        params: expect.objectContaining({
          agentConfig: expect.objectContaining({
            id: 'dana',
          }),
        }),
      })
    })

    it('should include agent config in workflow payload', async () => {
      const issue: Issue = {
        id: 'test-1',
        title: 'Test task',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'cody',
        created: new Date(),
        updated: new Date(),
        dependsOn: [],
        blocks: [],
      }

      mockWorkflowCreate.mockResolvedValue({
        id: 'develop-test-1-123',
        status: 'running',
        pause: vi.fn(),
        resume: vi.fn(),
        terminate: vi.fn(),
        sendEvent: vi.fn(),
      })

      const env = {
        DEVELOP_WORKFLOW: {
          create: mockWorkflowCreate,
          get: mockWorkflowGet,
        },
      }

      const repo = {
        owner: 'test-owner',
        name: 'test-repo',
      }

      await handleAssignment({
        issue,
        issuesMap: new Map([['test-1', issue]]),
        env: env as any,
        repo,
        installationId: 12345,
      })

      const agent = getBuiltinAgent('cody')
      expect(mockWorkflowCreate).toHaveBeenCalledWith({
        id: expect.any(String),
        params: expect.objectContaining({
          agentConfig: agent,
        }),
      })
    })
  })
})
