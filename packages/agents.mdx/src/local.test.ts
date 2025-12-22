/**
 * Tests for local.ts beads SDK integration
 *
 * These tests verify that localTransport uses the beads-workflows SDK
 * instead of shelling out to the bd CLI.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

// Mock issue data
const mockIssues = [
  {
    id: 'TEST-1',
    title: 'Test Issue 1',
    description: 'Description 1',
    status: 'open' as const,
    type: 'task' as const,
    priority: 2 as const,
    assignee: 'user1',
    labels: ['test'],
    created: new Date('2025-01-01'),
    updated: new Date('2025-01-02'),
    dependsOn: [],
    blocks: [],
  },
  {
    id: 'TEST-2',
    title: 'Test Issue 2',
    description: 'Description 2',
    status: 'in_progress' as const,
    type: 'feature' as const,
    priority: 1 as const,
    assignee: 'user2',
    labels: [],
    created: new Date('2025-01-01'),
    updated: new Date('2025-01-03'),
    dependsOn: ['TEST-1'],
    blocks: [],
  },
  {
    id: 'TEST-EPIC',
    title: 'Epic Issue',
    description: 'Epic description',
    status: 'open' as const,
    type: 'epic' as const,
    priority: 1 as const,
    labels: [],
    created: new Date('2025-01-01'),
    updated: new Date('2025-01-01'),
    dependsOn: [],
    blocks: [],
    children: ['TEST-1', 'TEST-2'],
  },
]

// Mock functions - will be set after vi.mock
let mockIssuesApi: {
  list: Mock
  ready: Mock
  blocked: Mock
  get: Mock
  create: Mock
  update: Mock
  close: Mock
  reload: Mock
  count: Mock
}

let mockEpicsApi: {
  list: Mock
  get: Mock
  progress: Mock
  children: Mock
  reload: Mock
}

let mockFindBeadsDir: Mock
let mockCreateIssuesApi: Mock
let mockCreateEpicsApi: Mock

// Mock beads-workflows SDK
vi.mock('beads-workflows', () => {
  const issuesApi = {
    list: vi.fn(),
    ready: vi.fn(),
    blocked: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    close: vi.fn(),
    reload: vi.fn(),
    count: vi.fn(),
  }

  const epicsApi = {
    list: vi.fn(),
    get: vi.fn(),
    progress: vi.fn(),
    children: vi.fn(),
    reload: vi.fn(),
  }

  return {
    createIssuesApi: vi.fn().mockReturnValue(issuesApi),
    createEpicsApi: vi.fn().mockReturnValue(epicsApi),
    findBeadsDir: vi.fn().mockResolvedValue('/mock/project/.beads'),
    // Export for test access
    _issuesApi: issuesApi,
    _epicsApi: epicsApi,
  }
})

// Import after mocking
import { localTransport, resetBeadsCache, type LocalTransportConfig } from './local'
import * as beadsWorkflows from 'beads-workflows'

// Get the mock instances after import
const getMocks = () => {
  mockCreateIssuesApi = beadsWorkflows.createIssuesApi as unknown as Mock
  mockCreateEpicsApi = beadsWorkflows.createEpicsApi as unknown as Mock
  mockFindBeadsDir = beadsWorkflows.findBeadsDir as unknown as Mock
  // @ts-expect-error - accessing internal mock property
  mockIssuesApi = beadsWorkflows._issuesApi
  // @ts-expect-error - accessing internal mock property
  mockEpicsApi = beadsWorkflows._epicsApi
}

// Initialize mocks immediately
getMocks()

describe('localTransport beads SDK integration', () => {
  let transport: ReturnType<typeof localTransport>
  const mockConfig: LocalTransportConfig = {
    repo: {
      owner: 'test-owner',
      name: 'test-repo',
      defaultBranch: 'main',
      url: 'https://github.com/test-owner/test-repo',
    },
    cwd: '/mock/project',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    resetBeadsCache()

    // Set up mock return values
    mockIssuesApi.list.mockResolvedValue(mockIssues.filter(i => i.type !== 'epic'))
    mockIssuesApi.ready.mockResolvedValue([mockIssues[0]])
    mockIssuesApi.blocked.mockResolvedValue([mockIssues[1]])
    mockIssuesApi.get.mockImplementation(async (id: string) => mockIssues.find(i => i.id === id) || null)
    mockIssuesApi.create.mockImplementation(async (opts: { title: string }) => ({
      id: 'TEST-NEW',
      title: opts.title,
      description: '',
      status: 'open' as const,
      type: 'task' as const,
      priority: 2 as const,
      labels: [],
      created: new Date(),
      updated: new Date(),
      dependsOn: [],
      blocks: [],
    }))
    mockIssuesApi.update.mockImplementation(async (id: string, fields: Record<string, unknown>) => ({
      ...mockIssues.find(i => i.id === id),
      ...fields,
    }))
    mockIssuesApi.close.mockResolvedValue(true)
    mockIssuesApi.reload.mockResolvedValue(undefined)
    mockIssuesApi.count.mockResolvedValue(2)

    mockEpicsApi.list.mockResolvedValue([mockIssues[2]])
    mockEpicsApi.get.mockImplementation(async (id: string) => mockIssues.find(i => i.id === id && i.type === 'epic') || null)
    mockEpicsApi.progress.mockResolvedValue({ total: 2, closed: 1, percentage: 50 })
    mockEpicsApi.children.mockResolvedValue([mockIssues[0], mockIssues[1]])
    mockEpicsApi.reload.mockResolvedValue(undefined)

    mockFindBeadsDir.mockResolvedValue('/mock/project/.beads')

    transport = localTransport(mockConfig)
  })

  afterEach(() => {
    resetBeadsCache()
  })

  describe('issues.list', () => {
    it('should use SDK instead of CLI', async () => {
      const result = await transport.call('issues.list', [{}])

      expect(mockFindBeadsDir).toHaveBeenCalled()
      expect(mockCreateIssuesApi).toHaveBeenCalled()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should pass filter to SDK list method', async () => {
      const filter = { status: 'open', priority: 1 }
      await transport.call('issues.list', [filter])

      expect(mockIssuesApi.list).toHaveBeenCalledWith(filter)
    })
  })

  describe('issues.ready', () => {
    it('should use SDK ready method', async () => {
      const result = await transport.call('issues.ready', [])

      expect(Array.isArray(result)).toBe(true)
      expect(mockIssuesApi.ready).toHaveBeenCalled()
    })
  })

  describe('issues.blocked', () => {
    it('should use SDK blocked method', async () => {
      const result = await transport.call('issues.blocked', [])

      expect(Array.isArray(result)).toBe(true)
      expect(mockIssuesApi.blocked).toHaveBeenCalled()
    })
  })

  describe('issues.create', () => {
    it('should use SDK create method', async () => {
      const opts = { title: 'New Issue', description: 'Test description', type: 'task', priority: 2 }
      const result = await transport.call('issues.create', [opts])

      expect(mockIssuesApi.create).toHaveBeenCalled()
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('title', 'New Issue')
    })
  })

  describe('issues.update', () => {
    it('should use SDK update method', async () => {
      const id = 'TEST-1'
      const fields = { status: 'in_progress', priority: 1 }
      const result = await transport.call('issues.update', [id, fields])

      expect(mockIssuesApi.update).toHaveBeenCalledWith(id, expect.objectContaining(fields))
      expect(result).toHaveProperty('id', 'TEST-1')
    })
  })

  describe('issues.close', () => {
    it('should use SDK close method', async () => {
      const id = 'TEST-1'
      const reason = 'Completed'
      await transport.call('issues.close', [id, reason])

      expect(mockIssuesApi.close).toHaveBeenCalledWith(id, reason)
    })
  })

  describe('issues.show', () => {
    it('should use SDK get method', async () => {
      const id = 'TEST-1'
      const result = await transport.call('issues.show', [id])

      expect(mockIssuesApi.get).toHaveBeenCalledWith(id)
      expect(result).toHaveProperty('id', 'TEST-1')
    })

    it('should throw when issue not found', async () => {
      mockIssuesApi.get.mockResolvedValueOnce(null)

      await expect(transport.call('issues.show', ['NON-EXISTENT']))
        .rejects.toThrow()
    })
  })

  describe('epics.list', () => {
    it('should use SDK list method', async () => {
      const result = await transport.call('epics.list', [])

      expect(mockEpicsApi.list).toHaveBeenCalled()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('epics.progress', () => {
    it('should use SDK progress method', async () => {
      const id = 'TEST-EPIC'
      const result = await transport.call('epics.progress', [id]) as { total: number; completed: number; percentage: number }

      expect(mockEpicsApi.progress).toHaveBeenCalledWith(id)
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('percentage')
    })
  })

  describe('epics.create', () => {
    it('should use issues SDK create method with type epic', async () => {
      const opts = { title: 'New Epic', description: 'Epic description' }
      await transport.call('epics.create', [opts])

      expect(mockIssuesApi.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New Epic',
        type: 'epic',
      }))
    })
  })

  describe('API caching', () => {
    it('should cache API instances to avoid recreating', async () => {
      // Call multiple methods
      await transport.call('issues.list', [{}])
      await transport.call('issues.ready', [])
      await transport.call('issues.blocked', [])

      // createIssuesApi should only be called once (cached)
      expect(mockCreateIssuesApi).toHaveBeenCalledTimes(1)
    })
  })

  describe('beads directory detection', () => {
    it('should use findBeadsDir to locate .beads directory', async () => {
      await transport.call('issues.list', [{}])

      expect(mockFindBeadsDir).toHaveBeenCalled()
    })

    it('should throw when .beads directory not found', async () => {
      mockFindBeadsDir.mockResolvedValueOnce(null)

      // Reset cache by creating new transport
      resetBeadsCache()
      const newTransport = localTransport(mockConfig)

      await expect(newTransport.call('issues.list', [{}]))
        .rejects.toThrow('beads')
    })
  })
})

describe('localTransport issue type conversion', () => {
  let transport: ReturnType<typeof localTransport>

  beforeEach(() => {
    vi.clearAllMocks()
    resetBeadsCache()

    // Set up mock return values
    mockIssuesApi.list.mockResolvedValue(mockIssues.filter(i => i.type !== 'epic'))
    mockFindBeadsDir.mockResolvedValue('/mock/project/.beads')

    transport = localTransport({
      repo: {
        owner: 'test',
        name: 'test',
        defaultBranch: 'main',
        url: 'https://github.com/test/test',
      },
      cwd: '/mock/project',
    })
  })

  afterEach(() => {
    resetBeadsCache()
  })

  it('should convert SDK Issue type to transport Issue type', async () => {
    const result = await transport.call('issues.list', [{}]) as Array<Record<string, unknown>>

    // Verify the result matches the transport Issue interface
    for (const issue of result) {
      expect(issue).toHaveProperty('id')
      expect(issue).toHaveProperty('title')
      expect(issue).toHaveProperty('status')
      expect(issue).toHaveProperty('type')
      expect(issue).toHaveProperty('priority')
    }
  })
})
