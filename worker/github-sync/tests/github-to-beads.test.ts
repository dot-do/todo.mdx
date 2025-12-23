import { describe, it, expect } from 'vitest'
import { convertGitHubToBeads } from '../github-to-beads'
import type { GitHubIssue } from '../github-client'
import type { ConvertOptions } from '../github-to-beads'
import { defaultConventions } from '../conventions'

describe('convertGitHubToBeads', () => {
  const baseOptions: ConvertOptions = {
    conventions: defaultConventions,
    owner: 'testowner',
    repo: 'testrepo',
  }

  const minimalGitHubIssue: GitHubIssue = {
    number: 123,
    title: 'Test issue',
    body: null,
    state: 'open',
    labels: [],
    assignee: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    closed_at: null,
    html_url: 'https://github.com/testowner/testrepo/issues/123',
  }

  it('converts minimal GitHub issue to BeadsIssue with defaults', () => {
    const result = convertGitHubToBeads(minimalGitHubIssue, baseOptions)

    expect(result).toEqual({
      title: 'Test issue',
      description: '',
      type: 'task',
      status: 'open',
      priority: 2,
      assignee: undefined,
      labels: [],
      dependsOn: [],
      blocks: [],
      parent: undefined,
      externalRef: 'github.com/testowner/testrepo/issues/123',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
      closedAt: undefined,
    })
  })

  it('converts full GitHub issue with all optional fields', () => {
    const fullIssue: GitHubIssue = {
      number: 456,
      title: 'Full featured issue',
      body: 'This is a detailed description.\n\nDepends on: #123, #124\nBlocks: #789\nParent: #100',
      state: 'closed',
      labels: [{ name: 'bug' }, { name: 'P1' }],
      assignee: { login: 'johndoe' },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
      closed_at: '2025-01-03T00:00:00Z',
      html_url: 'https://github.com/testowner/testrepo/issues/456',
    }

    const result = convertGitHubToBeads(fullIssue, baseOptions)

    expect(result).toEqual({
      title: 'Full featured issue',
      description: 'This is a detailed description.',
      type: 'bug',
      status: 'closed',
      priority: 1,
      assignee: 'johndoe',
      labels: [],
      dependsOn: ['123', '124'],
      blocks: ['789'],
      parent: '100',
      externalRef: 'github.com/testowner/testrepo/issues/456',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
      closedAt: '2025-01-03T00:00:00Z',
    })
  })

  it('maps bug label to bug type', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'bug' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.type).toBe('bug')
  })

  it('maps enhancement label to feature type', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'enhancement' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.type).toBe('feature')
  })

  it('maps task label to task type', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'task' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.type).toBe('task')
  })

  it('maps epic label to epic type', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'epic' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.type).toBe('epic')
  })

  it('maps chore label to chore type', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'chore' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.type).toBe('chore')
  })

  it('maps P0 label to priority 0', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'P0' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.priority).toBe(0)
  })

  it('maps P1 label to priority 1', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'P1' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.priority).toBe(1)
  })

  it('maps P2 label to priority 2', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'P2' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.priority).toBe(2)
  })

  it('maps P3 label to priority 3', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'P3' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.priority).toBe(3)
  })

  it('maps P4 label to priority 4', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'P4' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.priority).toBe(4)
  })

  it('maps closed state to closed status', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      state: 'closed',
      closed_at: '2025-01-03T00:00:00Z',
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.status).toBe('closed')
    expect(result.closedAt).toBe('2025-01-03T00:00:00Z')
  })

  it('maps in-progress label to in_progress status', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'status:in-progress' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.status).toBe('in_progress')
  })

  it('defaults open issues to open status', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      state: 'open',
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.status).toBe('open')
  })

  it('extracts dependencies from body', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      body: 'Some description.\n\nDepends on: #123, #456\n\nMore text.',
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.dependsOn).toEqual(['123', '456'])
  })

  it('extracts blocks from body', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      body: 'Some description.\n\nBlocks: #789\n\nMore text.',
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.blocks).toEqual(['789'])
  })

  it('extracts parent from body', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      body: 'Some description.\n\nParent: #100\n\nMore text.',
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.parent).toBe('100')
  })

  it('strips convention patterns from description', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      body: 'This is the actual description.\n\nDepends on: #123\nBlocks: #456\nParent: #100',
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.description).toBe('This is the actual description.')
  })

  it('generates correct external ref URL format', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      number: 999,
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.externalRef).toBe('github.com/testowner/testrepo/issues/999')
  })

  it('passes through custom labels not consumed by conventions', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      labels: [{ name: 'bug' }, { name: 'P1' }, { name: 'custom-label' }, { name: 'another-tag' }],
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.labels).toEqual(['custom-label', 'another-tag'])
  })

  it('handles empty body as empty description', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      body: null,
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.description).toBe('')
    expect(result.dependsOn).toEqual([])
    expect(result.blocks).toEqual([])
    expect(result.parent).toBeUndefined()
  })

  it('handles empty string body', () => {
    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      body: '',
    }

    const result = convertGitHubToBeads(issue, baseOptions)
    expect(result.description).toBe('')
  })

  it('supports custom conventions', () => {
    const customOptions: ConvertOptions = {
      conventions: {
        labels: {
          type: {
            'defect': 'bug',
            'story': 'feature',
          },
          priority: {
            'critical': 0,
            'high': 1,
            'medium': 2,
            'low': 3,
          },
          status: {
            inProgress: 'doing',
          },
        },
        dependencies: {
          pattern: 'Requires:\\s*(.+)',
          separator: ', ',
          blocksPattern: 'Blocked by this:\\s*(.+)',
        },
        epics: {
          bodyPattern: 'Epic:\\s*#(\\d+)',
        },
      },
      owner: 'customowner',
      repo: 'customrepo',
    }

    const issue: GitHubIssue = {
      ...minimalGitHubIssue,
      number: 777,
      body: 'Custom conventions test.\n\nRequires: #111\n\nBlocked by this: #222\n\nEpic: #333',
      labels: [{ name: 'defect' }, { name: 'critical' }, { name: 'doing' }],
    }

    const result = convertGitHubToBeads(issue, customOptions)

    expect(result.type).toBe('bug')
    expect(result.priority).toBe(0)
    expect(result.status).toBe('in_progress')
    expect(result.dependsOn).toEqual(['111'])
    expect(result.blocks).toEqual(['222'])
    expect(result.parent).toBe('333')
    expect(result.externalRef).toBe('github.com/customowner/customrepo/issues/777')
  })
})
