/**
 * Tests for sync.ts edge cases - complex scenarios in bi-directional sync
 * Following TDD red-green-refactor: write failing tests, then fix implementation
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { sync, detectChanges } from '../src/sync.js'
import type { TodoIssue, SyncResult } from '../src/types.js'

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

/**
 * Helper function to detect circular dependencies in issues
 * Returns array of issue IDs that are part of circular dependency chains
 */
function detectCircularDependencies(issues: TodoIssue[]): string[] {
  const circularIssues: string[] = []
  const issueMap = new Map(issues.map((issue) => [issue.id, issue]))

  function hasCircularDep(
    issueId: string,
    visited: Set<string>,
    path: Set<string>
  ): boolean {
    if (path.has(issueId)) {
      return true // Circular dependency found
    }
    if (visited.has(issueId)) {
      return false // Already checked this path
    }

    visited.add(issueId)
    path.add(issueId)

    const issue = issueMap.get(issueId)
    if (issue?.dependsOn) {
      for (const depId of issue.dependsOn) {
        if (hasCircularDep(depId, visited, path)) {
          circularIssues.push(issueId)
          return true
        }
      }
    }

    path.delete(issueId)
    return false
  }

  const visited = new Set<string>()
  for (const issue of issues) {
    hasCircularDep(issue.id, visited, new Set())
  }

  return Array.from(new Set(circularIssues)) // Remove duplicates
}

/**
 * Helper function to detect orphan dependencies in issues
 * Returns array of [issueId, orphanDepId] tuples
 */
function detectOrphanDependencies(issues: TodoIssue[]): Array<[string, string]> {
  const issueIds = new Set(issues.map((issue) => issue.id))
  const orphans: Array<[string, string]> = []

  for (const issue of issues) {
    if (issue.dependsOn) {
      for (const depId of issue.dependsOn) {
        if (!issueIds.has(depId)) {
          orphans.push([issue.id, depId])
        }
      }
    }
    if (issue.blocks) {
      for (const blockedId of issue.blocks) {
        if (!issueIds.has(blockedId)) {
          orphans.push([issue.id, blockedId])
        }
      }
    }
    if (issue.parent && !issueIds.has(issue.parent)) {
      orphans.push([issue.id, issue.parent])
    }
    if (issue.children) {
      for (const childId of issue.children) {
        if (!issueIds.has(childId)) {
          orphans.push([issue.id, childId])
        }
      }
    }
  }

  return orphans
}

