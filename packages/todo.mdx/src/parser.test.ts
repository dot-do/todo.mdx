/**
 * Tests for parser.ts
 */

import { describe, it, expect } from 'vitest'
import { parseTodoFile, extractTasks, calculateProgress } from './parser.js'
import type { Issue } from './types.js'

describe('parseTodoFile', () => {
  it('should parse frontmatter and content', () => {
    const content = `---
id: test-1
title: "Test Issue"
state: open
priority: 1
type: bug
labels: [bug, critical]
---

# Test Issue

This is the body content.`

    const result = parseTodoFile(content)

    expect(result.frontmatter).toMatchObject({
      id: 'test-1',
      title: 'Test Issue',
      state: 'open',
      priority: 1,
      type: 'bug',
      labels: ['bug', 'critical'],
    })

    expect(result.issue.id).toBe('test-1')
    expect(result.issue.title).toBe('Test Issue')
    expect(result.issue.state).toBe('open')
    expect(result.issue.priority).toBe(1)
    expect(result.issue.type).toBe('bug')
    expect(result.issue.labels).toEqual(['bug', 'critical'])
    expect(result.issue.body).toContain('This is the body content')
  })

  it('should extract title from H1 if not in frontmatter', () => {
    const content = `---
id: test-2
---
# Extracted Title

Body content here.`

    const result = parseTodoFile(content)

    expect(result.issue.title).toBe('Extracted Title')
    // Body should have H1 removed when title is extracted from H1
    expect(result.issue.body).toBe('Body content here.')
  })

  it('should handle missing frontmatter', () => {
    const content = `# No Frontmatter

Just content.`

    const result = parseTodoFile(content)

    expect(result.frontmatter).toEqual({})
    expect(result.issue.title).toBe('No Frontmatter')
    expect(result.issue.body).toBe('Just content.')
  })

  it('should parse github_id and github_number', () => {
    const content = `---
id: test-3
github_id: 12345
github_number: 42
---

# GitHub Issue`

    const result = parseTodoFile(content)

    expect(result.issue.githubId).toBe(12345)
    expect(result.issue.githubNumber).toBe(42)
  })

  it('should parse beads_id', () => {
    const content = `---
id: test-4
beads_id: todo-s33
---

# Beads Issue`

    const result = parseTodoFile(content)

    expect(result.issue.beadsId).toBe('todo-s33')
  })

  it('should parse assignees', () => {
    const content = `---
id: test-5
assignees: [alice, bob]
---

# Team Issue`

    const result = parseTodoFile(content)

    expect(result.issue.assignees).toEqual(['alice', 'bob'])
  })

  it('should parse milestone', () => {
    const content = `---
id: test-6
milestone: v1.0
---

# Milestone Issue`

    const result = parseTodoFile(content)

    expect(result.issue.milestone).toBe('v1.0')
  })

  it('should handle all issue states', () => {
    const states: Issue['state'][] = ['open', 'in_progress', 'closed', 'blocked']

    for (const state of states) {
      const content = `---
id: test-state
state: ${state}
---

# State Test`

      const result = parseTodoFile(content)
      expect(result.issue.state).toBe(state)
    }
  })

  it('should handle all issue types', () => {
    const types: Issue['type'][] = ['task', 'bug', 'feature', 'epic', 'chore']

    for (const type of types) {
      const content = `---
id: test-type
type: ${type}
---

# Type Test`

      const result = parseTodoFile(content)
      expect(result.issue.type).toBe(type)
    }
  })

  it('should handle empty content', () => {
    const result = parseTodoFile('')

    expect(result.frontmatter).toEqual({})
    expect(result.content).toBe('')
    expect(result.issue).toEqual({ body: '' })
  })

  it('should handle frontmatter with comments', () => {
    const content = `---
# This is a comment
id: test-7
# Another comment
title: "Test"
---

Body`

    const result = parseTodoFile(content)

    expect(result.issue.id).toBe('test-7')
    expect(result.issue.title).toBe('Test')
  })

  it('should handle quoted strings in frontmatter', () => {
    const content = `---
id: test-8
title: "Title with: colons"
---

Body`

    const result = parseTodoFile(content)

    expect(result.issue.title).toBe('Title with: colons')
  })

  it('should handle single quotes in frontmatter', () => {
    const content = `---
id: test-9
title: 'Single quoted'
---

Body`

    const result = parseTodoFile(content)

    expect(result.issue.title).toBe('Single quoted')
  })

  it('should handle boolean values', () => {
    const content = `---
id: test-10
archived: false
pinned: true
---

Body`

    const result = parseTodoFile(content)

    expect(result.frontmatter.archived).toBe(false)
    expect(result.frontmatter.pinned).toBe(true)
  })

  it('should handle null values', () => {
    const content = `---
id: test-11
milestone: null
assignee:
---

Body`

    const result = parseTodoFile(content)

    expect(result.frontmatter.milestone).toBeNull()
    expect(result.frontmatter.assignee).toBeNull()
  })

  it('should handle numeric values', () => {
    const content = `---
id: test-12
priority: 3
estimate: 5
progress: 75
score: 3.5
---

Body`

    const result = parseTodoFile(content)

    expect(result.frontmatter.priority).toBe(3)
    expect(result.frontmatter.estimate).toBe(5)
    expect(result.frontmatter.progress).toBe(75)
    expect(result.frontmatter.score).toBe(3.5)
  })
})

