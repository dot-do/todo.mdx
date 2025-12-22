/**
 * Tests for Priya dependency review on issue.created
 *
 * TDD approach:
 * 1. Write failing tests
 * 2. Implement minimal code to pass
 * 3. Refactor
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Issue } from 'beads-workflows'
import type { WorkflowRuntime } from '@todo.mdx/agents.mdx'
import { reviewDependencies, onIssueCreated } from './dependency-review'

/**
 * Mock WorkflowRuntime for testing
 */
function createMockRuntime(): WorkflowRuntime {
  const issues = new Map<string, Issue>()
  let issueCounter = 0

  return {
    repo: {
      owner: 'test-owner',
      name: 'test-repo',
      defaultBranch: 'main',
      url: 'https://github.com/test-owner/test-repo',
    },
    issues: {
      async list(filter?: any) {
        const allIssues = Array.from(issues.values())
        if (!filter) return allIssues

        return allIssues.filter((issue) => {
          if (filter.status && issue.status !== filter.status) return false
          if (filter.type && issue.type !== filter.type) return false
          if (filter.priority !== undefined && issue.priority !== filter.priority) return false
          if (filter.assignee && issue.assignee !== filter.assignee) return false
          return true
        })
      },
      async ready() {
        return []
      },
      async blocked() {
        return []
      },
      async create(opts: any) {
        const issue: Issue = {
          id: `test-${++issueCounter}`,
          title: opts.title,
          description: opts.description,
          status: 'open',
          type: opts.type || 'task',
          priority: opts.priority || 2,
          assignee: undefined,
          labels: [],
          created: new Date(),
          updated: new Date(),
          dependsOn: [],
          blocks: [],
        }
        issues.set(issue.id, issue)
        return issue
      },
      async update(id: string, fields: any) {
        const issue = issues.get(id)
        if (!issue) throw new Error(`Issue ${id} not found`)

        const updated = { ...issue, ...fields, updated: new Date() }
        issues.set(id, updated)
        return updated
      },
      async close(id: string, reason?: string) {
        const issue = issues.get(id)
        if (!issue) throw new Error(`Issue ${id} not found`)
        issue.status = 'closed'
        issue.closed = new Date()
      },
      async show(id: string) {
        const issue = issues.get(id)
        if (!issue) throw new Error(`Issue ${id} not found`)
        return issue
      },
    },
    dag: {
      async ready() {
        return []
      },
      async criticalPath() {
        return []
      },
      async blockedBy(issueId: string) {
        return []
      },
      async unblocks(issueId: string) {
        return []
      },
    },
    agents: {
      async match(issue: Issue) {
        return null
      },
      async list() {
        return []
      },
    },
    epics: {
      async list() {
        return []
      },
      async progress(id: string) {
        return { total: 0, completed: 0, percentage: 0 }
      },
      async create(opts: any) {
        const issue: Issue = {
          id: `epic-${++issueCounter}`,
          title: opts.title,
          description: opts.description,
          status: 'open',
          type: 'epic',
          priority: 2,
          assignee: undefined,
          labels: [],
          created: new Date(),
          updated: new Date(),
          dependsOn: [],
          blocks: [],
          children: [],
        }
        issues.set(issue.id, issue)
        return issue
      },
    },
    pr: {} as any,
    claude: {} as any,
    git: {} as any,
    todo: {} as any,
  }
}

