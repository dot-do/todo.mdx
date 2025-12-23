/**
 * Tests for generator.ts
 */
import { describe, it, expect } from 'vitest'
import { generateTodoFile } from '../src/generator.js'
import type { TodoIssue } from '../src/types.js'

describe('generateTodoFile', () => {
  it('generates basic todo file with minimal fields', () => {
    const issue: TodoIssue = {
      id: 'todo-abc',
      title: 'Test Issue',
      status: 'open',
      priority: 2,
      type: 'task',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('---')
    expect(result).toContain('id: todo-abc')
    expect(result).toContain('title: "Test Issue"')
    expect(result).toContain('state: open')
    expect(result).toContain('priority: 2')
    expect(result).toContain('type: task')
    expect(result).toContain('labels: []')
    expect(result).toContain('# Test Issue')
  })

  it('generates todo file with description', () => {
    const issue: TodoIssue = {
      id: 'todo-def',
      title: 'Issue with Description',
      description: 'This is a detailed description\nwith multiple lines.',
      status: 'in_progress',
      priority: 1,
      type: 'feature',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('# Issue with Description')
    expect(result).toContain('This is a detailed description')
    expect(result).toContain('with multiple lines.')
  })

  it('generates todo file with labels', () => {
    const issue: TodoIssue = {
      id: 'todo-ghi',
      title: 'Issue with Labels',
      status: 'open',
      priority: 3,
      type: 'bug',
      labels: ['urgent', 'frontend', 'css'],
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('labels: ["urgent", "frontend", "css"]')
  })

  it('generates todo file with dependencies', () => {
    const issue: TodoIssue = {
      id: 'todo-jkl',
      title: 'Issue with Dependencies',
      status: 'open',
      priority: 2,
      type: 'task',
      dependsOn: ['todo-abc', 'todo-def'],
      blocks: ['todo-xyz'],
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('### Related Issues')
    expect(result).toContain('**Depends on:**')
    expect(result).toContain('- **todo-abc**')
    expect(result).toContain('- **todo-def**')
    expect(result).toContain('**Blocks:**')
    expect(result).toContain('- **todo-xyz**')
  })

  it('generates todo file with timestamps', () => {
    const issue: TodoIssue = {
      id: 'todo-mno',
      title: 'Issue with Timestamps',
      status: 'closed',
      priority: 2,
      type: 'task',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T12:00:00Z',
      closedAt: '2024-01-03T18:00:00Z',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('createdAt: "2024-01-01T00:00:00Z"')
    expect(result).toContain('updatedAt: "2024-01-02T12:00:00Z"')
    expect(result).toContain('closedAt: "2024-01-03T18:00:00Z"')
    expect(result).toContain('### Timeline')
    expect(result).toContain('**Created:**')
    expect(result).toContain('**Updated:**')
    expect(result).toContain('**Closed:**')
  })

  it('generates todo file with special characters in title', () => {
    const issue: TodoIssue = {
      id: 'todo-pqr',
      title: 'Issue: with special "characters" and #hashtags',
      status: 'open',
      priority: 2,
      type: 'task',
    }

    const result = generateTodoFile(issue)

    // Title should be quoted in frontmatter
    expect(result).toContain('title: "Issue: with special \\"characters\\" and #hashtags"')
    // Title should appear as-is in H1
    expect(result).toContain('# Issue: with special "characters" and #hashtags')
  })

  it('generates todo file with assignee', () => {
    const issue: TodoIssue = {
      id: 'todo-stu',
      title: 'Assigned Issue',
      status: 'in_progress',
      priority: 1,
      type: 'feature',
      assignee: 'john-doe',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('assignee: "john-doe"')
  })

  it('generates todo file with parent and children', () => {
    const issue: TodoIssue = {
      id: 'todo-vwx',
      title: 'Epic Issue',
      status: 'open',
      priority: 1,
      type: 'epic',
      children: ['todo-child1', 'todo-child2', 'todo-child3'],
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('### Related Issues')
    expect(result).toContain('**Children:**')
    expect(result).toContain('- **todo-child1**')
    expect(result).toContain('- **todo-child2**')
    expect(result).toContain('- **todo-child3**')
  })

  it('generates todo file with source field', () => {
    const issue: TodoIssue = {
      id: 'todo-yza',
      title: 'Issue from Beads',
      status: 'open',
      priority: 2,
      type: 'task',
      source: 'beads',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('source: "beads"')
  })
})
