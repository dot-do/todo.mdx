/**
 * Tests for beads-ops adapter
 *
 * Verifies that beadsOps properly integrates with beads-workflows
 * to provide persistent issue operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createBeadsOps,
  type BeadsOps,
  type BeadsOpsOptions,
} from '../beads-ops'

// Mock beads-workflows IssuesApi
const mockIssuesApi = {
  get: vi.fn(),
  list: vi.fn(),
  ready: vi.fn(),
  blocked: vi.fn(),
  count: vi.fn(),
  reload: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  close: vi.fn(),
}

describe('beads-ops adapter', () => {
  let beadsOps: BeadsOps

  beforeEach(() => {
    vi.clearAllMocks()

    // Create adapter with mock IssuesApi
    beadsOps = createBeadsOps({
      issuesApi: mockIssuesApi,
    })
  })

  describe('getIssue', () => {
    it('should return null when issue does not exist', async () => {
      mockIssuesApi.get.mockResolvedValue(null)

      const result = await beadsOps.getIssue('nonexistent-id')

      expect(result).toBeNull()
      expect(mockIssuesApi.get).toHaveBeenCalledWith('nonexistent-id')
    })

    it('should return BeadsIssue when issue exists', async () => {
      const mockBeadsIssue = {
        id: 'test-123',
        title: 'Test Issue',
        description: 'A test issue',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'user',
        labels: ['test'],
        created: new Date('2024-01-01'),
        updated: new Date('2024-01-02'),
        dependsOn: ['dep-1'],
        blocks: ['blk-1'],
        parent: 'parent-1',
      }
      mockIssuesApi.get.mockResolvedValue(mockBeadsIssue)

      const result = await beadsOps.getIssue('test-123')

      expect(result).toEqual({
        id: 'test-123',
        title: 'Test Issue',
        description: 'A test issue',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'user',
        labels: ['test'],
        dependsOn: ['dep-1'],
        blocks: ['blk-1'],
        parent: 'parent-1',
        externalRef: '',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        closedAt: undefined,
      })
    })

    it('should include closedAt when issue is closed', async () => {
      const mockBeadsIssue = {
        id: 'test-123',
        title: 'Closed Issue',
        description: '',
        status: 'closed',
        type: 'bug',
        priority: 1,
        labels: [],
        created: new Date('2024-01-01'),
        updated: new Date('2024-01-02'),
        closed: new Date('2024-01-03'),
        dependsOn: [],
        blocks: [],
      }
      mockIssuesApi.get.mockResolvedValue(mockBeadsIssue)

      const result = await beadsOps.getIssue('test-123')

      expect(result?.closedAt).toBe('2024-01-03T00:00:00.000Z')
    })
  })

  describe('createIssue', () => {
    it('should create issue via IssuesApi and return created issue', async () => {
      const newIssue = {
        title: 'New Issue',
        description: 'Description',
        type: 'feature' as const,
        status: 'open' as const,
        priority: 2 as const,
        labels: ['new'],
        dependsOn: [],
        blocks: [],
        externalRef: 'github:123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }

      const createdBeadsIssue = {
        id: 'gen-id-123',
        title: 'New Issue',
        description: 'Description',
        status: 'open',
        type: 'feature',
        priority: 2,
        labels: ['new'],
        created: new Date('2024-01-01'),
        updated: new Date('2024-01-01'),
        dependsOn: [],
        blocks: [],
      }
      mockIssuesApi.create.mockResolvedValue(createdBeadsIssue)

      const result = await beadsOps.createIssue(newIssue)

      expect(mockIssuesApi.create).toHaveBeenCalledWith({
        title: 'New Issue',
        type: 'feature',
        priority: 2,
        description: 'Description',
        assignee: undefined,
        labels: ['new'],
      })
      expect(result.id).toBe('gen-id-123')
      expect(result.title).toBe('New Issue')
    })

    it('should return input issue with generated id if API returns null', async () => {
      const newIssue = {
        title: 'New Issue',
        description: '',
        type: 'task' as const,
        status: 'open' as const,
        priority: 2 as const,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: '',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }
      mockIssuesApi.create.mockResolvedValue(null)

      const result = await beadsOps.createIssue(newIssue)

      // Should return the input with an id
      expect(result.title).toBe('New Issue')
      expect(result.id).toBeDefined()
    })
  })

  describe('updateIssue', () => {
    it('should update issue via IssuesApi', async () => {
      const updates = {
        title: 'Updated Title',
        status: 'in_progress' as const,
      }

      const updatedBeadsIssue = {
        id: 'test-123',
        title: 'Updated Title',
        description: '',
        status: 'in_progress',
        type: 'task',
        priority: 2,
        labels: [],
        created: new Date('2024-01-01'),
        updated: new Date('2024-01-02'),
        dependsOn: [],
        blocks: [],
      }
      mockIssuesApi.update.mockResolvedValue(updatedBeadsIssue)

      const result = await beadsOps.updateIssue('test-123', updates)

      expect(mockIssuesApi.update).toHaveBeenCalledWith('test-123', {
        title: 'Updated Title',
        status: 'in_progress',
      })
      expect(result.id).toBe('test-123')
      expect(result.title).toBe('Updated Title')
    })

    it('should return partial update if API returns null', async () => {
      mockIssuesApi.update.mockResolvedValue(null)

      const result = await beadsOps.updateIssue('test-123', {
        title: 'Updated',
      })

      expect(result.id).toBe('test-123')
      expect(result.title).toBe('Updated')
    })
  })

  describe('listIssues', () => {
    it('should return empty array when no issues', async () => {
      mockIssuesApi.list.mockResolvedValue([])

      const result = await beadsOps.listIssues()

      expect(result).toEqual([])
      expect(mockIssuesApi.list).toHaveBeenCalled()
    })

    it('should return all issues converted to BeadsIssue format', async () => {
      const mockIssues = [
        {
          id: 'issue-1',
          title: 'Issue 1',
          description: 'Desc 1',
          status: 'open',
          type: 'task',
          priority: 2,
          labels: [],
          created: new Date('2024-01-01'),
          updated: new Date('2024-01-02'),
          dependsOn: [],
          blocks: [],
        },
        {
          id: 'issue-2',
          title: 'Issue 2',
          description: 'Desc 2',
          status: 'closed',
          type: 'bug',
          priority: 1,
          labels: ['urgent'],
          created: new Date('2024-01-01'),
          updated: new Date('2024-01-03'),
          closed: new Date('2024-01-03'),
          dependsOn: [],
          blocks: [],
        },
      ]
      mockIssuesApi.list.mockResolvedValue(mockIssues)

      const result = await beadsOps.listIssues()

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('issue-1')
      expect(result[1].id).toBe('issue-2')
      expect(result[1].closedAt).toBe('2024-01-03T00:00:00.000Z')
    })
  })
})