describe('reviewDependencies', () => {
  let runtime: WorkflowRuntime

  beforeEach(() => {
    runtime = createMockRuntime()
  })

  it('should detect issue references in description using #issue-id format', async () => {
    // Create the referenced issue first
    const dependency = await runtime.issues.create({
      title: 'Dependency task',
      type: 'task',
      priority: 2,
    })

    // Create issue that mentions the dependency
    const issue = await runtime.issues.create({
      title: 'New feature',
      description: `This feature depends on #${dependency.id}`,
      type: 'feature',
      priority: 2,
    })

    const suggestions = await reviewDependencies(runtime, issue)

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].dependsOnId).toBe(dependency.id)
    expect(suggestions[0].type).toBe('blocks')
    expect(suggestions[0].reason).toContain('mentioned in description')
  })

  it('should detect issue references using "depends on issue-id" format', async () => {
    const dependency = await runtime.issues.create({
      title: 'Setup database',
      type: 'task',
      priority: 1,
    })

    const issue = await runtime.issues.create({
      title: 'Create user endpoint',
      description: `This task depends on ${dependency.id} to be completed first`,
      type: 'task',
      priority: 2,
    })

    const suggestions = await reviewDependencies(runtime, issue)

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].dependsOnId).toBe(dependency.id)
  })

  it('should find dependencies based on file path mentions', async () => {
    const dependency = await runtime.issues.create({
      title: 'Fix auth bug',
      description: 'Fix bug in src/auth/login.ts',
      type: 'bug',
      priority: 1,
    })

    const issue = await runtime.issues.create({
      title: 'Add OAuth support',
      description: 'Add OAuth to src/auth/login.ts',
      type: 'feature',
      priority: 2,
    })

    const suggestions = await reviewDependencies(runtime, issue)

    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some((s) => s.dependsOnId === dependency.id)).toBe(true)
    expect(suggestions.find((s) => s.dependsOnId === dependency.id)?.reason).toContain(
      'shared file path'
    )
  })

  it('should not suggest circular dependencies', async () => {
    // Create issue A
    const issueA = await runtime.issues.create({
      title: 'Task A',
      description: 'First task',
      type: 'task',
      priority: 2,
    })

    // Create issue B that depends on A
    const issueB = await runtime.issues.create({
      title: 'Task B',
      description: `This depends on #${issueA.id}`,
      type: 'task',
      priority: 2,
    })

    // Add dependency B -> A
    await runtime.issues.update(issueB.id, {
      ...issueB,
      dependsOn: [issueA.id],
    })

    // Now update A to mention B (this would create a circular dependency)
    const updatedA = await runtime.issues.update(issueA.id, {
      ...issueA,
      description: `This task mentions #${issueB.id}`,
    })

    const suggestions = await reviewDependencies(runtime, updatedA)

    // Should not suggest A depends on B (would create a circular dependency)
    expect(suggestions.every((s) => s.dependsOnId !== issueB.id)).toBe(true)
  })

  it('should not suggest dependencies on closed issues', async () => {
    const closedIssue = await runtime.issues.create({
      title: 'Completed task',
      type: 'task',
      priority: 2,
    })

    await runtime.issues.close(closedIssue.id, 'Done')

    const issue = await runtime.issues.create({
      title: 'New task',
      description: `Mentions #${closedIssue.id}`,
      type: 'task',
      priority: 2,
    })

    const suggestions = await reviewDependencies(runtime, issue)

    expect(suggestions.every((s) => s.dependsOnId !== closedIssue.id)).toBe(true)
  })

  it('should not suggest self-dependencies', async () => {
    const issue = await runtime.issues.create({
      title: 'Self-referencing task',
      type: 'task',
      priority: 2,
    })

    // Update description to reference itself
    const updated = await runtime.issues.update(issue.id, {
      ...issue,
      description: `This task is ${issue.id}`,
    })

    const suggestions = await reviewDependencies(runtime, updated)

    expect(suggestions.every((s) => s.dependsOnId !== issue.id)).toBe(true)
  })
})

describe('onIssueCreated - auto-add mode', () => {
  let runtime: WorkflowRuntime

  beforeEach(() => {
    runtime = createMockRuntime()
  })

  it('should automatically add detected dependencies in auto-add mode', async () => {
    const dependency = await runtime.issues.create({
      title: 'Foundation',
      type: 'task',
      priority: 1,
    })

    const issue = await runtime.issues.create({
      title: 'New feature',
      description: `Depends on #${dependency.id}`,
      type: 'feature',
      priority: 2,
    })

    await onIssueCreated(runtime, issue, { mode: 'auto-add' })

    const updated = await runtime.issues.show(issue.id)
    expect(updated.dependsOn).toContain(dependency.id)
  })

  it('should not add dependencies in suggest-only mode', async () => {
    const dependency = await runtime.issues.create({
      title: 'Foundation',
      type: 'task',
      priority: 1,
    })

    const issue = await runtime.issues.create({
      title: 'New feature',
      description: `Depends on #${dependency.id}`,
      type: 'feature',
      priority: 2,
    })

    const result = await onIssueCreated(runtime, issue, { mode: 'suggest-only' })

    const updated = await runtime.issues.show(issue.id)
    expect(updated.dependsOn).not.toContain(dependency.id)
    expect(result.suggestions).toHaveLength(1)
  })

  it('should handle no dependencies gracefully', async () => {
    const issue = await runtime.issues.create({
      title: 'Standalone task',
      description: 'This task has no dependencies',
      type: 'task',
      priority: 2,
    })

    const result = await onIssueCreated(runtime, issue, { mode: 'auto-add' })

    expect(result.suggestions).toHaveLength(0)
    expect(result.added).toHaveLength(0)
  })
})
