import { describe, it, expect } from 'vitest'
import { convertBeadsToGitHub, type BeadsIssue } from '../src/beads-to-github'
import { defaultConventions } from '../src/conventions'

describe('convertBeadsToGitHub', () => {
  const baseIssue: BeadsIssue = {
    id: 'test-001',
    title: 'Test Issue',
    description: 'Test description',
    type: 'task',
    status: 'open',
    priority: 2,
    labels: [],
    dependsOn: [],
    blocks: [],
    externalRef: '',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }

  describe('basic conversion', () => {
    it('should convert minimal beads issue to GitHub payload', () => {
      const result = convertBeadsToGitHub(baseIssue, {
        conventions: defaultConventions,
      })

      expect(result).toEqual({
        title: 'Test Issue',
        body: 'Test description',
        labels: ['task', 'P2'],
        assignees: [],
        state: 'open',
      })
    })

    it('should handle empty description', () => {
      const issue = { ...baseIssue, description: '' }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.body).toBe('')
    })
  })

  describe('type to label mapping', () => {
    it('should map bug type to bug label', () => {
      const issue = { ...baseIssue, type: 'bug' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('bug')
    })

    it('should map feature type to enhancement label', () => {
      const issue = { ...baseIssue, type: 'feature' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('enhancement')
    })

    it('should map task type to task label', () => {
      const issue = { ...baseIssue, type: 'task' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('task')
    })

    it('should map epic type to epic label', () => {
      const issue = { ...baseIssue, type: 'epic' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('epic')
    })

    it('should map chore type to chore label', () => {
      const issue = { ...baseIssue, type: 'chore' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('chore')
    })
  })

  describe('priority to label mapping', () => {
    it('should map priority 0 to P0 label', () => {
      const issue = { ...baseIssue, priority: 0 as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('P0')
    })

    it('should map priority 1 to P1 label', () => {
      const issue = { ...baseIssue, priority: 1 as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('P1')
    })

    it('should map priority 2 to P2 label', () => {
      const issue = { ...baseIssue, priority: 2 as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('P2')
    })

    it('should map priority 3 to P3 label', () => {
      const issue = { ...baseIssue, priority: 3 as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('P3')
    })

    it('should map priority 4 to P4 label', () => {
      const issue = { ...baseIssue, priority: 4 as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('P4')
    })
  })

  describe('status to state mapping', () => {
    it('should map closed status to closed state', () => {
      const issue = {
        ...baseIssue,
        status: 'closed' as const,
        closedAt: '2025-01-02T00:00:00Z',
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.state).toBe('closed')
      expect(result.labels).not.toContain('status:in-progress')
    })

    it('should map in_progress status to open state with in-progress label', () => {
      const issue = { ...baseIssue, status: 'in_progress' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.state).toBe('open')
      expect(result.labels).toContain('status:in-progress')
    })

    it('should map open status to open state without extra labels', () => {
      const issue = { ...baseIssue, status: 'open' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.state).toBe('open')
      expect(result.labels).not.toContain('status:in-progress')
    })

    it('should map blocked status to open state', () => {
      const issue = { ...baseIssue, status: 'blocked' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.state).toBe('open')
      // GitHub has no blocked concept, so no special label
      expect(result.labels).not.toContain('blocked')
    })
  })

  describe('dependencies injection', () => {
    it('should inject dependsOn refs into body', () => {
      const issue = {
        ...baseIssue,
        dependsOn: ['test-002', 'test-003'],
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
        issueNumberMap: new Map([
          ['test-002', 123],
          ['test-003', 456],
        ]),
      })

      expect(result.body).toContain('---')
      expect(result.body).toContain('<!-- beads-sync metadata - do not edit below -->')
      expect(result.body).toContain('Depends on: #123, #456')
    })

    it('should handle dependsOn without issue number map', () => {
      const issue = {
        ...baseIssue,
        dependsOn: ['test-002', 'test-003'],
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      // Should use beads IDs if no mapping available
      expect(result.body).toContain('Depends on: test-002, test-003')
    })
  })

  describe('blocks injection', () => {
    it('should inject blocks refs into body', () => {
      const issue = {
        ...baseIssue,
        blocks: ['test-004'],
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
        issueNumberMap: new Map([
          ['test-004', 789],
        ]),
      })

      expect(result.body).toContain('---')
      expect(result.body).toContain('Blocks: #789')
    })

    it('should handle blocks without issue number map', () => {
      const issue = {
        ...baseIssue,
        blocks: ['test-004'],
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.body).toContain('Blocks: test-004')
    })
  })

  describe('parent injection', () => {
    it('should inject parent ref into body', () => {
      const issue = {
        ...baseIssue,
        parent: 'test-epic',
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
        issueNumberMap: new Map([
          ['test-epic', 100],
        ]),
      })

      expect(result.body).toContain('---')
      expect(result.body).toContain('Parent: #100')
    })

    it('should handle parent without issue number map', () => {
      const issue = {
        ...baseIssue,
        parent: 'test-epic',
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.body).toContain('Parent: test-epic')
    })
  })

  describe('combined metadata injection', () => {
    it('should inject all metadata when deps, blocks, and parent present', () => {
      const issue = {
        ...baseIssue,
        dependsOn: ['test-002', 'test-003'],
        blocks: ['test-004'],
        parent: 'test-epic',
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
        issueNumberMap: new Map([
          ['test-002', 123],
          ['test-003', 456],
          ['test-004', 789],
          ['test-epic', 100],
        ]),
      })

      expect(result.body).toContain('Test description')
      expect(result.body).toContain('---')
      expect(result.body).toContain('<!-- beads-sync metadata - do not edit below -->')
      expect(result.body).toContain('Depends on: #123, #456')
      expect(result.body).toContain('Blocks: #789')
      expect(result.body).toContain('Parent: #100')

      // Verify order: description, separator, metadata
      const bodyParts = result.body!.split('---')
      expect(bodyParts[0].trim()).toBe('Test description')
      expect(bodyParts[1]).toContain('Depends on:')
      expect(bodyParts[1]).toContain('Blocks:')
      expect(bodyParts[1]).toContain('Parent:')
    })
  })

  describe('empty arrays handling', () => {
    it('should not add metadata section when no dependencies, blocks, or parent', () => {
      const issue = {
        ...baseIssue,
        dependsOn: [],
        blocks: [],
        parent: undefined,
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.body).toBe('Test description')
      expect(result.body).not.toContain('---')
      expect(result.body).not.toContain('beads-sync metadata')
    })

    it('should add metadata section if at least one relationship exists', () => {
      const issue = {
        ...baseIssue,
        dependsOn: [],
        blocks: ['test-004'],
        parent: undefined,
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
        issueNumberMap: new Map([['test-004', 789]]),
      })

      expect(result.body).toContain('---')
      expect(result.body).toContain('Blocks: #789')
      expect(result.body).not.toContain('Depends on:')
      expect(result.body).not.toContain('Parent:')
    })
  })

  describe('assignee handling', () => {
    it('should convert assignee to assignees array', () => {
      const issue = {
        ...baseIssue,
        assignee: 'johndoe',
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.assignees).toEqual(['johndoe'])
    })

    it('should use empty array when no assignee', () => {
      const issue = {
        ...baseIssue,
        assignee: undefined,
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.assignees).toEqual([])
    })
  })

  describe('custom labels handling', () => {
    it('should include custom labels from beads issue', () => {
      const issue = {
        ...baseIssue,
        labels: ['custom-label', 'another-label'],
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      expect(result.labels).toContain('custom-label')
      expect(result.labels).toContain('another-label')
      expect(result.labels).toContain('task')
      expect(result.labels).toContain('P2')
    })
  })

  describe('label deduplication', () => {
    it('should deduplicate labels when custom labels overlap with generated ones', () => {
      const issue = {
        ...baseIssue,
        labels: ['task', 'P2', 'custom'],
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
      })

      // Count occurrences
      const taskCount = result.labels!.filter(l => l === 'task').length
      const p2Count = result.labels!.filter(l => l === 'P2').length

      expect(taskCount).toBe(1)
      expect(p2Count).toBe(1)
      expect(result.labels).toContain('custom')
    })
  })

  describe('custom conventions support', () => {
    it('should use custom type label mappings', () => {
      const customConventions = {
        ...defaultConventions,
        labels: {
          ...defaultConventions.labels,
          type: {
            'defect': 'bug',
            'story': 'feature',
            'work-item': 'task',
            'initiative': 'epic',
            'maintenance': 'chore',
          },
        },
      }

      const issue = { ...baseIssue, type: 'bug' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: customConventions,
      })

      expect(result.labels).toContain('defect')
      expect(result.labels).not.toContain('bug')
    })

    it('should use custom priority label mappings', () => {
      const customConventions = {
        ...defaultConventions,
        labels: {
          ...defaultConventions.labels,
          priority: {
            'critical': 0,
            'high': 1,
            'medium': 2,
            'low': 3,
            'backlog': 4,
          },
        },
      }

      const issue = { ...baseIssue, priority: 0 as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: customConventions,
      })

      expect(result.labels).toContain('critical')
      expect(result.labels).not.toContain('P0')
    })

    it('should use custom in-progress label', () => {
      const customConventions = {
        ...defaultConventions,
        labels: {
          ...defaultConventions.labels,
          status: {
            inProgress: 'in-progress',
          },
        },
      }

      const issue = { ...baseIssue, status: 'in_progress' as const }
      const result = convertBeadsToGitHub(issue, {
        conventions: customConventions,
      })

      expect(result.labels).toContain('in-progress')
      expect(result.labels).not.toContain('status:in-progress')
    })

    it('should use custom dependency separator', () => {
      const customConventions = {
        ...defaultConventions,
        dependencies: {
          ...defaultConventions.dependencies,
          separator: ' | ',
        },
      }

      const issue = {
        ...baseIssue,
        dependsOn: ['test-002', 'test-003'],
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: customConventions,
        issueNumberMap: new Map([
          ['test-002', 123],
          ['test-003', 456],
        ]),
      })

      expect(result.body).toContain('Depends on: #123 | #456')
    })
  })

  describe('issue number mapping', () => {
    it('should convert all beads IDs to GitHub numbers when mapping provided', () => {
      const issue = {
        ...baseIssue,
        dependsOn: ['abc-001', 'xyz-002'],
        blocks: ['def-003'],
        parent: 'epic-001',
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
        issueNumberMap: new Map([
          ['abc-001', 10],
          ['xyz-002', 20],
          ['def-003', 30],
          ['epic-001', 5],
        ]),
      })

      expect(result.body).toContain('Depends on: #10, #20')
      expect(result.body).toContain('Blocks: #30')
      expect(result.body).toContain('Parent: #5')
    })

    it('should handle partial mapping gracefully', () => {
      const issue = {
        ...baseIssue,
        dependsOn: ['mapped-001', 'unmapped-002'],
      }
      const result = convertBeadsToGitHub(issue, {
        conventions: defaultConventions,
        issueNumberMap: new Map([
          ['mapped-001', 100],
        ]),
      })

      // Should use # for mapped, plain ID for unmapped
      expect(result.body).toContain('Depends on: #100, unmapped-002')
    })
  })
})
