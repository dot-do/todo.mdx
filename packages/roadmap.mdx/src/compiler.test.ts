/**
 * Tests for roadmap.mdx compiler.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compile, generateRoadmapFiles, render, renderRoadmap } from './compiler.js'
import type { Milestone, Epic, RoadmapConfig } from './types.js'
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
title: Test Roadmap
---

# {title}

Content here.
`

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      input: 'ROADMAP.mdx',
      output: 'ROADMAP.md',
      config: { beads: false },
    })

    expect(mockWriteFile).toHaveBeenCalledWith(
      'ROADMAP.md',
      expect.stringContaining('# Test Roadmap')
    )

    expect(result).toContain('# Test Roadmap')
    expect(result).toContain('Content here.')
  })

  it('should replace variable placeholders', async () => {
    const template = `---
title: My Roadmap
version: 2.0
---

# {title} v{version}
`

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false },
    })

    expect(result).toContain('# My Roadmap v2.0')
  })

  it('should use default template if input file missing', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('File not found'))

    const result = await compile({
      config: { beads: false },
    })

    expect(result).toContain('# Roadmap')
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

    // Since beads is false in frontmatter, loadBeadsEpics should not be called
    expect(mockExistsSync).not.toHaveBeenCalledWith(expect.stringContaining('.beads'))
  })

  it('should handle Windows line endings', async () => {
    const template = "---\r\ntitle: Test\r\n---\r\n\r\nContent"

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: { beads: false },
    })

    expect(result).toContain('Content')
  })

  it('should parse frontmatter correctly', async () => {
    const template = `---
title: Roadmap
beads: true
owner: myorg
repo: myrepo
---

# {title}
`

    mockReadFile.mockResolvedValueOnce(template)

    const result = await compile({
      config: {},
    })

    expect(result).toContain('# Roadmap')
  })
})

describe('generateRoadmapFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  it('should generate files for milestones', async () => {
    const milestones: Milestone[] = [
      {
        id: 'milestone-1',
        title: 'v1.0 Release',
        state: 'open',
        progress: { open: 5, closed: 3, percent: 38 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'milestone-2',
        title: 'v2.0 Planning',
        description: 'Next major release',
        state: 'open',
        dueOn: '2025-12-31',
        progress: { open: 10, closed: 0, percent: 0 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)

    const files = await generateRoadmapFiles({
      roadmapDir: '.roadmap',
      milestones,
    })

    expect(files).toHaveLength(2)
    expect(files[0]).toContain('v1-0-release.md')
    expect(files[1]).toContain('v2-0-planning.md')

    expect(mockWriteFile).toHaveBeenCalledTimes(2)

    // Verify first file content
    const firstCall = (mockWriteFile as any).mock.calls[0]
    expect(firstCall[1]).toContain('id: milestone-1')
    expect(firstCall[1]).toContain('title: "v1.0 Release"')
    expect(firstCall[1]).toContain('state: open')
  })

  it('should create directory if not exists', async () => {
    mockExistsSync.mockReturnValue(false)

    await generateRoadmapFiles({
      roadmapDir: '.roadmap',
      milestones: [],
    })

    expect(mkdir).toHaveBeenCalledWith('.roadmap', { recursive: true })
  })

  it('should include GitHub metadata', async () => {
    const milestones: Milestone[] = [
      {
        id: 'milestone-1',
        title: 'v1.0',
        githubId: 12345,
        githubNumber: 7,
        state: 'open',
        progress: { open: 0, closed: 0, percent: 0 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)

    await generateRoadmapFiles({ milestones })

    const content = (mockWriteFile as any).mock.calls[0][1]
    expect(content).toContain('github_number: 7')
  })

  it('should include beads metadata', async () => {
    const milestones: Milestone[] = [
      {
        id: 'milestone-1',
        title: 'v1.0',
        beadsId: 'epic-1',
        state: 'open',
        progress: { open: 0, closed: 0, percent: 0 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)

    await generateRoadmapFiles({ milestones })

    const content = (mockWriteFile as any).mock.calls[0][1]
    expect(content).toContain('beads_id: epic-1')
  })

  it('should include due date', async () => {
    const milestones: Milestone[] = [
      {
        id: 'milestone-1',
        title: 'v1.0',
        state: 'open',
        dueOn: '2025-12-31',
        progress: { open: 0, closed: 0, percent: 0 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)

    await generateRoadmapFiles({ milestones })

    const content = (mockWriteFile as any).mock.calls[0][1]
    expect(content).toContain('due_on: 2025-12-31')
  })

  it('should include description', async () => {
    const milestones: Milestone[] = [
      {
        id: 'milestone-1',
        title: 'v1.0',
        description: 'Major release with breaking changes',
        state: 'open',
        progress: { open: 0, closed: 0, percent: 0 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)

    await generateRoadmapFiles({ milestones })

    const content = (mockWriteFile as any).mock.calls[0][1]
    expect(content).toContain('Major release with breaking changes')
  })

  it('should clean up excessive newlines', async () => {
    const milestones: Milestone[] = [
      {
        id: 'milestone-1',
        title: 'v1.0',
        state: 'open',
        progress: { open: 0, closed: 0, percent: 0 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    mockExistsSync.mockReturnValue(true)

    await generateRoadmapFiles({ milestones })

    const content = (mockWriteFile as any).mock.calls[0][1]
    expect(content).not.toContain('\n\n\n')
  })
})

describe('render', () => {
  it('should render roadmap with milestones', () => {
    const milestones: Milestone[] = [
      {
        id: 'm1',
        title: 'v1.0',
        state: 'open',
        progress: { open: 2, closed: 3, percent: 60 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    const issues = [
      { id: 'i1', title: 'Issue 1', state: 'closed', milestoneId: 'm1' },
      { id: 'i2', title: 'Issue 2', state: 'open', milestoneId: 'm1' },
    ]

    const markdown = render({ milestones, issues, title: 'Project Roadmap' })

    expect(markdown).toContain('Project Roadmap')
    expect(markdown).toContain('v1.0')
  })

  it('should render backlog issues', () => {
    const issues = [
      { id: 'i1', title: 'Backlog Issue', state: 'open' },
    ]

    const markdown = render({ issues, milestones: [] })

    expect(markdown).toContain('Backlog')
  })

  it('should show completion percentage for open milestones', () => {
    const milestones: Milestone[] = [
      {
        id: 'm1',
        title: 'In Progress',
        state: 'open',
        progress: { open: 1, closed: 3, percent: 75 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    // Add issues to calculate percentage from
    const issues = [
      { id: 'i1', title: 'Issue 1', state: 'closed', milestoneId: 'm1' },
      { id: 'i2', title: 'Issue 2', state: 'closed', milestoneId: 'm1' },
      { id: 'i3', title: 'Issue 3', state: 'closed', milestoneId: 'm1' },
      { id: 'i4', title: 'Issue 4', state: 'open', milestoneId: 'm1' },
    ]

    const markdown = render({ milestones, issues })

    expect(markdown).toContain('75%')
  })

  it('should mark closed milestones with checkmark', () => {
    const milestones: Milestone[] = [
      {
        id: 'm1',
        title: 'Completed',
        state: 'closed',
        progress: { open: 0, closed: 5, percent: 100 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    const markdown = render({ milestones })

    expect(markdown).toContain('✓')
  })

  it('should show due date for milestones', () => {
    const milestones: Milestone[] = [
      {
        id: 'm1',
        title: 'v1.0',
        state: 'open',
        dueOn: '2025-12-31',
        progress: { open: 0, closed: 0, percent: 0 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    const markdown = render({ milestones })

    expect(markdown).toContain('2025-12-31')
  })

  it('should handle empty data', () => {
    const markdown = render({})

    expect(markdown).toContain('Roadmap')
    expect(markdown).toContain('0/0 complete')
  })
})

describe('renderRoadmap', () => {
  it('should render roadmap from beads epics if available', async () => {
    const markdown = await renderRoadmap()

    expect(markdown).toContain('# Roadmap')
    // May have epics if running in a beads repo
    // Or "_No epics found_" if not
    expect(markdown.length).toBeGreaterThan(0)
  })
})
