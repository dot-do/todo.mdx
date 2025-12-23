import { describe, it, expect } from 'vitest'
import { parseTodoFile } from '../src/parser.js'

describe('parseTodoFile', () => {
  it('should parse basic frontmatter and content', () => {
    const content = `---
id: todo-123
title: "Test issue"
state: open
priority: 2
type: task
---

# Test issue

This is the description.
`

    const result = parseTodoFile(content)

    expect(result.issue.id).toBe('todo-123')
    expect(result.issue.title).toBe('Test issue')
    expect(result.issue.status).toBe('open')
    expect(result.issue.priority).toBe(2)
    expect(result.issue.type).toBe('task')
    expect(result.issue.source).toBe('file')
    expect(result.issue.description).toBe('# Test issue\n\nThis is the description.')
  })

  it('should parse labels array', () => {
    const content = `---
id: todo-456
title: "Bug fix"
state: closed
type: bug
labels: [urgent, security]
---

Fix security vulnerability.
`

    const result = parseTodoFile(content)

    expect(result.issue.labels).toEqual(['urgent', 'security'])
    expect(result.issue.type).toBe('bug')
    expect(result.issue.status).toBe('closed')
  })

  it('should map state values to status', () => {
    const testCases = [
      { state: 'open', expected: 'open' },
      { state: 'closed', expected: 'closed' },
      { state: 'in_progress', expected: 'in_progress' },
      { state: 'in-progress', expected: 'in_progress' },
      { state: 'done', expected: 'closed' },
      { state: 'completed', expected: 'closed' },
    ]

    for (const { state, expected } of testCases) {
      const content = `---
id: test
title: Test
state: ${state}
---
Content
`
      const result = parseTodoFile(content)
      expect(result.issue.status).toBe(expected)
    }
  })

  it('should handle quoted strings in frontmatter', () => {
    const content = `---
id: todo-789
title: "Issue with 'quotes'"
state: open
assignee: "john@example.com"
---

Description
`

    const result = parseTodoFile(content)

    expect(result.issue.title).toBe("Issue with 'quotes'")
    expect(result.issue.assignee).toBe('john@example.com')
  })

  it('should normalize types', () => {
    const testCases = [
      { type: 'task', expected: 'task' },
      { type: 'bug', expected: 'bug' },
      { type: 'feature', expected: 'feature' },
      { type: 'epic', expected: 'epic' },
      { type: 'unknown', expected: 'task' }, // default
    ]

    for (const { type, expected } of testCases) {
      const content = `---
id: test
title: Test
type: ${type}
---
Content
`
      const result = parseTodoFile(content)
      expect(result.issue.type).toBe(expected)
    }
  })

  it('should throw error for missing frontmatter (no ID)', () => {
    const content = 'Just some content without frontmatter'

    // Should throw because there's no ID in frontmatter
    expect(() => parseTodoFile(content)).toThrow(/ID cannot be empty/)
  })

  it('should parse dependency arrays', () => {
    const content = `---
id: todo-999
title: "Complex issue"
dependsOn: [todo-001, todo-002]
blocks: [todo-100]
children: [todo-200, todo-201]
---

Complex description.
`

    const result = parseTodoFile(content)

    expect(result.issue.dependsOn).toEqual(['todo-001', 'todo-002'])
    expect(result.issue.blocks).toEqual(['todo-100'])
    expect(result.issue.children).toEqual(['todo-200', 'todo-201'])
  })

  it('should handle numeric values', () => {
    const content = `---
id: todo-numeric
title: Test
priority: 4
state: open
---

Content
`

    const result = parseTodoFile(content)

    expect(result.issue.priority).toBe(4)
  })

  it('should default priority to 2', () => {
    const content = `---
id: todo-default
title: Test
---

Content
`

    const result = parseTodoFile(content)

    expect(result.issue.priority).toBe(2)
  })

  it('should parse real example file format', () => {
    const content = `---
id: todo-01p
title: "Web IDE layout: file tree + Monaco + terminal"
state: closed
priority: 2
type: feature
labels: [ide, layout, ui]
---

# Web IDE layout: file tree + Monaco + terminal

Create the full IDE layout combining file tree, Monaco editor, and terminal.
`

    const result = parseTodoFile(content)

    expect(result.issue.id).toBe('todo-01p')
    expect(result.issue.title).toBe('Web IDE layout: file tree + Monaco + terminal')
    expect(result.issue.status).toBe('closed')
    expect(result.issue.priority).toBe(2)
    expect(result.issue.type).toBe('feature')
    expect(result.issue.labels).toEqual(['ide', 'layout', 'ui'])
  })

  // Validation tests for todo-eja1: Priority range validation
  describe('priority validation (todo-eja1)', () => {
    it('should clamp priority < 0 to 0', () => {
      const content = `---
id: todo-test
title: Test
priority: -5
---
Content
`
      const result = parseTodoFile(content)
      expect(result.issue.priority).toBe(0)
    })

    it('should clamp priority > 4 to 4', () => {
      const content = `---
id: todo-test
title: Test
priority: 10
---
Content
`
      const result = parseTodoFile(content)
      expect(result.issue.priority).toBe(4)
    })

    it('should floor non-integer priority to nearest integer', () => {
      const content = `---
id: todo-test
title: Test
priority: 2.7
---
Content
`
      const result = parseTodoFile(content)
      expect(result.issue.priority).toBe(2)
    })

    it('should floor and clamp non-integer priority outside range', () => {
      const content = `---
id: todo-test
title: Test
priority: 4.9
---
Content
`
      const result = parseTodoFile(content)
      expect(result.issue.priority).toBe(4)
    })
  })

  // Validation tests for todo-ndl7: Reject empty issue IDs
  describe('ID validation (todo-ndl7)', () => {
    it('should throw error for empty string ID', () => {
      const content = `---
id: ""
title: Test
---
Content
`
      expect(() => parseTodoFile(content)).toThrow(/ID cannot be empty/)
    })

    it('should throw error for whitespace-only ID', () => {
      const content = `---
id: "   "
title: Test
---
Content
`
      expect(() => parseTodoFile(content)).toThrow(/ID cannot be empty/)
    })

    it('should throw error for missing ID in frontmatter', () => {
      const content = `---
title: Test
---
Content
`
      expect(() => parseTodoFile(content)).toThrow(/ID cannot be empty/)
    })
  })
})