describe('Sync Edge Cases', () => {
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

  describe('Concurrent edit conflict detection', () => {
    it('should detect conflict when both beads and file changed different fields', () => {
      // RED: This test should fail initially because current implementation
      // may not properly detect conflicts when different fields are modified
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Original title',
          description: 'Description updated in beads',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          updatedAt: '2024-01-02T10:00:00.000Z',
        },
      ]

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Title updated in file',
          description: 'Original description',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-02T10:30:00.000Z',
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      // Should detect as conflict since both modified within same day (different fields)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].issueId).toBe('task-1')
    })

    it('should resolve concurrent edits with newest-wins based on timestamp', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Original title',
          description: 'Updated in beads at 10:00',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          updatedAt: '2024-01-02T10:00:00.000Z',
        },
      ]

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Updated in file at 15:00',
          description: 'Original description',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-03T15:00:00.000Z', // More than 1 day later
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      // File is clearly newer (next day), so should push to beads
      expect(result.toBeads).toHaveLength(1)
      expect(result.toBeads[0].title).toBe('Updated in file at 15:00')
      expect(result.conflicts).toHaveLength(0)
    })
  })

  describe('Deleted in beads vs file exists', () => {
    it('should detect when issue deleted from beads but markdown file still exists', () => {
      // RED: Current implementation may not handle deletion detection
      const beadsIssues: TodoIssue[] = []

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-deleted',
          title: 'This was deleted from beads',
          status: 'closed',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      // File exists but not in beads - should push to beads to recreate
      // (or we could delete file, but recreating is safer)
      expect(result.toBeads).toHaveLength(1)
      expect(result.toBeads[0].id).toBe('task-deleted')
    })

    it('should handle sync when file exists for deleted beads issue with closed status', async () => {
      const fileIssues: TodoIssue[] = [
        {
          id: 'task-deleted',
          title: 'Deleted from beads',
          status: 'closed',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue([])
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      const result = await sync({ todoDir: '.todo' })

      // Should attempt to recreate in beads
      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Deleted from beads',
        }),
        expect.any(Object)
      )
    })
  })

  describe('Deleted file vs beads exists', () => {
    it('should detect when markdown file deleted but issue exists in beads', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'File was deleted',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      const fileIssues: TodoIssue[] = []

      const result = detectChanges(beadsIssues, fileIssues)

      // Issue exists in beads but not in files - should write to files
      expect(result.toFiles).toHaveLength(1)
      expect(result.toFiles[0].id).toBe('task-1')
    })

    it('should recreate file when beads issue exists', async () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'File deleted but in beads',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue([])
      vi.mocked(writeTodoFiles).mockResolvedValue(['.todo/task-1-file-deleted-but-in-beads.md'])

      const result = await sync({ todoDir: '.todo' })

      expect(writeTodoFiles).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'task-1', title: 'File deleted but in beads' }),
        ]),
        '.todo'
      )
      expect(result.filesWritten).toHaveLength(1)
    })
  })

  describe('Renamed/moved files', () => {
    it('should handle file rename when ID in frontmatter matches existing issue', async () => {
      // RED: This tests that we rely on ID, not filename
      // The file might be renamed but as long as ID matches, it should sync correctly
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
          id: 'task-1', // Same ID even though file might be renamed
          title: 'Renamed file title',
          status: 'in_progress',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      const result = await sync({ todoDir: '.todo' })

      // Should update beads issue based on ID match
      expect(updateIssue).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          title: 'Renamed file title',
          status: 'in_progress',
        }),
        expect.any(Object)
      )
      expect(result.updated).toContain('task-1')
    })

    it('should match issues by ID regardless of title changes', () => {
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
          title: 'Completely different title',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      // Should detect as update to same issue
      expect(result.toBeads).toHaveLength(1)
      expect(result.toBeads[0].id).toBe('task-1')
      expect(result.toBeads[0].title).toBe('Completely different title')
    })
  })

  describe('Circular dependency detection', () => {
    it('should detect circular dependencies: A depends on B, B depends on A', () => {
      // Note: Sync doesn't prevent circular deps, but we can detect them with helper
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-a',
          title: 'Task A',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['task-b'],
          source: 'beads',
        },
        {
          id: 'task-b',
          title: 'Task B',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['task-a'],
          source: 'beads',
        },
      ]

      // Sync still processes issues (sync doesn't validate dependencies)
      const result = detectChanges(beadsIssues, [])
      expect(result.toFiles).toHaveLength(2)

      // But we can detect the circular dependency with our helper
      const circular = detectCircularDependencies(beadsIssues)
      expect(circular).toContain('task-a')
      expect(circular).toContain('task-b')
    })

    it('should detect indirect circular dependencies: A → B → C → A', () => {
      const issues: TodoIssue[] = [
        {
          id: 'task-a',
          title: 'Task A',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['task-b'],
          source: 'beads',
        },
        {
          id: 'task-b',
          title: 'Task B',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['task-c'],
          source: 'beads',
        },
        {
          id: 'task-c',
          title: 'Task C',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['task-a'],
          source: 'beads',
        },
      ]

      // Sync still processes (doesn't validate)
      const result = detectChanges(issues, [])
      expect(result.toFiles).toHaveLength(3)

      // But helper can detect the circular chain
      const circular = detectCircularDependencies(issues)
      expect(circular.length).toBeGreaterThan(0)
      expect(circular).toContain('task-a')
    })

    it('should NOT detect circular when dependencies are valid', () => {
      const issues: TodoIssue[] = [
        {
          id: 'task-a',
          title: 'Task A',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['task-b'],
          source: 'beads',
        },
        {
          id: 'task-b',
          title: 'Task B',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
      ]

      const circular = detectCircularDependencies(issues)
      expect(circular).toHaveLength(0)
    })
  })

  describe('Orphan dependency warnings', () => {
    it('should detect issue with dependency that references non-existent issue', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Task with orphan dependency',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['task-nonexistent'],
          source: 'beads',
        },
      ]

      const result = detectChanges(beadsIssues, [])

      // Sync still processes the issue
      expect(result.toFiles).toHaveLength(1)
      expect(result.toFiles[0].dependsOn).toContain('task-nonexistent')

      // Helper detects the orphan dependency
      const orphans = detectOrphanDependencies(beadsIssues)
      expect(orphans).toHaveLength(1)
      expect(orphans[0]).toEqual(['task-1', 'task-nonexistent'])
    })

    it('should detect blocks relationship to non-existent issue', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Task blocking non-existent',
          status: 'open',
          type: 'task',
          priority: 2,
          blocks: ['task-ghost'],
          source: 'beads',
        },
      ]

      const result = detectChanges(beadsIssues, [])

      // Sync still processes
      expect(result.toFiles).toHaveLength(1)
      expect(result.toFiles[0].blocks).toContain('task-ghost')

      // Helper detects orphan
      const orphans = detectOrphanDependencies(beadsIssues)
      expect(orphans).toHaveLength(1)
      expect(orphans[0]).toEqual(['task-1', 'task-ghost'])
    })

    it('should sync issues with orphan dependencies without failing', async () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Task with orphan',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['task-missing'],
          source: 'beads',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue([])
      vi.mocked(writeTodoFiles).mockResolvedValue(['.todo/task-1-task-with-orphan.md'])

      const result = await sync({ todoDir: '.todo' })

      // Should write file successfully despite orphan dependency
      expect(writeTodoFiles).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'task-1',
            dependsOn: ['task-missing'],
          }),
        ]),
        '.todo'
      )
      expect(result.filesWritten).toHaveLength(1)
    })
  })

  describe('Complex edge cases', () => {
    it('should handle empty timestamps gracefully', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'No timestamp',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          // No updatedAt
        },
      ]

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'No timestamp',
          status: 'in_progress',
          type: 'task',
          priority: 2,
          source: 'file',
          // No updatedAt
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      // Should detect conflict since both changed and no timestamps
      expect(result.conflicts).toHaveLength(1)
    })

    it('should handle issue with all optional fields missing', async () => {
      const minimalIssue: TodoIssue[] = [
        {
          id: 'task-minimal',
          title: 'Minimal task',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
          // No description, assignee, labels, dependencies, etc.
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue([])
      vi.mocked(loadTodoFiles).mockResolvedValue(minimalIssue)

      const result = await sync({ todoDir: '.todo' })

      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Minimal task',
          type: 'task',
          priority: 2,
        }),
        expect.any(Object)
      )
    })

    it('should handle very old and very new timestamps', () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Very old',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ]

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Very new',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ]

      const result = detectChanges(beadsIssues, fileIssues)

      // File is clearly newer (years later)
      expect(result.toBeads).toHaveLength(1)
      expect(result.toBeads[0].title).toBe('Very new')
    })

    it('should handle malformed or invalid issue data gracefully', async () => {
      // This tests error handling when beads operations fail
      const fileIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Valid task',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'file',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue([])
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)
      vi.mocked(createIssue).mockRejectedValueOnce(new Error('Invalid issue data'))

      // Should not throw error
      const result = await sync({ todoDir: '.todo' })

      // Should handle gracefully
      expect(result.created).toHaveLength(0)
    })

    it('should handle multiple simultaneous conflicts', async () => {
      const beadsIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Conflict 1 beads',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          updatedAt: '2024-01-02T10:00:00.000Z',
        },
        {
          id: 'task-2',
          title: 'Conflict 2 beads',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
          updatedAt: '2024-01-02T10:00:00.000Z',
        },
      ]

      const fileIssues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Conflict 1 file',
          status: 'in_progress',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-02T11:00:00.000Z',
        },
        {
          id: 'task-2',
          title: 'Conflict 2 file',
          status: 'in_progress',
          type: 'task',
          priority: 2,
          source: 'file',
          updatedAt: '2024-01-02T11:00:00.000Z',
        },
      ]

      vi.mocked(loadBeadsIssues).mockResolvedValue(beadsIssues)
      vi.mocked(loadTodoFiles).mockResolvedValue(fileIssues)

      const result = await sync({ todoDir: '.todo', conflictStrategy: 'beads-wins' })

      // Should handle both conflicts
      expect(result.conflicts.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Parent-child relationship edge cases', () => {
    it('should detect child referencing non-existent parent', () => {
      const issues: TodoIssue[] = [
        {
          id: 'task-child',
          title: 'Child task',
          status: 'open',
          type: 'task',
          priority: 2,
          parent: 'epic-missing',
          source: 'beads',
        },
      ]

      const result = detectChanges(issues, [])

      // Sync still processes
      expect(result.toFiles).toHaveLength(1)
      expect(result.toFiles[0].parent).toBe('epic-missing')

      // Helper detects orphan parent
      const orphans = detectOrphanDependencies(issues)
      expect(orphans).toHaveLength(1)
      expect(orphans[0]).toEqual(['task-child', 'epic-missing'])
    })

    it('should detect parent with children array containing non-existent IDs', () => {
      const issues: TodoIssue[] = [
        {
          id: 'epic-1',
          title: 'Epic',
          status: 'open',
          type: 'epic',
          priority: 2,
          children: ['task-1', 'task-missing', 'task-2'],
          source: 'beads',
        },
      ]

      const result = detectChanges(issues, [])

      // Sync still processes
      expect(result.toFiles).toHaveLength(1)
      expect(result.toFiles[0].children).toContain('task-missing')

      // Helper detects orphan children
      const orphans = detectOrphanDependencies(issues)
      expect(orphans.length).toBeGreaterThanOrEqual(1)
      const orphanIds = orphans.map((o) => o[1])
      expect(orphanIds).toContain('task-missing')
    })

    it('should handle valid parent-child relationships without orphans', () => {
      const issues: TodoIssue[] = [
        {
          id: 'epic-1',
          title: 'Epic',
          status: 'open',
          type: 'epic',
          priority: 2,
          children: ['task-1', 'task-2'],
          source: 'beads',
        },
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'open',
          type: 'task',
          priority: 2,
          parent: 'epic-1',
          source: 'beads',
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'open',
          type: 'task',
          priority: 2,
          parent: 'epic-1',
          source: 'beads',
        },
      ]

      const orphans = detectOrphanDependencies(issues)
      expect(orphans).toHaveLength(0)
    })
  })

  describe('Helper function tests', () => {
    it('detectCircularDependencies should work with complex chains', () => {
      const issues: TodoIssue[] = [
        {
          id: 'a',
          title: 'A',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['b', 'c'],
          source: 'beads',
        },
        {
          id: 'b',
          title: 'B',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['d'],
          source: 'beads',
        },
        {
          id: 'c',
          title: 'C',
          status: 'open',
          type: 'task',
          priority: 2,
          source: 'beads',
        },
        {
          id: 'd',
          title: 'D',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['a'], // Creates circle: a -> b -> d -> a
          source: 'beads',
        },
      ]

      const circular = detectCircularDependencies(issues)
      expect(circular.length).toBeGreaterThan(0)
    })

    it('detectOrphanDependencies should find all types of orphans', () => {
      const issues: TodoIssue[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'open',
          type: 'task',
          priority: 2,
          dependsOn: ['orphan-dep'],
          blocks: ['orphan-blocked'],
          parent: 'orphan-parent',
          children: ['orphan-child'],
          source: 'beads',
        },
      ]

      const orphans = detectOrphanDependencies(issues)
      expect(orphans.length).toBe(4)
      const orphanIds = orphans.map((o) => o[1])
      expect(orphanIds).toContain('orphan-dep')
      expect(orphanIds).toContain('orphan-blocked')
      expect(orphanIds).toContain('orphan-parent')
      expect(orphanIds).toContain('orphan-child')
    })
  })
})
