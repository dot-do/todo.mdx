import { describe, it, expect } from 'vitest'
import { renderTemplate } from '../src/templates.js'
import type { TodoIssue } from '../src/types.js'

describe('renderTemplate', () => {
  const sampleIssue: TodoIssue = {
    id: 'todo-123',
    title: 'My Title',
    description: 'Sample description',
    status: 'open',
    type: 'task',
    priority: 1,
    assignee: 'john-doe',
    labels: ['bug', 'urgent'],
    createdAt: '2025-12-23T00:00:00Z',
    updatedAt: '2025-12-23T01:00:00Z',
  }

  it('should interpolate simple field access', () => {
    const result = renderTemplate('# {issue.title}', { issue: sampleIssue })
    expect(result).toBe('# My Title')
  })

  it('should handle multiple interpolations', () => {
    const result = renderTemplate(
      '# {issue.title}\n\nStatus: {issue.status}\nPriority: {issue.priority}',
      { issue: sampleIssue }
    )
    expect(result).toBe('# My Title\n\nStatus: open\nPriority: 1')
  })

  it('should handle nested access gracefully when value exists', () => {
    const issueWithNested: TodoIssue = {
      ...sampleIssue,
      assignee: 'jane-smith',
    }
    const result = renderTemplate('Assignee: {issue.assignee}', {
      issue: issueWithNested,
    })
    expect(result).toBe('Assignee: jane-smith')
  })

  it('should handle nested access gracefully when value is null', () => {
    const issueWithNull: TodoIssue = {
      ...sampleIssue,
      assignee: undefined,
    }
    const result = renderTemplate('Assignee: {issue.assignee}', {
      issue: issueWithNull,
    })
    expect(result).toBe('Assignee: ')
  })

  it('should render arrays by joining with comma', () => {
    const result = renderTemplate('Labels: {issue.labels}', { issue: sampleIssue })
    expect(result).toBe('Labels: bug, urgent')
  })

  it('should handle empty arrays', () => {
    const issueNoLabels: TodoIssue = {
      ...sampleIssue,
      labels: [],
    }
    const result = renderTemplate('Labels: {issue.labels}', { issue: issueNoLabels })
    expect(result).toBe('Labels: ')
  })

  it('should handle undefined arrays', () => {
    const issueNoLabels: TodoIssue = {
      ...sampleIssue,
      labels: undefined,
    }
    const result = renderTemplate('Labels: {issue.labels}', { issue: issueNoLabels })
    expect(result).toBe('Labels: ')
  })

  it('should return empty string for missing slots', () => {
    const result = renderTemplate('Value: {issue.nonexistent}', { issue: sampleIssue })
    expect(result).toBe('Value: ')
  })

  it('should not render "undefined" as a string', () => {
    const result = renderTemplate('Value: {issue.closedAt}', { issue: sampleIssue })
    expect(result).not.toContain('undefined')
    expect(result).toBe('Value: ')
  })

  it('should preserve literal braces (escaped slots)', () => {
    const result = renderTemplate('This {{notASlot}} is literal', { issue: sampleIssue })
    expect(result).toBe('This {notASlot} is literal')
  })

  it('should preserve literal braces with spaces', () => {
    const result = renderTemplate('Code: {{ value }}', { issue: sampleIssue })
    expect(result).toBe('Code: { value }')
  })

  it('should handle mixed literal and interpolated braces', () => {
    const result = renderTemplate(
      'Title: {issue.title}, Code: {{example}}',
      { issue: sampleIssue }
    )
    expect(result).toBe('Title: My Title, Code: {example}')
  })

  it('should handle complex template with multiple features', () => {
    const template = `# {issue.title}

**Status:** {issue.status}
**Priority:** {issue.priority}
**Labels:** {issue.labels}
**Assignee:** {issue.assignee}

Description: {issue.description}

Note: Use {{brackets}} for literal braces.`

    const expected = `# My Title

**Status:** open
**Priority:** 1
**Labels:** bug, urgent
**Assignee:** john-doe

Description: Sample description

Note: Use {brackets} for literal braces.`

    const result = renderTemplate(template, { issue: sampleIssue })
    expect(result).toBe(expected)
  })

  it('should handle empty template', () => {
    const result = renderTemplate('', { issue: sampleIssue })
    expect(result).toBe('')
  })

  it('should handle template with no interpolations', () => {
    const result = renderTemplate('Just plain text', { issue: sampleIssue })
    expect(result).toBe('Just plain text')
  })
})