describe('extractTasks', () => {
  it('should extract checkbox items', () => {
    const content = `
- [ ] Task 1
- [x] Task 2
- [ ] Task 3
- [X] Task 4
`

    const tasks = extractTasks(content)

    expect(tasks).toHaveLength(4)
    expect(tasks[0]).toEqual({ checked: false, text: 'Task 1' })
    expect(tasks[1]).toEqual({ checked: true, text: 'Task 2' })
    expect(tasks[2]).toEqual({ checked: false, text: 'Task 3' })
    expect(tasks[3]).toEqual({ checked: true, text: 'Task 4' })
  })

  it('should handle asterisk list markers', () => {
    const content = `
* [ ] Task A
* [x] Task B
`

    const tasks = extractTasks(content)

    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toEqual({ checked: false, text: 'Task A' })
    expect(tasks[1]).toEqual({ checked: true, text: 'Task B' })
  })

  it('should handle tasks with complex text', () => {
    const content = `
- [ ] Task with **bold** and *italic*
- [x] Task with [link](https://example.com)
- [ ] Task with \`code\`
`

    const tasks = extractTasks(content)

    expect(tasks).toHaveLength(3)
    expect(tasks[0].text).toBe('Task with **bold** and *italic*')
    expect(tasks[1].text).toBe('Task with [link](https://example.com)')
    expect(tasks[2].text).toBe('Task with `code`')
  })

  it('should return empty array for no tasks', () => {
    const content = `
# No Tasks

Just regular content.
`

    const tasks = extractTasks(content)

    expect(tasks).toEqual([])
  })

  it('should ignore regular list items', () => {
    const content = `
- Regular item
- Another item
- [ ] Task item
`

    const tasks = extractTasks(content)

    expect(tasks).toHaveLength(1)
    expect(tasks[0].text).toBe('Task item')
  })
})

describe('calculateProgress', () => {
  it('should calculate progress from tasks', () => {
    const content = `
- [ ] Task 1
- [x] Task 2
- [x] Task 3
- [ ] Task 4
`

    const progress = calculateProgress(content)

    expect(progress.total).toBe(4)
    expect(progress.completed).toBe(2)
    expect(progress.percent).toBe(50)
  })

  it('should handle all completed', () => {
    const content = `
- [x] Task 1
- [x] Task 2
`

    const progress = calculateProgress(content)

    expect(progress.total).toBe(2)
    expect(progress.completed).toBe(2)
    expect(progress.percent).toBe(100)
  })

  it('should handle no completed', () => {
    const content = `
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
`

    const progress = calculateProgress(content)

    expect(progress.total).toBe(3)
    expect(progress.completed).toBe(0)
    expect(progress.percent).toBe(0)
  })

  it('should handle no tasks', () => {
    const content = 'No tasks here'

    const progress = calculateProgress(content)

    expect(progress.total).toBe(0)
    expect(progress.completed).toBe(0)
    expect(progress.percent).toBe(0)
  })

  it('should round percentage correctly', () => {
    const content = `
- [x] Task 1
- [ ] Task 2
- [ ] Task 3
`

    const progress = calculateProgress(content)

    expect(progress.total).toBe(3)
    expect(progress.completed).toBe(1)
    expect(progress.percent).toBe(33) // 33.33... rounded
  })
})
