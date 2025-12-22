/**
 * Tests for data loader
 * Verifies that loadBeadsMilestones uses the beads-workflows SDK
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create shared mock instances we can spy on
const mockListFn = vi.fn()
const mockChildrenFn = vi.fn()
const mockGetFn = vi.fn()
const mockProgressFn = vi.fn()
const mockReloadFn = vi.fn()
const mockFindBeadsDir = vi.fn()
const mockCreateEpicsApi = vi.fn()

// Mock beads-workflows SDK
vi.mock('beads-workflows', () => {
  return {
    findBeadsDir: mockFindBeadsDir,
    readIssuesFromJsonl: vi.fn(),
    createEpicsApi: mockCreateEpicsApi,
  }
})

import { loadBeadsMilestones } from './loader.js'

describe('loadBeadsMilestones', () => {
  const mockEpic = {
    id: 'epic-1',
    title: 'Test Epic',
    description: 'Test description',
    status: 'open',
    type: 'epic',
    priority: 1,
    created: new Date('2025-01-01T10:00:00Z'),
    updated: new Date('2025-01-02T10:00:00Z'),
    dependsOn: [],
    blocks: [],
    children: ['task-1', 'task-2', 'task-3', 'task-4'],
  }

  const mockChildren = [
    { id: 'task-1', title: 'Task 1', status: 'open', type: 'task', priority: 2, dependsOn: ['epic-1'], blocks: [], created: new Date(), updated: new Date() },
    { id: 'task-2', title: 'Task 2', status: 'in_progress', type: 'task', priority: 2, dependsOn: ['epic-1'], blocks: [], created: new Date(), updated: new Date() },
    { id: 'task-3', title: 'Task 3', status: 'closed', type: 'task', priority: 2, dependsOn: ['epic-1'], blocks: [], created: new Date(), updated: new Date() },
    { id: 'task-4', title: 'Task 4', status: 'closed', type: 'task', priority: 2, dependsOn: ['epic-1'], blocks: [], created: new Date(), updated: new Date() },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    mockFindBeadsDir.mockResolvedValue('/mock/.beads')
    mockListFn.mockResolvedValue([mockEpic])
    mockChildrenFn.mockResolvedValue(mockChildren)
    mockGetFn.mockResolvedValue(mockEpic)
    mockProgressFn.mockResolvedValue({ total: 4, closed: 2, percentage: 50 })
    mockReloadFn.mockResolvedValue(undefined)

    mockCreateEpicsApi.mockReturnValue({
      get: mockGetFn,
      list: mockListFn,
      children: mockChildrenFn,
      progress: mockProgressFn,
      reload: mockReloadFn,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use createEpicsApi from beads-workflows SDK', async () => {
    const milestones = await loadBeadsMilestones()

    // Verify the SDK's findBeadsDir was called
    expect(mockFindBeadsDir).toHaveBeenCalledWith(process.cwd())

    // Verify createEpicsApi was called with the beads directory
    expect(mockCreateEpicsApi).toHaveBeenCalledWith('/mock/.beads')
  })

  it('should use epics.list() to get all epics', async () => {
    const milestones = await loadBeadsMilestones()

    // The API's list() method should be called
    expect(mockListFn).toHaveBeenCalled()
  })

  it('should use epics.children() to get children for progress calculation', async () => {
    const milestones = await loadBeadsMilestones()

    // The API's children() method should be called for each epic
    expect(mockChildrenFn).toHaveBeenCalledWith('epic-1')
  })

  it('should return milestones with correct progress breakdown', async () => {
    const milestones = await loadBeadsMilestones()

    expect(milestones).toHaveLength(1)
    expect(milestones[0]).toMatchObject({
      id: 'epic-1',
      title: 'Test Epic',
      description: 'Test description',
      state: 'open',
      progress: {
        total: 4,
        open: 1,
        in_progress: 1,
        blocked: 0,
        closed: 2,
        percent: 50,
      },
    })
  })

  it('should return empty array when findBeadsDir returns null', async () => {
    mockFindBeadsDir.mockResolvedValueOnce(null)

    const milestones = await loadBeadsMilestones()

    expect(milestones).toEqual([])
    expect(mockCreateEpicsApi).not.toHaveBeenCalled()
  })

  it('should handle closed epic state correctly', async () => {
    const closedEpic = {
      id: 'epic-2',
      title: 'Closed Epic',
      description: 'Completed',
      status: 'closed',
      type: 'epic',
      priority: 1,
      created: new Date('2025-01-01T10:00:00Z'),
      updated: new Date('2025-01-03T10:00:00Z'),
      dependsOn: [],
      blocks: [],
      children: ['task-5'],
    }

    const closedChildren = [
      { id: 'task-5', title: 'Task 5', status: 'closed', type: 'task', priority: 2, dependsOn: ['epic-2'], blocks: [], created: new Date(), updated: new Date() },
    ]

    mockListFn.mockResolvedValueOnce([closedEpic])
    mockChildrenFn.mockResolvedValueOnce(closedChildren)

    const milestones = await loadBeadsMilestones()

    expect(milestones[0].state).toBe('closed')
    expect(milestones[0].progress?.percent).toBe(100)
  })

  it('should handle epic with no children', async () => {
    const emptyEpic = {
      id: 'epic-3',
      title: 'Empty Epic',
      description: undefined,
      status: 'open',
      type: 'epic',
      priority: 1,
      created: new Date('2025-01-01T10:00:00Z'),
      updated: new Date('2025-01-01T10:00:00Z'),
      dependsOn: [],
      blocks: [],
      children: [],
    }

    mockListFn.mockResolvedValueOnce([emptyEpic])
    mockChildrenFn.mockResolvedValueOnce([])

    const milestones = await loadBeadsMilestones()

    expect(milestones[0].progress).toEqual({
      total: 0,
      open: 0,
      in_progress: 0,
      blocked: 0,
      closed: 0,
      percent: 0,
    })
  })

  it('should handle errors gracefully', async () => {
    mockFindBeadsDir.mockRejectedValueOnce(new Error('File not found'))

    const milestones = await loadBeadsMilestones()

    expect(milestones).toEqual([])
  })
})
