import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadTodoFiles, parseTodoFile } from '../src/parser.js'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('loadTodoFiles integration', () => {
  let tmpDir: string
  let todoDir: string

  beforeEach(async () => {
    // Create isolated temp directory for each test
    tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-integration-'))
    todoDir = join(tmpDir, '.todo')
    await fs.mkdir(todoDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up temp directory after each test
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should load files from .todo directory', async () => {
    // Create known fixture files
    const fixture1 = `---
id: todo-fixture-1
title: "First Test Issue"
state: open
priority: 2
type: task
---

# First Test Issue

This is the first test issue.
`
    const fixture2 = `---
id: todo-fixture-2
title: "Second Test Issue"
state: in_progress
priority: 1
type: feature
labels: [test, integration]
---

# Second Test Issue

This is the second test issue.
`
    // Write fixture files to temp directory
    await fs.writeFile(join(todoDir, '2025-01-01 First Test Issue.md'), fixture1)
    await fs.writeFile(join(todoDir, '2025-01-02 Second Test Issue.md'), fixture2)

    const issues = await loadTodoFiles(todoDir)

    // Should load exactly 2 issues
    expect(issues.length).toBe(2)

    // All should have a valid source (either 'beads' or 'file')
    for (const issue of issues) {
      expect(issue.source).toMatch(/^(beads|file)$/)
      expect(issue.id).toBeTruthy()
      expect(issue.title).toBeTruthy()
    }

    // Verify specific fixture data was loaded
    const ids = issues.map(i => i.id)
    expect(ids).toContain('todo-fixture-1')
    expect(ids).toContain('todo-fixture-2')
  })

  it('should handle non-existent directory gracefully', async () => {
    const issues = await loadTodoFiles('/non/existent/directory')
    expect(issues).toEqual([])
  })

  it('should load files from subdirectories (like closed/)', async () => {
    // Create a closed subdirectory
    const closedDir = join(todoDir, 'closed')
    await fs.mkdir(closedDir, { recursive: true })

    // Create fixture files in both root and subdirectory
    const openIssue = `---
id: todo-open-1
title: "Open Issue"
state: open
priority: 2
type: task
---

# Open Issue

An open issue in root .todo directory.
`
    const closedIssue = `---
id: todo-closed-1
title: "Closed Issue"
state: closed
priority: 2
type: feature
labels: [completed]
---

# Closed Issue

A closed issue in the closed/ subdirectory.
`
    await fs.writeFile(join(todoDir, '2025-01-01 Open Issue.md'), openIssue)
    await fs.writeFile(join(closedDir, '2025-01-01 Closed Issue.md'), closedIssue)

    const issues = await loadTodoFiles(todoDir)

    // Should load issues from both root and subdirectories
    expect(issues.length).toBe(2)

    const ids = issues.map(i => i.id)
    expect(ids).toContain('todo-open-1')
    expect(ids).toContain('todo-closed-1')

    // Verify the closed issue has correct status
    const closedIssueData = issues.find(i => i.id === 'todo-closed-1')
    expect(closedIssueData?.status).toBe('closed')
    expect(closedIssueData?.labels).toContain('completed')
  })

  it('should parse file with all TodoIssue fields correctly', async () => {
    // Create a fixture with all fields populated
    const fullIssue = `---
id: todo-full
title: "Full Feature Issue"
state: closed
priority: 3
type: feature
labels: [ide, layout, ui]
assignee: "test@example.com"
createdAt: "2025-01-01T00:00:00Z"
updatedAt: "2025-01-15T12:00:00Z"
closedAt: "2025-01-15T12:00:00Z"
dependsOn: [todo-dep-1, todo-dep-2]
blocks: [todo-block-1]
children: [todo-child-1]
parent: "todo-epic"
source: "beads"
---

# Full Feature Issue

This is a comprehensive test issue with all fields populated.

## Details

Additional details about the feature.
`
    await fs.writeFile(join(todoDir, '2025-01-01 Full Feature Issue.md'), fullIssue)

    const issues = await loadTodoFiles(todoDir)
    expect(issues.length).toBe(1)

    const issue = issues[0]
    expect(issue.id).toBe('todo-full')
    expect(issue.title).toBe('Full Feature Issue')
    expect(issue.status).toBe('closed')
    expect(issue.priority).toBe(3)
    expect(issue.type).toBe('feature')
    expect(issue.labels).toEqual(['ide', 'layout', 'ui'])
    expect(issue.assignee).toBe('test@example.com')
    expect(issue.createdAt).toBe('2025-01-01T00:00:00Z')
    expect(issue.updatedAt).toBe('2025-01-15T12:00:00Z')
    expect(issue.closedAt).toBe('2025-01-15T12:00:00Z')
    expect(issue.dependsOn).toEqual(['todo-dep-1', 'todo-dep-2'])
    expect(issue.blocks).toEqual(['todo-block-1'])
    expect(issue.children).toEqual(['todo-child-1'])
    expect(issue.parent).toBe('todo-epic')
  })
})
