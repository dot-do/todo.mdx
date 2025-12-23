import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compile, compileToString } from '../src/compiler.js'
import type { TodoIssue } from '../src/types.js'

// Mock beads and parser modules
vi.mock('../src/beads.js', () => ({
  loadBeadsIssues: vi.fn().mockResolvedValue([]),
  hasBeadsDirectory: vi.fn().mockResolvedValue(false),
}))

vi.mock('../src/parser.js', () => ({
  loadTodoFiles: vi.fn().mockResolvedValue([]),
  parseTodoFile: vi.fn(),
}))

describe('compileToString', () => {
  it('should compile empty issue list', () => {
    const result = compileToString([])

    expect(result).toContain('# TODO')
    expect(result).not.toContain('## In Progress')
    expect(result).not.toContain('## Open')
  })

  it('should compile open issues by status', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Open task',
        status: 'open',
        type: 'task',
        priority: 2,
      },
      {
        id: 'todo-2',
        title: 'In progress task',
        status: 'in_progress',
        type: 'task',
        priority: 1,
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('# TODO')
    expect(result).toContain('## In Progress')
    expect(result).toContain('- [ ] [#todo-2] In progress task')
    expect(result).toContain('## Open')
    expect(result).toContain('- [ ] [#todo-1] Open task')
  })

  it('should group open issues by type', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Bug fix',
        status: 'open',
        type: 'bug',
        priority: 1,
      },
      {
        id: 'todo-2',
        title: 'New feature',
        status: 'open',
        type: 'feature',
        priority: 2,
      },
      {
        id: 'todo-3',
        title: 'Simple task',
        status: 'open',
        type: 'task',
        priority: 2,
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('### Bugs')
    expect(result).toContain('- [ ] [#todo-1] Bug fix')
    expect(result).toContain('### Features')
    expect(result).toContain('- [ ] [#todo-2] New feature')
    expect(result).toContain('### Tasks')
    expect(result).toContain('- [ ] [#todo-3] Simple task')
  })

  it('should sort issues by priority within groups', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Low priority',
        status: 'open',
        type: 'task',
        priority: 3,
      },
      {
        id: 'todo-2',
        title: 'High priority',
        status: 'open',
        type: 'task',
        priority: 0,
      },
      {
        id: 'todo-3',
        title: 'Medium priority',
        status: 'open',
        type: 'task',
        priority: 2,
      },
    ]

    const result = compileToString(issues)

    const lines = result.split('\n')
    const taskLines = lines.filter(l => l.includes('[#todo-'))

    expect(taskLines[0]).toContain('todo-2') // P0
    expect(taskLines[1]).toContain('todo-3') // P2
    expect(taskLines[2]).toContain('todo-1') // P3
  })

  it('should include priority and type metadata in items', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Important bug',
        status: 'open',
        type: 'bug',
        priority: 1,
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('- [ ] [#todo-1] Important bug - *bug, P1*')
  })

  it('should show recently completed issues by default', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Completed task',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-22T10:00:00Z',
      },
      {
        id: 'todo-2',
        title: 'Open task',
        status: 'open',
        type: 'task',
        priority: 2,
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('## Recently Completed')
    expect(result).toContain('- [x] [#todo-1] Completed task')
    expect(result).toContain('closed 2025-12-22')
  })

  it('should exclude completed issues when includeCompleted is false', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Completed task',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-22T10:00:00Z',
      },
    ]

    const result = compileToString(issues, { includeCompleted: false })

    expect(result).not.toContain('## Recently Completed')
    expect(result).not.toContain('Completed task')
  })

  it('should limit completed issues by completedLimit', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Completed 1',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-23T10:00:00Z',
      },
      {
        id: 'todo-2',
        title: 'Completed 2',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-22T10:00:00Z',
      },
      {
        id: 'todo-3',
        title: 'Completed 3',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-21T10:00:00Z',
      },
    ]

    const result = compileToString(issues, { completedLimit: 2 })

    const lines = result.split('\n')
    const completedLines = lines.filter(l => l.includes('[x]'))

    expect(completedLines.length).toBe(2)
    expect(result).toContain('Completed 1')
    expect(result).toContain('Completed 2')
    expect(result).not.toContain('Completed 3')
  })

  it('should handle epic type issues', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-epic',
        title: 'Major feature epic',
        status: 'open',
        type: 'epic',
        priority: 0,
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('### Epics')
    expect(result).toContain('- [ ] [#todo-epic] Major feature epic - *epic, P0*')
  })

  it('should format closed date as YYYY-MM-DD', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Done',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-22T15:30:45.123Z',
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('closed 2025-12-22')
    expect(result).not.toContain('15:30')
  })

  it('should handle issues without closedAt date', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Closed without date',
        status: 'closed',
        type: 'task',
        priority: 2,
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('## Recently Completed')
    expect(result).toContain('[#todo-1] Closed without date')
  })

  it('should show empty state when no open issues', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Closed',
        status: 'closed',
        type: 'task',
        priority: 2,
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('# TODO')
    expect(result).not.toContain('## Open')
    expect(result).not.toContain('## In Progress')
  })

  it('should handle issues with assignee', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Assigned task',
        status: 'open',
        type: 'task',
        priority: 2,
        assignee: 'alice',
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('- [ ] [#todo-1] Assigned task - *task, P2, @alice*')
  })

  it('should handle issues with labels', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Labeled task',
        status: 'open',
        type: 'task',
        priority: 2,
        labels: ['urgent', 'security'],
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('- [ ] [#todo-1] Labeled task - *task, P2 #urgent #security*')
  })

  it('should handle issues with both assignee and labels', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Full metadata',
        status: 'open',
        type: 'feature',
        priority: 1,
        assignee: 'bob',
        labels: ['api', 'backend'],
      },
    ]

    const result = compileToString(issues)

    expect(result).toContain('- [ ] [#todo-1] Full metadata - *feature, P1, @bob #api #backend*')
  })

  it('should sort completed issues by closedAt date descending', () => {
    const issues: TodoIssue[] = [
      {
        id: 'todo-1',
        title: 'Older',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-20T10:00:00Z',
      },
      {
        id: 'todo-2',
        title: 'Newer',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-23T10:00:00Z',
      },
      {
        id: 'todo-3',
        title: 'Middle',
        status: 'closed',
        type: 'task',
        priority: 2,
        closedAt: '2025-12-22T10:00:00Z',
      },
    ]

    const result = compileToString(issues)

    const lines = result.split('\n')
    const completedLines = lines.filter(l => l.includes('[x]'))

    expect(completedLines[0]).toContain('todo-2') // newest
    expect(completedLines[1]).toContain('todo-3') // middle
    expect(completedLines[2]).toContain('todo-1') // oldest
  })
})

