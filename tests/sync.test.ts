/**
 * Tests for sync.ts - bi-directional sync between beads and .todo/*.md files
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { sync, detectChanges } from '../src/sync.js'
import type { TodoIssue, SyncResult, SyncConflict } from '../src/types.js'

// Mock beads-workflows functions
vi.mock('beads-workflows', () => ({
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  closeIssue: vi.fn(),
  readIssuesFromJsonl: vi.fn(),
  findBeadsDir: vi.fn(),
}))

// Mock file system operations
vi.mock('../src/beads.js', () => ({
  loadBeadsIssues: vi.fn(),
  hasBeadsDirectory: vi.fn(),
}))

vi.mock('../src/parser.js', () => ({
  loadTodoFiles: vi.fn(),
}))

vi.mock('../src/generator.js', () => ({
  writeTodoFiles: vi.fn(),
}))

import { createIssue, updateIssue, closeIssue } from 'beads-workflows'
import { loadBeadsIssues } from '../src/beads.js'
import { loadTodoFiles } from '../src/parser.js'
import { writeTodoFiles } from '../src/generator.js'

describe('detectChanges', () => {
  it('should detect new issues in files that need to be created in beads', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Existing task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Existing task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'task-2',
        title: 'New task from file',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    expect(result.toBeads).toHaveLength(1)
    expect(result.toBeads[0].id).toBe('task-2')
    expect(result.toFiles).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('should detect new issues in beads that need to be written to files', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Existing task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'task-2',
        title: 'New task from beads',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Existing task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    expect(result.toBeads).toHaveLength(0)
    expect(result.toFiles).toHaveLength(1)
    expect(result.toFiles[0].id).toBe('task-2')
    expect(result.conflicts).toHaveLength(0)
  })

  it('should detect conflicts when both sources have different updates for the same issue', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Task updated in beads',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Task updated in file',
        status: 'open',
        type: 'task',
        priority: 3,
        source: 'file',
        updatedAt: '2024-01-02T01:00:00.000Z',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].issueId).toBe('task-1')
  })

  it('should use updatedAt to determine which version is newer', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Older update',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Newer update',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    // File is newer, so should push to beads
    expect(result.toBeads).toHaveLength(1)
    expect(result.toBeads[0].title).toBe('Newer update')
    expect(result.toFiles).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('should handle issues without updatedAt timestamps', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Task without timestamp',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Task without timestamp',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    // Should treat as no change when timestamps are missing and content is same
    expect(result.toBeads).toHaveLength(0)
    expect(result.toFiles).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })
})

describe('sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue([])
    vi.mocked(writeTodoFiles).mockResolvedValue([])
    vi.mocked(createIssue).mockResolvedValue({ success: true })
    vi.mocked(updateIssue).mockResolvedValue({ success: true })
    vi.mocked(closeIssue).mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create new issues in beads from files', async () => {
    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'New task',
        description: 'Task description',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    const result = await sync({ todoDir: '.todo' })

    expect(createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New task',
        type: 'task',
        priority: 2,
        description: 'Task description',
      }),
      expect.any(Object)
    )
    expect(result.created).toContain('task-1')
  })

  it('should update existing issues in beads when files are newer', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Old title',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Updated title',
        status: 'in_progress',
        type: 'task',
        priority: 3,
        source: 'file',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    const result = await sync({ todoDir: '.todo' })

    expect(updateIssue).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        title: 'Updated title',
        status: 'in_progress',
        priority: 3,
      }),
      expect.any(Object)
    )
    expect(result.updated).toContain('task-1')
  })

  it('should write new beads issues to files', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'New beads task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue([])
    vi.mocked(writeTodoFiles).mockResolvedValue(['.todo/task-1-new-beads-task.md'])

    const result = await sync({ todoDir: '.todo' })

    expect(writeTodoFiles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'task-1', title: 'New beads task' }),
      ]),
      '.todo'
    )
    expect(result.filesWritten).toHaveLength(1)
  })

  it('should respect dryRun option and not make changes', async () => {
    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'New task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    const result = await sync({ todoDir: '.todo', dryRun: true })

    expect(createIssue).not.toHaveBeenCalled()
    expect(updateIssue).not.toHaveBeenCalled()
    expect(writeTodoFiles).not.toHaveBeenCalled()
    expect(result.created).toHaveLength(0)
  })

  it('should handle beads-to-files direction', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Beads task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue([])
    vi.mocked(writeTodoFiles).mockResolvedValue(['.todo/task-1-beads-task.md'])

    const result = await sync({ todoDir: '.todo', direction: 'beads-to-files' })

    expect(createIssue).not.toHaveBeenCalled()
    expect(writeTodoFiles).toHaveBeenCalled()
    expect(result.filesWritten).toHaveLength(1)
  })

  it('should handle files-to-beads direction', async () => {
    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'File task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    const result = await sync({ todoDir: '.todo', direction: 'files-to-beads' })

    expect(createIssue).toHaveBeenCalled()
    expect(writeTodoFiles).not.toHaveBeenCalled()
    expect(result.created).toContain('task-1')
  })

  it('should resolve conflicts with beads-wins strategy', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Beads version',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'File version',
        status: 'open',
        type: 'task',
        priority: 3,
        source: 'file',
        updatedAt: '2024-01-02T01:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)
    vi.mocked(writeTodoFiles).mockResolvedValue(['.todo/task-1-beads-version.md'])

    const result = await sync({ todoDir: '.todo', conflictStrategy: 'beads-wins' })

    // Should write beads version to files
    expect(writeTodoFiles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Beads version', status: 'in_progress' }),
      ]),
      '.todo'
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].resolution).toBe('beads-wins')
  })

  it('should resolve conflicts with file-wins strategy', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Beads version',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'File version',
        status: 'open',
        type: 'task',
        priority: 3,
        source: 'file',
        updatedAt: '2024-01-02T01:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    const result = await sync({ todoDir: '.todo', conflictStrategy: 'file-wins' })

    // Should update beads with file version
    expect(updateIssue).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        title: 'File version',
        status: 'open',
        priority: 3,
      }),
      expect.any(Object)
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].resolution).toBe('file-wins')
  })

  it('should resolve conflicts with newest-wins strategy', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Older version',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Newer version',
        status: 'in_progress',
        type: 'task',
        priority: 3,
        source: 'file',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    const result = await sync({ todoDir: '.todo', conflictStrategy: 'newest-wins' })

    // File is newer, so should update beads
    expect(updateIssue).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        title: 'Newer version',
        status: 'in_progress',
      }),
      expect.any(Object)
    )
    expect(result.updated).toContain('task-1')
  })

  it('should handle sync with no changes', async () => {
    const sameIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Same task',
        status: 'open',
        type: 'task',
        priority: 2,
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue([{ ...sameIssues[0], source: 'beads' }])
    vi.mocked(loadTodoFiles).mockResolvedValue([{ ...sameIssues[0], source: 'file' }])

    const result = await sync({ todoDir: '.todo' })

    expect(createIssue).not.toHaveBeenCalled()
    expect(updateIssue).not.toHaveBeenCalled()
    expect(writeTodoFiles).not.toHaveBeenCalled()
    expect(result.created).toHaveLength(0)
    expect(result.updated).toHaveLength(0)
    expect(result.filesWritten).toHaveLength(0)
  })

  it('should handle errors gracefully and continue syncing other issues', async () => {
    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Task that will fail',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'task-2',
        title: 'Task that will succeed',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    // First call fails, second succeeds
    vi.mocked(createIssue)
      .mockResolvedValueOnce({ success: false, error: 'Test error' })
      .mockResolvedValueOnce({ success: true })

    const result = await sync({ todoDir: '.todo' })

    expect(createIssue).toHaveBeenCalledTimes(2)
    expect(result.created).toContain('task-2')
    expect(result.created).not.toContain('task-1')
  })

  it('should handle labels and dependencies in sync', async () => {
    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Task with metadata',
        status: 'open',
        type: 'task',
        priority: 2,
        labels: ['frontend', 'urgent'],
        dependsOn: ['task-0'],
        blocks: ['task-2'],
        assignee: 'alice',
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    await sync({ todoDir: '.todo' })

    expect(createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ['frontend', 'urgent'],
        assignee: 'alice',
      }),
      expect.any(Object)
    )
  })

  it('should preserve source field when syncing', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Beads task',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue([])
    vi.mocked(writeTodoFiles).mockResolvedValue(['.todo/task-1-beads-task.md'])

    await sync({ todoDir: '.todo' })

    expect(writeTodoFiles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-1',
          source: 'beads',
        }),
      ]),
      '.todo'
    )
  })
})

describe('detectChanges with diff()', () => {
  it('should use diff().hasChanges for field-level change detection', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Original title',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Modified title',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    // File is newer, should push to beads
    expect(result.toBeads).toHaveLength(1)
    expect(result.toBeads[0].title).toBe('Modified title')
  })

  it('should correctly detect no changes when issues are identical', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Same title',
        status: 'open',
        type: 'task',
        priority: 2,
        description: 'Same description',
        labels: ['label1', 'label2'],
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Same title',
        status: 'open',
        type: 'task',
        priority: 2,
        description: 'Same description',
        labels: ['label1', 'label2'],
        source: 'file',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    expect(result.toBeads).toHaveLength(0)
    expect(result.toFiles).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('should report field-level conflicts using diff() result inspection', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Beads title',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        source: 'beads',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'File title',
        status: 'open',
        type: 'task',
        priority: 3,
        source: 'file',
        updatedAt: '2024-01-02T01:00:00.000Z',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    // Should detect conflict
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].issueId).toBe('task-1')
    // Conflict should be in one of the modified fields: title, status, or priority
    expect(['title', 'status', 'priority']).toContain(result.conflicts[0].field)
  })

  it('should detect multiple field differences', () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Original',
        status: 'open',
        type: 'task',
        priority: 1,
        description: 'Beads description',
        labels: ['backend'],
        source: 'beads',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Modified',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        description: 'File description',
        labels: ['frontend'],
        source: 'file',
        updatedAt: '2024-01-02T01:00:00.000Z',
      },
    ]

    const result = detectChanges(beadsIssues, fileIssues)

    // Should detect conflict (timestamps within same day)
    expect(result.conflicts).toHaveLength(1)
    // The implementation should be able to identify multiple field changes
  })
})

describe('sync with applyExtract()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue([])
    vi.mocked(writeTodoFiles).mockResolvedValue([])
    vi.mocked(createIssue).mockResolvedValue({ success: true })
    vi.mocked(updateIssue).mockResolvedValue({ success: true })
    vi.mocked(closeIssue).mockResolvedValue({ success: true })
  })

  it('should use applyExtract() when merging file changes into beads issue', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Original title',
        status: 'open',
        type: 'task',
        priority: 2,
        description: 'Original description',
        labels: ['backend'],
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Updated title',
        status: 'in_progress',
        type: 'task',
        priority: 3,
        description: 'Updated description',
        labels: ['frontend', 'urgent'],
        source: 'file',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    const result = await sync({ todoDir: '.todo' })

    // Should update beads with merged data from file
    expect(updateIssue).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        title: 'Updated title',
        status: 'in_progress',
        priority: 3,
        description: 'Updated description',
        labels: ['frontend', 'urgent'],
      }),
      expect.any(Object)
    )
    expect(result.updated).toContain('task-1')
  })

  it('should preserve fields not modified in file when using applyExtract()', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Original title',
        status: 'open',
        type: 'task',
        priority: 2,
        description: 'Original description',
        assignee: 'alice',
        labels: ['backend'],
        source: 'beads',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]

    const fileIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Updated title',
        status: 'open',
        type: 'task',
        priority: 2,
        // description omitted - should be preserved from beads
        assignee: 'alice',
        labels: ['backend'],
        source: 'file',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ]

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

    const result = await sync({ todoDir: '.todo' })

    // Should update only the title
    expect(updateIssue).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        title: 'Updated title',
        description: 'Original description', // Preserved
      }),
      expect.any(Object)
    )
  })
})

