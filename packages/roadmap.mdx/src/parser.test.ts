/**
 * Tests for roadmap.mdx parser.ts
 */

import { describe, it, expect } from 'vitest'
import { parseRoadmapFile, extractTasks, calculateProgress } from './parser.js'
import type { Milestone } from './types.js'

describe('parseRoadmapFile', () => {
  it('should parse frontmatter and content', () => {
    const content = `---
id: milestone-1
title: "v1.0 Release"
state: open
due_on: 2025-06-01
---

# v1.0 Release

Major release with new features.`

    const result = parseRoadmapFile(content)

    expect(result.frontmatter).toMatchObject({
      id: 'milestone-1',
      title: 'v1.0 Release',
      state: 'open',
      due_on: '2025-06-01',
    })

    expect(result.milestone.id).toBe('milestone-1')
    expect(result.milestone.title).toBe('v1.0 Release')
    expect(result.milestone.state).toBe('open')
    expect(result.milestone.dueOn).toBe('2025-06-01')
    expect(result.milestone.description).toContain('Major release with new features')
  })

  it('should extract title from H1 if not in frontmatter', () => {
    const content = `---
id: milestone-2
---
# Extracted Milestone

Description here.`

    const result = parseRoadmapFile(content)

    expect(result.milestone.title).toBe('Extracted Milestone')
    expect(result.milestone.description).toBe('Description here.')
  })

  it('should handle missing frontmatter', () => {
    const content = `# No Frontmatter

Just content.`

    const result = parseRoadmapFile(content)

    expect(result.frontmatter).toEqual({})
    expect(result.milestone.title).toBe('No Frontmatter')
    expect(result.milestone.description).toBe('Just content.')
  })

  it('should parse github_id and github_number', () => {
    const content = `---
id: milestone-3
github_id: 12345
github_number: 7
---

# GitHub Milestone`

    const result = parseRoadmapFile(content)

    expect(result.milestone.githubId).toBe(12345)
    expect(result.milestone.githubNumber).toBe(7)
  })

  it('should parse beads_id', () => {
    const content = `---
id: milestone-4
beads_id: epic-1
---

# Beads Epic`

    const result = parseRoadmapFile(content)

    expect(result.milestone.beadsId).toBe('epic-1')
  })

  it('should handle both due_on and dueOn', () => {
    const content1 = `---
id: m1
due_on: 2025-12-31
---

# Milestone`

    const result1 = parseRoadmapFile(content1)
    expect(result1.milestone.dueOn).toBe('2025-12-31')

    const content2 = `---
id: m2
dueOn: 2025-12-31
---

# Milestone`

    const result2 = parseRoadmapFile(content2)
    expect(result2.milestone.dueOn).toBe('2025-12-31')
  })

  it('should handle both milestone states', () => {
    const states: Milestone['state'][] = ['open', 'closed']

    for (const state of states) {
      const content = `---
id: milestone-state
state: ${state}
---

# State Test`

      const result = parseRoadmapFile(content)
      expect(result.milestone.state).toBe(state)
    }
  })

  it('should handle empty content', () => {
    const result = parseRoadmapFile('')

    expect(result.frontmatter).toEqual({})
    expect(result.content).toBe('')
    expect(result.milestone).toEqual({ description: '' })
  })

  it('should handle frontmatter with comments', () => {
    const content = `---
# This is a comment
id: milestone-5
# Another comment
title: "Test"
---

Body`

    const result = parseRoadmapFile(content)

    expect(result.milestone.id).toBe('milestone-5')
    expect(result.milestone.title).toBe('Test')
  })

  it('should handle quoted strings in frontmatter', () => {
    const content = `---
id: milestone-6
title: "Title with: colons"
---

Body`

    const result = parseRoadmapFile(content)

    expect(result.milestone.title).toBe('Title with: colons')
  })

  it('should handle single quotes in frontmatter', () => {
    const content = `---
id: milestone-7
title: 'Single quoted'
---

Body`

    const result = parseRoadmapFile(content)

    expect(result.milestone.title).toBe('Single quoted')
  })

  it('should handle boolean values', () => {
    const content = `---
id: milestone-8
archived: false
featured: true
---

Body`

    const result = parseRoadmapFile(content)

    expect(result.frontmatter.archived).toBe(false)
    expect(result.frontmatter.featured).toBe(true)
  })

  it('should handle null values', () => {
    const content = `---
id: milestone-9
due_on: null
description:
---

Body`

    const result = parseRoadmapFile(content)

    expect(result.frontmatter.due_on).toBeNull()
    expect(result.frontmatter.description).toBeNull()
  })

  it('should handle numeric values', () => {
    const content = `---
id: milestone-10
order: 1
progress: 75
score: 4.5
---

Body`

    const result = parseRoadmapFile(content)

    expect(result.frontmatter.order).toBe(1)
    expect(result.frontmatter.progress).toBe(75)
    expect(result.frontmatter.score).toBe(4.5)
  })

  it('should handle Windows line endings', () => {
    const content = "---\r\nid: m1\r\n---\r\n\r\nContent"

    const result = parseRoadmapFile(content)

    expect(result.milestone.description).toContain('Content')
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

  it('should handle nested lists', () => {
    const content = `
- [ ] Parent task
  - [ ] Child task
- [x] Another parent
`

    const tasks = extractTasks(content)

    // The regex only matches list items starting at line beginning (^)
    // so nested items with indentation won't match
    expect(tasks).toHaveLength(2)
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

    expect(progress.open).toBe(2)
    expect(progress.closed).toBe(2)
    expect(progress.percent).toBe(50)
  })

  it('should handle all completed', () => {
    const content = `
- [x] Task 1
- [x] Task 2
- [x] Task 3
`

    const progress = calculateProgress(content)

    expect(progress.open).toBe(0)
    expect(progress.closed).toBe(3)
    expect(progress.percent).toBe(100)
  })

  it('should handle no completed', () => {
    const content = `
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
`

    const progress = calculateProgress(content)

    expect(progress.open).toBe(3)
    expect(progress.closed).toBe(0)
    expect(progress.percent).toBe(0)
  })

  it('should handle no tasks', () => {
    const content = 'No tasks here'

    const progress = calculateProgress(content)

    expect(progress.open).toBe(0)
    expect(progress.closed).toBe(0)
    expect(progress.percent).toBe(0)
  })

  it('should round percentage correctly', () => {
    const content = `
- [x] Task 1
- [ ] Task 2
- [ ] Task 3
`

    const progress = calculateProgress(content)

    expect(progress.open).toBe(2)
    expect(progress.closed).toBe(1)
    expect(progress.percent).toBe(33) // 33.33... rounded
  })

  it('should calculate progress for milestone with many tasks', () => {
    const tasks = Array(10).fill(null).map((_, i) =>
      `- [${i < 7 ? 'x' : ' '}] Task ${i + 1}`
    ).join('\n')

    const progress = calculateProgress(tasks)

    expect(progress.closed).toBe(7)
    expect(progress.open).toBe(3)
    expect(progress.percent).toBe(70)
  })
})