describe('compile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load and merge issues from beads and files', async () => {
    const { loadBeadsIssues } = await import('../src/beads.js')
    const { loadTodoFiles } = await import('../src/parser.js')

    vi.mocked(loadBeadsIssues).mockResolvedValueOnce([
      {
        id: 'todo-1',
        title: 'From beads',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'beads',
      },
    ])

    vi.mocked(loadTodoFiles).mockResolvedValueOnce([
      {
        id: 'todo-2',
        title: 'From file',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
      },
    ])

    const result = await compile({ todoDir: '.todo' })

    expect(result.issues.length).toBe(2)
    expect(result.output).toContain('From beads')
    expect(result.output).toContain('From file')
    expect(result.files).toEqual([])
  })

  it('should prefer beads data when merging duplicates', async () => {
    const { loadBeadsIssues } = await import('../src/beads.js')
    const { loadTodoFiles } = await import('../src/parser.js')

    vi.mocked(loadBeadsIssues).mockResolvedValueOnce([
      {
        id: 'todo-1',
        title: 'Beads version',
        status: 'in_progress',
        type: 'task',
        priority: 1,
        source: 'beads',
      },
    ])

    vi.mocked(loadTodoFiles).mockResolvedValueOnce([
      {
        id: 'todo-1',
        title: 'File version',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
      },
    ])

    const result = await compile({ todoDir: '.todo', conflictStrategy: 'beads-wins' })

    expect(result.issues.length).toBe(1)
    expect(result.issues[0].title).toBe('Beads version')
    expect(result.issues[0].status).toBe('in_progress')
    expect(result.issues[0].priority).toBe(1)
  })

  it('should handle missing beads directory gracefully', async () => {
    const { loadBeadsIssues } = await import('../src/beads.js')
    const { loadTodoFiles } = await import('../src/parser.js')

    vi.mocked(loadBeadsIssues).mockResolvedValueOnce([])

    vi.mocked(loadTodoFiles).mockResolvedValueOnce([
      {
        id: 'todo-1',
        title: 'Only from file',
        status: 'open',
        type: 'task',
        priority: 2,
        source: 'file',
      },
    ])

    const result = await compile({ beads: false })

    expect(result.issues.length).toBe(1)
    expect(result.issues[0].title).toBe('Only from file')
  })

  it('should return CompileResult with output, files, and issues', async () => {
    const { loadBeadsIssues } = await import('../src/beads.js')
    const { loadTodoFiles } = await import('../src/parser.js')

    vi.mocked(loadBeadsIssues).mockResolvedValueOnce([])
    vi.mocked(loadTodoFiles).mockResolvedValueOnce([])

    const result = await compile()

    expect(result).toHaveProperty('output')
    expect(result).toHaveProperty('files')
    expect(result).toHaveProperty('issues')
    expect(typeof result.output).toBe('string')
    expect(Array.isArray(result.files)).toBe(true)
    expect(Array.isArray(result.issues)).toBe(true)
  })
})
