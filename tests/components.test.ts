import { describe, it, expect } from 'vitest'
import {
  Issues,
  Issue,
  IssueLabels,
  IssueDependencies,
  createIssueExtractors,
  type IssuesProps,
  type IssueLabelsProps,
  type IssueDependenciesProps,
} from '../src/components/issues.js'
import type { TodoIssue } from '../src/types.js'

describe('Issues Component', () => {
  const sampleIssues: TodoIssue[] = [
    {
      id: 'todo-001',
      title: 'First Task',
      status: 'open',
      type: 'task',
      priority: 1,
      assignee: 'alice',
      labels: ['bug', 'urgent'],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T12:00:00Z',
    },
    {
      id: 'todo-002',
      title: 'Second Feature',
      status: 'in_progress',
      type: 'feature',
      priority: 2,
      assignee: 'bob',
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T12:00:00Z',
    },
    {
      id: 'todo-003',
      title: 'Third Bug',
      status: 'closed',
      type: 'bug',
      priority: 0,
      closedAt: '2025-01-03T00:00:00Z',
      createdAt: '2025-01-03T00:00:00Z',
      updatedAt: '2025-01-03T12:00:00Z',
    },
    {
      id: 'todo-004',
      title: 'Blocked Task',
      status: 'blocked',
      type: 'task',
      priority: 2,
      dependsOn: ['todo-001'],
      createdAt: '2025-01-04T00:00:00Z',
      updatedAt: '2025-01-04T12:00:00Z',
    },
  ]

  describe('render', () => {
    it('should render issues as a markdown table', () => {
      const rendered = Issues.render({ issues: sampleIssues })

      expect(rendered).toContain('| id | title | status | priority | type |')
      expect(rendered).toContain('|---|---|---|---|---|')
      expect(rendered).toContain('| todo-001 | First Task | open | 1 | task |')
      expect(rendered).toContain('| todo-002 | Second Feature | in_progress | 2 | feature |')
    })

    it('should render with custom columns', () => {
      const rendered = Issues.render({
        issues: sampleIssues,
        columns: ['id', 'title', 'status'],
      })

      expect(rendered).toContain('| id | title | status |')
      expect(rendered).toContain('|---|---|---|')
      expect(rendered).not.toContain('priority')
      expect(rendered).not.toContain('type')
    })

    it('should filter by status', () => {
      const rendered = Issues.render({
        issues: sampleIssues,
        status: 'open',
      })

      expect(rendered).toContain('todo-001')
      expect(rendered).not.toContain('todo-002')
      expect(rendered).not.toContain('todo-003')
    })

    it('should limit number of issues', () => {
      const rendered = Issues.render({
        issues: sampleIssues,
        limit: 2,
      })

      expect(rendered).toContain('todo-001')
      expect(rendered).toContain('todo-002')
      expect(rendered).not.toContain('todo-003')
      expect(rendered).not.toContain('todo-004')
    })

    it('should render as list format', () => {
      const rendered = Issues.render({
        issues: sampleIssues,
        format: 'list',
      })

      // renderMarkdownList uses title as link text, not ID
      expect(rendered).toContain('- [First Task](./todo-001.md)')
      expect(rendered).toContain('- [Second Feature](./todo-002.md)')
      expect(rendered).not.toContain('|')
    })

    it('should handle empty issues array', () => {
      const rendered = Issues.render({ issues: [] })

      // renderMarkdownTable returns "_No items_" for empty array
      expect(rendered).toBe('_No items_')
    })
  })

  describe('extract', () => {
    it('should extract issues from markdown table', () => {
      const markdown = `| id | title | status | priority | type |
|---|---|---|---|---|
| todo-001 | First Task | open | 1 | task |
| todo-002 | Second Feature | in_progress | 2 | feature |`

      const result = Issues.extract(markdown)

      expect(result.issues).toHaveLength(2)
      expect(result.issues[0]).toMatchObject({
        id: 'todo-001',
        title: 'First Task',
        status: 'open',
        priority: 1,
        type: 'task',
      })
      expect(result.columns).toEqual(['id', 'title', 'status', 'priority', 'type'])
    })

    it('should extract issues from list format', () => {
      const markdown = `- [todo-001](./todo-001.md)
- [todo-002](./todo-002.md)`

      const result = Issues.extract(markdown)

      expect(result.issues).toHaveLength(2)
      expect(result.issues[0].id).toBe('todo-001')
      expect(result.issues[1].id).toBe('todo-002')
    })

    it('should handle plain list without links', () => {
      const markdown = `- todo-001: First Task
- todo-002: Second Feature`

      const result = Issues.extract(markdown)

      expect(result.issues).toHaveLength(2)
    })
  })

  describe('round-trip', () => {
    it('should maintain data through render -> extract cycle', () => {
      const original = {
        issues: sampleIssues.slice(0, 2),
        columns: ['id', 'title', 'status'] as string[],
      }

      const rendered = Issues.render(original)
      const extracted = Issues.extract(rendered)

      expect(extracted.issues).toHaveLength(2)
      expect(extracted.issues[0].id).toBe(original.issues[0].id)
      expect(extracted.issues[0].title).toBe(original.issues[0].title)
      expect(extracted.issues[0].status).toBe(original.issues[0].status)
      expect(extracted.columns).toEqual(original.columns)
    })
  })
})

