/**
 * Tests for compiler.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compile, generateTodoFiles, loadBeadsIssues, loadGitHubIssues } from './compiler.js'
import type { Issue, TodoConfig } from './types.js'
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
}))

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

const mockReadFile = readFile as any
const mockWriteFile = writeFile as any
const mockExistsSync = existsSync as any

describe('compile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  it('should compile simple template', async () => {
    const template = `---
title: Test TODO
---

# {title}

<Stats />
`

    mockReadFile.mockResolvedValueOnce(template)
    mockExistsSync.mockReturnValue(false) // No .todo directory

    const result = await compile({
      input: 'TODO.mdx',
      output: 'TODO.md',
      config: { beads: false, api: false },
    })

    expect(mockWriteFile).toHaveBeenCalledWith(
      'TODO.md',
      expect.stringContaining('# Test TODO')
    )

    expect(result.mainOutput).toContain('# Test TODO')
    expect(result.mainOutput).toContain('**0 open**')
  })

  it('should replace variable placeholders', async () => {
    const template = `---
title: My Project
version: 1.0.0
---

# {title} v{version}
`

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('# My Project v1.0.0')
  })

  it('should render <Stats /> component', async () => {
    const template = '<Stats />'

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('**0 open**')
    expect(result.mainOutput).toContain('0 closed')
    expect(result.mainOutput).toContain('0 total')
  })

  it('should render <Issues.Open /> component', async () => {
    const template = '<Issues.Open />'

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('_No issues_')
  })

  it('should render <Issues.Closed /> component', async () => {
    const template = '<Issues.Closed />'

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('_No issues_')
  })

  it('should render <Issues.InProgress /> component', async () => {
    const template = '<Issues.InProgress />'

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('_No issues_')
  })

  it('should render <Issues.Ready /> component with limit', async () => {
    const template = '<Issues.Ready limit={5} />'

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('_No issues_')
  })

  it('should render <Issues.Blocked /> component', async () => {
    const template = '<Issues.Blocked />'

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('_No issues_')
  })

  it('should use default template if input file missing', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('File not found'))

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('# TODO')
    expect(result.mainOutput).toContain('## In Progress')
    expect(result.mainOutput).toContain('## Open Issues')
  })

  it('should merge config from frontmatter', async () => {
    const template = `---
owner: test-owner
repo: test-repo
beads: false
---

Test content`

    mockReadFile.mockResolvedValueOnce(template)

    await compile({
      config: { beads: true }, // Should be overridden by frontmatter
    })

    // Since beads is false in frontmatter, loadBeadsIssues should not be called
    expect(mockExistsSync).not.toHaveBeenCalledWith(expect.stringContaining('.beads'))
  })

  it('should handle multiple output targets', async () => {
    const template = `---
outputs: [TODO.md, docs/TODO.md]
---

# TODO
`

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(mockWriteFile).toHaveBeenCalledWith('TODO.md', expect.any(String))
    expect(mockWriteFile).toHaveBeenCalledWith('docs/TODO.md', expect.any(String))
    expect(result.generatedFiles).toContain('TODO.md')
    expect(result.generatedFiles).toContain('docs/TODO.md')
  })

  it('should parse frontmatter with arrays', async () => {
    const template = `---
title: Test
labels:
- bug
- critical
assignees: [alice, bob]
---

Content`

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toBeDefined()
  })

  it('should handle Windows line endings', async () => {
    const template = "---\r\ntitle: Test\r\n---\r\n\r\nContent"

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false, api: false },
    })

    expect(result.mainOutput).toContain('Content')
  })
})

describe('generateTodoFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  it('should generate files for issues', async () => {
    const issues: Issue[] = [
      {
        id: 'test-1',
        title: 'Test Issue',
        state: 'open',
        priority: 1,
        type: 'bug',
        labels: ['bug'],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'test-2',
        title: 'Another Issue',
        state: 'closed',
        type: 'feature',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    // Mock template file doesn't exist - will use DEFAULT_ISSUE_TEMPLATE
    mockExistsSync.mockReturnValue(false)

    const files = await generateTodoFiles({
      todoDir: '.todo',
      issues,
    })

    expect(files).toHaveLength(2)
    expect(files[0]).toContain('test-1')
    expect(files[1]).toContain('test-2')

    expect(mockWriteFile).toHaveBeenCalledTimes(2)

    // Verify first file content
    const firstCall = (mockWriteFile as any).mock.calls[0]
    expect(firstCall[1]).toContain('id: test-1')
    expect(firstCall[1]).toContain('title: "Test Issue"')
    expect(firstCall[1]).toContain('state: open')
    expect(firstCall[1]).toContain('priority: 1')
  })

  it('should create directory if not exists', async () => {
    mockExistsSync.mockReturnValue(false)

    await generateTodoFiles({
      todoDir: '.todo',
      issues: [],
    })

    expect(mkdir).toHaveBeenCalledWith('.todo', { recursive: true })
  })

  it('should use custom pattern', async () => {
    const issues: Issue[] = [
      {
        id: 'test-1',
        title: 'Test',
        type: 'bug',
        state: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(false)

    const files = await generateTodoFiles({
      pattern: '[type]-[id].md',
      issues,
    })

    expect(files[0]).toContain('bug-test-1.md')
  })

  it('should include issue body', async () => {
    const issues: Issue[] = [
      {
        id: 'test-1',
        title: 'Test',
        body: 'This is the issue description.',
        state: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(false)

    await generateTodoFiles({ issues })

    const content = (mockWriteFile as any).mock.calls[0][1]
    expect(content).toContain('This is the issue description.')
  })

  it('should handle issues without optional fields', async () => {
    const issues: Issue[] = [
      {
        id: 'test-1',
        title: 'Minimal Issue',
        state: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(false)

    await generateTodoFiles({ issues })

    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('should render <Subtasks /> component for epics', async () => {
    const issues: Issue[] = [
      {
        id: 'epic-1',
        title: 'Epic',
        type: 'epic',
        state: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'task-1',
        title: 'Subtask',
        epicId: 'epic-1',
        state: 'closed',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(`---
id: {id}
title: "{title}"
---

<Subtasks />`)

    await generateTodoFiles({
      issues,
      templateDir: '.mdx',
    })

    // Epic file should include subtasks
    const epicContent = (mockWriteFile as any).mock.calls[0][1]
    expect(epicContent).toContain('### Subtasks')
    expect(epicContent).toContain('task-1')
  })

  it('should render <RelatedIssues /> component', async () => {
    const issues: Issue[] = [
      {
        id: 'issue-1',
        title: 'Blocked Issue',
        state: 'open',
        blockedBy: ['issue-2'],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'issue-2',
        title: 'Blocker',
        state: 'closed',
        blocks: ['issue-1'],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(`---
id: {id}
---

<RelatedIssues />`)

    await generateTodoFiles({
      issues,
      templateDir: '.mdx',
    })

    const issue1Content = (mockWriteFile as any).mock.calls[0][1]
    expect(issue1Content).toContain('### Related Issues')
    expect(issue1Content).toContain('Blocked by')
  })

  it('should render <Progress /> component for epics', async () => {
    const issues: Issue[] = [
      {
        id: 'epic-1',
        title: 'Epic',
        type: 'epic',
        state: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'task-1',
        title: 'Task',
        epicId: 'epic-1',
        state: 'closed',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'task-2',
        title: 'Task 2',
        epicId: 'epic-1',
        state: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(`---
id: {id}
---

<Progress />`)

    await generateTodoFiles({
      issues,
      templateDir: '.mdx',
    })

    const epicContent = (mockWriteFile as any).mock.calls[0][1]
    expect(epicContent).toContain('**Progress:**')
    expect(epicContent).toContain('50%')
  })

  it('should render <Timeline /> component', async () => {
    const issues: Issue[] = [
      {
        id: 'issue-1',
        title: 'Issue',
        state: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)
    mockReadFile.mockResolvedValue(`---
id: {id}
---

<Timeline />`)

    await generateTodoFiles({
      issues,
      templateDir: '.mdx',
    })

    const content = (mockWriteFile as any).mock.calls[0][1]
    expect(content).toContain('### Timeline')
    expect(content).toContain('**Created:**')
    expect(content).toContain('**Updated:**')
  })
})

describe('loadBeadsIssues', () => {
  it('should load beads issues if available', async () => {
    const issues = await loadBeadsIssues()
    // May return issues if beads is installed and we're in a beads repo
    // Or empty array if not available
    expect(Array.isArray(issues)).toBe(true)

    // If issues are loaded, verify they have expected structure
    if (issues.length > 0) {
      const issue = issues[0]
      expect(issue).toHaveProperty('id')
      expect(issue).toHaveProperty('title')
      expect(issue).toHaveProperty('state')
    }
  })
})

describe('loadGitHubIssues', () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN
  })

  it('should return empty array if no token', async () => {
    const config: TodoConfig = {
      owner: 'test-owner',
      repo: 'test-repo',
    }

    const issues = await loadGitHubIssues(config)
    expect(issues).toEqual([])
  })

  it('should return empty array if no owner/repo', async () => {
    process.env.GITHUB_TOKEN = 'test-token'

    const config: TodoConfig = {}

    const issues = await loadGitHubIssues(config)
    expect(issues).toEqual([])
  })
})
