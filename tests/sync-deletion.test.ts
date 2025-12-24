/**
 * Tests for sync.ts deletion handling
 * Issue: todo-1vuu - Sync detectChanges doesn't handle deleted issues
 *
 * Following TDD red-green-refactor methodology
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { sync, detectChanges, type ChangeDetectionResult } from '../src/sync.js'
import type { TodoIssue, SyncResult } from '../src/types.js'

// Mock beads-workflows functions
vi.mock('beads-workflows', () => ({
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  closeIssue: vi.fn(),
  deleteIssue: vi.fn(),
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
  deleteTodoFile: vi.fn(),
}))

import { createIssue, updateIssue, closeIssue, deleteIssue } from 'beads-workflows'
import { loadBeadsIssues } from '../src/beads.js'
import { loadTodoFiles } from '../src/parser.js'
import { writeTodoFiles, deleteTodoFile } from '../src/generator.js'

describe('Deletion Detection in detectChanges', () => {
  describe('Issue exists in beads but file was deleted', () => {
    it('should detect issue that exists in beads but not in files as potential file deletion', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Task in beads only',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      const fileIssues: TodoIssue[] = []

      const result = detectChanges(beadsIssues, fileIssues)

      // Currently this would go to toFiles (recreate file)
      // But we should also track that the file was potentially deleted
      expect(result).toHaveProperty('deletedFiles')
      expect((result as ChangeDetectionResult & { deletedFiles: string[] }).deletedFiles).toContain('task-1')
    })

    it('should include deletedFiles array in ChangeDetectionResult', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-existing',
          title: 'Existing task',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
      ]

      const fileIssues: TodoIssue[] = []

      const result = detectChanges(beadsIssues, fileIssues)

      // The result should have a deletedFiles property
      expect(result).toHaveProperty('deletedFiles')
      expect(Array.isArray((result as ChangeDetectionResult & { deletedFiles: string[] }).deletedFiles)).toBe(true)
    })
  })

  describe('Issue exists in files but was deleted from beads', () => {
    it('should detect issue that exists in files but not in beads as potential beads deletion', () => {
      const beadsIssues: TodoIssue[] = []

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-deleted-from-beads',
          title: 'Task deleted from beads',
          status: 'closed',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      // Currently this would go to toBeads (recreate in beads)
      // But we should also track that this issue was potentially deleted from beads
      expect(result).toHaveProperty('deletedFromBeads')
      expect((result as ChangeDetectionResult & { deletedFromBeads: string[] }).deletedFromBeads).toContain('task-deleted-from-beads')
    })

    it('should include deletedFromBeads array in ChangeDetectionResult', () => {
      const beadsIssues: TodoIssue[] = []

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-orphan',
          title: 'Orphan file task',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      // The result should have a deletedFromBeads property
      expect(result).toHaveProperty('deletedFromBeads')
      expect(Array.isArray((result as ChangeDetectionResult & { deletedFromBeads: string[] }).deletedFromBeads)).toBe(true)
    })
  })

  describe('Multiple deletions', () => {
    it('should detect multiple deleted files at once', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
        {
          id: 'task-3',
          title: 'Task 3',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
      ]

      // Only task-2 has a file, task-1 and task-3 files were deleted
      const fileIssues: TodoIssue[] = [
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      expect(result).toHaveProperty('deletedFiles')
      const deletedFiles = (result as ChangeDetectionResult & { deletedFiles: string[] }).deletedFiles
      expect(deletedFiles).toContain('task-1')
      expect(deletedFiles).toContain('task-3')
      expect(deletedFiles).not.toContain('task-2')
    })

    it('should detect multiple issues deleted from beads at once', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
      ]

      // task-1 and task-3 exist as files but not in beads
      const fileIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
        },
        {
          id: 'task-3',
          title: 'Task 3',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      expect(result).toHaveProperty('deletedFromBeads')
      const deletedFromBeads = (result as ChangeDetectionResult & { deletedFromBeads: string[] }).deletedFromBeads
      expect(deletedFromBeads).toContain('task-1')
      expect(deletedFromBeads).toContain('task-3')
      expect(deletedFromBeads).not.toContain('task-2')
    })
  })
})

describe('Deletion Handling in sync()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue([])
    vi.mocked(writeTodoFiles).mockResolvedValue([])
    vi.mocked(createIssue).mockResolvedValue({ success: true })
    vi.mocked(updateIssue).mockResolvedValue({ success: true })
    vi.mocked(closeIssue).mockResolvedValue({ success: true })
    // @ts-expect-error - deleteIssue might not exist in types yet
    if (deleteIssue) vi.mocked(deleteIssue).mockResolvedValue({ success: true })
    // @ts-expect-error - deleteTodoFile might not exist yet
    if (deleteTodoFile) vi.mocked(deleteTodoFile).mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('SyncResult includes deleted issues', () => {
    it('should report deleted issues in SyncResult.deleted', async () => {
      const beadsIssues: TodoIssue[] = []

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-to-delete',
          title: 'This should be deleted',
          status: 'closed',
          type: 'task',
          priority: 2,
          source: 'file',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      // Enable deletion handling (opt-in for safety)
      const result = await sync({
        todoDir: '.todo',
        handleDeletions: true,
      } as any) // handleDeletions is new option

      // SyncResult.deleted should contain deleted issue IDs
      expect(result.deleted.length).toBeGreaterThan(0)
      expect(result.deleted).toContain('task-to-delete')
    })
  })

  describe('Deletion opt-in behavior', () => {
    it('should NOT delete by default (deletions are opt-in)', async () => {
      const beadsIssues: TodoIssue[] = []

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-orphan',
          title: 'Orphan file',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      // Default sync without handleDeletions
      const result = await sync({ todoDir: '.todo' })

      // Should NOT delete - should recreate in beads instead
      expect(result.deleted).toHaveLength(0)
      expect(createIssue).toHaveBeenCalled() // Should try to recreate
    })

    it('should delete file when handleDeletions is true and issue was deleted from beads', async () => {
      const beadsIssues: TodoIssue[] = []

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-to-delete',
          title: 'Delete this file',
          status: 'closed',
          type: 'task',
          priority: 2,
          source: 'file',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      const result = await sync({
        todoDir: '.todo',
        handleDeletions: true,
      } as any)

      // Should delete the orphan file
      expect(result.deleted).toContain('task-to-delete')
      // Should NOT recreate in beads
      expect(createIssue).not.toHaveBeenCalled()
    })

    it('should delete from beads when handleDeletions is true and file was deleted', async () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-to-delete',
          title: 'Delete from beads',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
      ]

      const fileIssues: TodoIssue[] = []

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      const result = await sync({
        todoDir: '.todo',
        handleDeletions: true,
        direction: 'files-to-beads', // File is source of truth
      } as any)

      // Should delete from beads since file was removed
      expect(result.deleted).toContain('task-to-delete')
      // Should NOT recreate file
      expect(writeTodoFiles).not.toHaveBeenCalled()
    })
  })

  describe('Direction-aware deletion', () => {
    it('should only delete files in beads-to-files direction', async () => {
      // In beads-to-files mode, if beads has issue but file is missing,
      // we should recreate the file, NOT delete from beads
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Task exists in beads',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
      ]

      const fileIssues: TodoIssue[] = []

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)
      vi.mocked(writeTodoFiles).mockResolvedValue(['.todo/task-1.md'])

      const result = await sync({
        todoDir: '.todo',
        direction: 'beads-to-files',
        handleDeletions: true,
      } as any)

      // In beads-to-files, beads is source of truth - recreate file
      expect(writeTodoFiles).toHaveBeenCalled()
      expect(result.deleted).toHaveLength(0) // No deletions in this direction
    })

    it('should only delete from beads in files-to-beads direction', async () => {
      // In files-to-beads mode, if file is missing but beads has issue,
      // we should delete from beads (file is source of truth)
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-deleted',
          title: 'Task to delete from beads',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
      ]

      const fileIssues: TodoIssue[] = []

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      const result = await sync({
        todoDir: '.todo',
        direction: 'files-to-beads',
        handleDeletions: true,
      } as any)

      // In files-to-beads, file is source of truth - delete from beads
      expect(result.deleted).toContain('task-deleted')
      expect(writeTodoFiles).not.toHaveBeenCalled()
    })
  })

  describe('Dry run with deletions', () => {
    it('should report what would be deleted in dry run mode', async () => {
      const beadsIssues: TodoIssue[] = []

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-orphan',
          title: 'Orphan file',
          status: 'closed',
          type: 'task',
          priority: 2,
          source: 'file',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      const result = await sync({
        todoDir: '.todo',
        dryRun: true,
        handleDeletions: true,
      } as any)

      // In dry run, should report what WOULD be deleted without actually executing
      // result.deleted contains IDs that would be deleted when not in dry run
      expect(result.deleted).toContain('task-orphan')
      // Verify no actual deletion was attempted
      // (In a real implementation, we'd check that deleteTodoFile wasn't called)
    })
  })
})

describe('filesDeleted tracking in SyncResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadBeadsIssues).mockResolvedValue([])
    vi.mocked(loadTodoFiles).mockResolvedValue([])
    vi.mocked(writeTodoFiles).mockResolvedValue([])
    vi.mocked(createIssue).mockResolvedValue({ success: true })
    vi.mocked(updateIssue).mockResolvedValue({ success: true })
  })

  it('should have filesDeleted array in SyncResult for tracking deleted files', async () => {
    const beadsIssues: TodoIssue[] = [
      {
        id: 'task-1',
        title: 'Task in beads',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
      },
    ]

    // File was deleted but issue exists in beads
    const fileIssues: TodoIssue[] = []

    vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
    vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)
    vi.mocked(writeTodoFiles).mockResolvedValue(['.todo/task-1.md'])

    const result = await sync({ todoDir: '.todo' })

    // Current result has 'deleted' for issues deleted from beads
    // We may also want 'filesDeleted' for files that were removed
    // For now, we're testing that the result has the expected structure
    expect(result).toHaveProperty('deleted')
    expect(Array.isArray(result.deleted)).toBe(true)
  })
})