describe('Issues.Blocked', () => {
  const sampleIssues: TodoIssue[] = [
    {
      id: 'todo-001',
      title: 'Open Task',
      status: 'open',
      type: 'task',
      priority: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T12:00:00Z',
    },
    {
      id: 'todo-002',
      title: 'Blocked Task',
      status: 'blocked',
      type: 'task',
      priority: 2,
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T12:00:00Z',
    },
  ]

  it('should render only blocked issues', () => {
    const rendered = Issues.Blocked.render({ issues: sampleIssues })

    expect(rendered).toContain('todo-002')
    expect(rendered).not.toContain('todo-001')
  })
})

describe('Issues.Ready', () => {
  const sampleIssues: TodoIssue[] = [
    {
      id: 'todo-001',
      title: 'Ready Task',
      status: 'open',
      type: 'task',
      priority: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T12:00:00Z',
    },
    {
      id: 'todo-002',
      title: 'Dependent Task',
      status: 'open',
      type: 'task',
      priority: 2,
      dependsOn: ['todo-001'],
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T12:00:00Z',
    },
    {
      id: 'todo-003',
      title: 'Closed Task',
      status: 'closed',
      type: 'task',
      priority: 1,
      createdAt: '2025-01-03T00:00:00Z',
      updatedAt: '2025-01-03T12:00:00Z',
      closedAt: '2025-01-03T12:00:00Z',
    },
  ]

  it('should render only ready (unblocked open) issues', () => {
    const rendered = Issues.Ready.render({ issues: sampleIssues })

    expect(rendered).toContain('todo-001')
    expect(rendered).not.toContain('todo-002') // Has dependencies
    expect(rendered).not.toContain('todo-003') // Closed
  })
})

describe('Issues.Open', () => {
  const sampleIssues: TodoIssue[] = [
    {
      id: 'todo-001',
      title: 'Open Task',
      status: 'open',
      type: 'task',
      priority: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T12:00:00Z',
    },
    {
      id: 'todo-002',
      title: 'Closed Task',
      status: 'closed',
      type: 'task',
      priority: 2,
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T12:00:00Z',
      closedAt: '2025-01-02T12:00:00Z',
    },
  ]

  it('should render only open issues', () => {
    const rendered = Issues.Open.render({ issues: sampleIssues })

    expect(rendered).toContain('todo-001')
    expect(rendered).not.toContain('todo-002')
  })
})

describe('Issues.Closed', () => {
  const sampleIssues: TodoIssue[] = [
    {
      id: 'todo-001',
      title: 'Open Task',
      status: 'open',
      type: 'task',
      priority: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T12:00:00Z',
    },
    {
      id: 'todo-002',
      title: 'Closed Task',
      status: 'closed',
      type: 'task',
      priority: 2,
      createdAt: '2025-01-02T00:00:00Z',
      updatedAt: '2025-01-02T12:00:00Z',
      closedAt: '2025-01-02T12:00:00Z',
    },
  ]

  it('should render only closed issues', () => {
    const rendered = Issues.Closed.render({ issues: sampleIssues })

    expect(rendered).toContain('todo-002')
    expect(rendered).not.toContain('todo-001')
  })
})

