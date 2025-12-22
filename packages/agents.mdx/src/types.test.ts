/**
 * Type tests for beads-workflows re-exports
 *
 * Tests that:
 * 1. Types are correctly re-exported from beads-workflows
 * 2. agents.mdx Issue is compatible with beads-workflows Issue
 * 3. Type conversions work correctly
 */
import { describe, it, expect, expectTypeOf } from 'vitest'
import type {
  Issue,
  IssueStatus,
  IssueType,
  Priority,
  IssueFilter,
  // Re-exports from beads-workflows
  BeadsIssue,
  BeadsIssueStatus,
  BeadsIssueType,
  BeadsPriority,
  BeadsEpic,
  BeadsChanges,
  BeadsIssueEvent,
  BeadsConfig,
} from './types.js'

describe('beads-workflows type re-exports', () => {
  it('should re-export BeadsIssue from beads-workflows', () => {
    // BeadsIssue should have the core beads-workflows structure
    const issue: BeadsIssue = {
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
    expect(issue.id).toBe('test-1')
  })

  it('should re-export BeadsIssueStatus from beads-workflows', () => {
    // BeadsIssueStatus should be the narrower type without 'blocked'
    const status: BeadsIssueStatus = 'open'
    expect(status).toBe('open')

    // These should all be valid
    const statuses: BeadsIssueStatus[] = ['open', 'in_progress', 'closed']
    expect(statuses).toHaveLength(3)
  })

  it('should re-export BeadsIssueType from beads-workflows', () => {
    // BeadsIssueType should be the narrower type without 'chore'
    const issueType: BeadsIssueType = 'task'
    expect(issueType).toBe('task')

    // These should all be valid
    const types: BeadsIssueType[] = ['task', 'bug', 'feature', 'epic']
    expect(types).toHaveLength(4)
  })

  it('should re-export BeadsPriority from beads-workflows', () => {
    // BeadsPriority should be the specific 0-4 union type
    const priority: BeadsPriority = 2
    expect(priority).toBe(2)

    // These should all be valid
    const priorities: BeadsPriority[] = [0, 1, 2, 3, 4]
    expect(priorities).toHaveLength(5)
  })

  it('should re-export BeadsEpic from beads-workflows', () => {
    const epic: BeadsEpic = {
      id: 'epic-1',
      title: 'Test Epic',
      status: 'open',
      type: 'epic',
      priority: 1,
      created: new Date(),
      updated: new Date(),
      dependsOn: [],
      blocks: [],
      children: ['task-1', 'task-2'],
    }
    expect(epic.children).toHaveLength(2)
  })

  it('should re-export BeadsChanges from beads-workflows', () => {
    const changes: BeadsChanges = {
      status: { from: 'open', to: 'in_progress' },
      priority: { from: 2, to: 1 },
    }
    expect(changes.status?.to).toBe('in_progress')
  })

  it('should re-export BeadsIssueEvent from beads-workflows', () => {
    const event: BeadsIssueEvent = {
      type: 'updated',
      issueId: 'test-1',
      timestamp: new Date(),
      changes: {
        status: { from: 'open', to: 'closed' },
      },
    }
    expect(event.type).toBe('updated')
  })

  it('should re-export BeadsConfig from beads-workflows', () => {
    const config: BeadsConfig = {
      prefix: 'todo',
      path: '.beads',
    }
    expect(config.prefix).toBe('todo')
  })
})

describe('agents.mdx Issue type', () => {
  it('should have the extended status with blocked', () => {
    // agents.mdx Issue supports 'blocked' status
    const status: IssueStatus = 'blocked'
    expect(status).toBe('blocked')

    const statuses: IssueStatus[] = ['open', 'in_progress', 'blocked', 'closed']
    expect(statuses).toHaveLength(4)
  })

  it('should have the extended type with chore', () => {
    // agents.mdx Issue supports 'chore' type
    const issueType: IssueType = 'chore'
    expect(issueType).toBe('chore')

    const types: IssueType[] = ['bug', 'feature', 'task', 'epic', 'chore']
    expect(types).toHaveLength(5)
  })

  it('should use number for priority', () => {
    // agents.mdx uses number (more flexible than BeadsPriority)
    const priority: Priority = 5 // Can be any number
    expect(priority).toBe(5)
  })

  it('should have string dates for serialization', () => {
    const issue: Issue = {
      id: 'test-1',
      title: 'Test Issue',
      description: 'Test description',
      status: 'open',
      priority: 2,
      type: 'task',
      labels: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    expect(typeof issue.createdAt).toBe('string')
    expect(typeof issue.updatedAt).toBe('string')
  })
})

describe('IssueFilter type', () => {
  it('should work with agents.mdx status values', () => {
    const filter: IssueFilter = {
      status: 'blocked',
      type: 'chore',
      priority: 1,
    }
    expect(filter.status).toBe('blocked')
    expect(filter.type).toBe('chore')
  })
})

describe('type compatibility', () => {
  it('should allow converting BeadsIssue to agents.mdx Issue', () => {
    const beadsIssue: BeadsIssue = {
      id: 'test-1',
      title: 'Test Issue',
      description: 'Test description',
      status: 'open',
      type: 'task',
      priority: 2,
      labels: ['test'],
      created: new Date('2024-01-01'),
      updated: new Date('2024-01-01'),
      dependsOn: [],
      blocks: [],
    }

    // Convert to agents.mdx Issue
    const issue: Issue = {
      id: beadsIssue.id,
      title: beadsIssue.title,
      description: beadsIssue.description ?? '',
      status: beadsIssue.status,
      priority: beadsIssue.priority,
      type: beadsIssue.type,
      labels: beadsIssue.labels ?? [],
      createdAt: beadsIssue.created.toISOString(),
      updatedAt: beadsIssue.updated.toISOString(),
      closedAt: beadsIssue.closed?.toISOString(),
    }

    expect(issue.id).toBe(beadsIssue.id)
    expect(issue.status).toBe(beadsIssue.status)
  })

  it('BeadsIssueStatus should be assignable to IssueStatus', () => {
    const beadsStatus: BeadsIssueStatus = 'open'
    const status: IssueStatus = beadsStatus
    expect(status).toBe('open')
  })

  it('BeadsIssueType should be assignable to IssueType', () => {
    const beadsType: BeadsIssueType = 'task'
    const issueType: IssueType = beadsType
    expect(issueType).toBe('task')
  })

  it('BeadsPriority should be assignable to Priority', () => {
    const beadsPriority: BeadsPriority = 2
    const priority: Priority = beadsPriority
    expect(priority).toBe(2)
  })
})
