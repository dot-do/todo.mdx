import { describe, it, expect } from 'vitest'
import { parseTodoFile } from '../src/parser.js'
import { generateTodoFile } from '../src/generator.js'
import type { TodoIssue } from '../src/types.js'

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

  // Tests for todo-r933: Replace custom parser with @mdxld/markdown fromMarkdown()
  describe('@mdxld/markdown integration (todo-r933)', () => {
    it('should extract frontmatter using fromMarkdown()', () => {
      const content = `---
id: todo-test-mdxld
title: "Test MDXLD"
state: open
priority: 3
type: feature
labels: ["test", "mdxld"]
assignee: "claude@example.com"
---

# Test MDXLD

This is a test description.
`

      const result = parseTodoFile(content)

      expect(result.issue.id).toBe('todo-test-mdxld')
      expect(result.issue.title).toBe('Test MDXLD')
      expect(result.issue.status).toBe('open')
      expect(result.issue.priority).toBe(3)
      expect(result.issue.type).toBe('feature')
      expect(result.issue.labels).toEqual(['test', 'mdxld'])
      expect(result.issue.assignee).toBe('claude@example.com')
      expect(result.issue.description).toContain('This is a test description')
    })

    it('should handle round-trip: issue → generateTodoFile() → parseTodoFile() → same object', () => {
      const originalIssue: TodoIssue = {
        id: 'todo-roundtrip',
        title: 'Round-trip test',
        description: 'Testing round-trip conversion',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        assignee: 'test@example.com',
        labels: ['test', 'roundtrip'],
        createdAt: '2025-12-23T10:00:00Z',
        updatedAt: '2025-12-23T10:30:00Z',
        dependsOn: ['todo-001'],
        blocks: ['todo-002'],
        children: ['todo-003'],
        parent: 'todo-parent',
        source: 'beads',
      }

      // Convert to markdown using generateTodoFile
      const markdown = generateTodoFile(originalIssue)

      // Parse back using parseTodoFile
      const parsed = parseTodoFile(markdown)

      // Verify all fields are preserved (note: description will include the heading and related issues section)
      expect(parsed.issue.id).toBe(originalIssue.id)
      expect(parsed.issue.title).toBe(originalIssue.title)
      expect(parsed.issue.status).toBe(originalIssue.status)
      expect(parsed.issue.type).toBe(originalIssue.type)
      expect(parsed.issue.priority).toBe(originalIssue.priority)
      expect(parsed.issue.assignee).toBe(originalIssue.assignee)
      expect(parsed.issue.labels).toEqual(originalIssue.labels)
      expect(parsed.issue.createdAt).toBe(originalIssue.createdAt)
      expect(parsed.issue.updatedAt).toBe(originalIssue.updatedAt)
      expect(parsed.issue.dependsOn).toEqual(originalIssue.dependsOn)
      expect(parsed.issue.blocks).toEqual(originalIssue.blocks)
      expect(parsed.issue.children).toEqual(originalIssue.children)
      expect(parsed.issue.parent).toBe(originalIssue.parent)
      expect(parsed.issue.source).toBe(originalIssue.source)

      // Description should contain the original description
      expect(parsed.issue.description).toContain('Testing round-trip conversion')
    })

    it('should handle all TodoIssue fields correctly', () => {
      const content = `---
id: todo-complete
title: "Complete test"
state: closed
priority: 4
type: bug
labels: ["critical", "security"]
assignee: "dev@example.com"
createdAt: "2025-12-01T00:00:00Z"
updatedAt: "2025-12-15T12:00:00Z"
closedAt: "2025-12-15T12:00:00Z"
dependsOn: ["todo-a", "todo-b"]
blocks: ["todo-c"]
children: ["todo-d", "todo-e"]
parent: "epic-001"
source: "beads"
---

# Complete test

Full description with all fields.
`

      const result = parseTodoFile(content)

      expect(result.issue.id).toBe('todo-complete')
      expect(result.issue.title).toBe('Complete test')
      expect(result.issue.status).toBe('closed')
      expect(result.issue.priority).toBe(4)
      expect(result.issue.type).toBe('bug')
      expect(result.issue.labels).toEqual(['critical', 'security'])
      expect(result.issue.assignee).toBe('dev@example.com')
      expect(result.issue.createdAt).toBe('2025-12-01T00:00:00Z')
      expect(result.issue.updatedAt).toBe('2025-12-15T12:00:00Z')
      expect(result.issue.closedAt).toBe('2025-12-15T12:00:00Z')
      expect(result.issue.dependsOn).toEqual(['todo-a', 'todo-b'])
      expect(result.issue.blocks).toEqual(['todo-c'])
      expect(result.issue.children).toEqual(['todo-d', 'todo-e'])
      expect(result.issue.parent).toBe('epic-001')
      expect(result.issue.source).toBe('beads')
    })

    it('should handle optional fields correctly when missing', () => {
      const content = `---
id: todo-minimal
title: "Minimal test"
state: open
priority: 2
type: task
---

Just a simple task.
`

      const result = parseTodoFile(content)

      expect(result.issue.id).toBe('todo-minimal')
      expect(result.issue.title).toBe('Minimal test')
      expect(result.issue.status).toBe('open')
      expect(result.issue.priority).toBe(2)
      expect(result.issue.type).toBe('task')
      expect(result.issue.assignee).toBeUndefined()
      expect(result.issue.labels).toBeUndefined()
      expect(result.issue.createdAt).toBeUndefined()
      expect(result.issue.updatedAt).toBeUndefined()
      expect(result.issue.closedAt).toBeUndefined()
      expect(result.issue.dependsOn).toBeUndefined()
      expect(result.issue.blocks).toBeUndefined()
      expect(result.issue.children).toBeUndefined()
      expect(result.issue.parent).toBeUndefined()
    })

    it('should extract body content without H1 heading duplication', () => {
      const content = `---
id: todo-body
title: "Body test"
state: open
priority: 2
type: task
---

# Body test

This is the actual description.

## Details

More content here.
`

      const result = parseTodoFile(content)

      // Description should include everything after frontmatter
      expect(result.issue.description).toContain('Body test')
      expect(result.issue.description).toContain('actual description')
      expect(result.issue.description).toContain('Details')
      expect(result.issue.description).toContain('More content here')
    })
  })
})