describe('Issue.Labels', () => {
  describe('render', () => {
    it('should render labels as comma-separated by default', () => {
      const rendered = IssueLabels.render({
        labels: ['bug', 'urgent', 'frontend'],
      })

      expect(rendered).toBe('bug, urgent, frontend')
    })

    it('should render labels as badges', () => {
      const rendered = IssueLabels.render({
        labels: ['bug', 'urgent'],
        format: 'badges',
      })

      expect(rendered).toBe('`bug` `urgent`')
    })

    it('should handle empty labels', () => {
      const rendered = IssueLabels.render({ labels: [] })

      expect(rendered).toBe('')
    })

    it('should handle undefined labels', () => {
      const rendered = IssueLabels.render({})

      expect(rendered).toBe('')
    })
  })

  describe('extract', () => {
    it('should extract comma-separated labels', () => {
      const result = IssueLabels.extract('bug, urgent, frontend')

      expect(result.labels).toEqual(['bug', 'urgent', 'frontend'])
      expect(result.format).toBe('comma')
    })

    it('should extract badge format labels', () => {
      const result = IssueLabels.extract('`bug` `urgent`')

      expect(result.labels).toEqual(['bug', 'urgent'])
      expect(result.format).toBe('badges')
    })

    it('should handle empty content', () => {
      const result = IssueLabels.extract('')

      expect(result.labels).toEqual([])
    })

    it('should trim whitespace in comma-separated', () => {
      const result = IssueLabels.extract('bug,  urgent  , frontend')

      expect(result.labels).toEqual(['bug', 'urgent', 'frontend'])
    })
  })

  describe('round-trip', () => {
    it('should maintain labels through comma format cycle', () => {
      const original = { labels: ['bug', 'urgent', 'frontend'] }

      const rendered = IssueLabels.render(original)
      const extracted = IssueLabels.extract(rendered)

      expect(extracted.labels).toEqual(original.labels)
    })

    it('should maintain labels through badges format cycle', () => {
      const original = { labels: ['bug', 'urgent'], format: 'badges' as const }

      const rendered = IssueLabels.render(original)
      const extracted = IssueLabels.extract(rendered)

      expect(extracted.labels).toEqual(original.labels)
      expect(extracted.format).toBe('badges')
    })
  })
})

describe('Issue.Dependencies', () => {
  describe('render', () => {
    it('should render dependencies as plain list by default', () => {
      const rendered = IssueDependencies.render({
        dependencies: ['todo-001', 'todo-002'],
      })

      expect(rendered).toBe('- todo-001\n- todo-002')
    })

    it('should render dependencies as markdown links', () => {
      const rendered = IssueDependencies.render({
        dependencies: ['todo-001', 'todo-002'],
        format: 'links',
      })

      expect(rendered).toBe('- [todo-001](./todo-001.md)\n- [todo-002](./todo-002.md)')
    })

    it('should handle empty dependencies', () => {
      const rendered = IssueDependencies.render({ dependencies: [] })

      expect(rendered).toBe('')
    })

    it('should handle undefined dependencies', () => {
      const rendered = IssueDependencies.render({})

      expect(rendered).toBe('')
    })
  })

  describe('extract', () => {
    it('should extract plain list dependencies', () => {
      const result = IssueDependencies.extract('- todo-001\n- todo-002')

      expect(result.dependencies).toEqual(['todo-001', 'todo-002'])
      expect(result.format).toBe('list')
    })

    it('should extract link format dependencies', () => {
      const result = IssueDependencies.extract(
        '- [todo-001](./todo-001.md)\n- [todo-002](./todo-002.md)'
      )

      expect(result.dependencies).toEqual(['todo-001', 'todo-002'])
      expect(result.format).toBe('links')
    })

    it('should handle empty content', () => {
      const result = IssueDependencies.extract('')

      expect(result.dependencies).toEqual([])
    })

    it('should filter out empty lines', () => {
      const result = IssueDependencies.extract('- todo-001\n\n- todo-002\n')

      expect(result.dependencies).toEqual(['todo-001', 'todo-002'])
    })
  })

  describe('round-trip', () => {
    it('should maintain dependencies through plain list cycle', () => {
      const original = { dependencies: ['todo-001', 'todo-002'] }

      const rendered = IssueDependencies.render(original)
      const extracted = IssueDependencies.extract(rendered)

      expect(extracted.dependencies).toEqual(original.dependencies)
    })

    it('should maintain dependencies through links format cycle', () => {
      const original = {
        dependencies: ['todo-001', 'todo-002'],
        format: 'links' as const,
      }

      const rendered = IssueDependencies.render(original)
      const extracted = IssueDependencies.extract(rendered)

      expect(extracted.dependencies).toEqual(original.dependencies)
      expect(extracted.format).toBe('links')
    })
  })
})

describe('createIssueExtractors', () => {
  it('should create extractor map for all components', () => {
    const extractors = createIssueExtractors()

    expect(extractors).toHaveProperty('Issues')
    expect(extractors).toHaveProperty('Issues.Blocked')
    expect(extractors).toHaveProperty('Issues.Ready')
    expect(extractors).toHaveProperty('Issues.Open')
    expect(extractors).toHaveProperty('Issues.Closed')
    expect(extractors).toHaveProperty('Issue.Labels')
    expect(extractors).toHaveProperty('Issue.Dependencies')

    // Check that extractors are actually extractors
    expect(typeof extractors['Issues']).toBe('object')
    expect(extractors['Issues']).toHaveProperty('extract')
  })
})

describe('Issue namespace', () => {
  it('should export Labels component', () => {
    expect(Issue.Labels).toBe(IssueLabels)
  })

  it('should export Dependencies component', () => {
    expect(Issue.Dependencies).toBe(IssueDependencies)
  })
})
