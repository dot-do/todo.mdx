import { describe, expect, it } from 'vitest'
import { mapLabels, type MappedFields } from '../src/label-mapper'
import { defaultConventions, type GitHubConventions } from '../src/conventions'

describe('mapLabels', () => {
  describe('basic type mapping', () => {
    it('should map bug label to bug type', () => {
      const result = mapLabels(['bug', 'P1'], 'open', defaultConventions)
      expect(result.type).toBe('bug')
      expect(result.priority).toBe(1)
      expect(result.status).toBe('open')
      expect(result.remainingLabels).toEqual([])
    })

    it('should map enhancement label to feature type', () => {
      const result = mapLabels(['enhancement', 'status:in-progress'], 'open', defaultConventions)
      expect(result.type).toBe('feature')
      expect(result.status).toBe('in_progress')
      expect(result.priority).toBe(2) // default
      expect(result.remainingLabels).toEqual([])
    })

    it('should map task label to task type', () => {
      const result = mapLabels(['task'], 'open', defaultConventions)
      expect(result.type).toBe('task')
    })

    it('should map epic label to epic type', () => {
      const result = mapLabels(['epic'], 'open', defaultConventions)
      expect(result.type).toBe('epic')
    })

    it('should map chore label to chore type', () => {
      const result = mapLabels(['chore'], 'open', defaultConventions)
      expect(result.type).toBe('chore')
    })
  })

  describe('priority mapping', () => {
    it('should map P0 to priority 0', () => {
      const result = mapLabels(['P0'], 'open', defaultConventions)
      expect(result.priority).toBe(0)
    })

    it('should map P1 to priority 1', () => {
      const result = mapLabels(['P1'], 'open', defaultConventions)
      expect(result.priority).toBe(1)
    })

    it('should map P2 to priority 2', () => {
      const result = mapLabels(['P2'], 'open', defaultConventions)
      expect(result.priority).toBe(2)
    })

    it('should map P3 to priority 3', () => {
      const result = mapLabels(['P3'], 'open', defaultConventions)
      expect(result.priority).toBe(3)
    })

    it('should map P4 to priority 4', () => {
      const result = mapLabels(['P4'], 'open', defaultConventions)
      expect(result.priority).toBe(4)
    })

    it('should default to priority 2 when no priority label', () => {
      const result = mapLabels(['bug'], 'open', defaultConventions)
      expect(result.priority).toBe(2)
    })

    it('should pick highest priority (lowest number) when multiple priority labels', () => {
      const result = mapLabels(['P3', 'P1', 'P2'], 'open', defaultConventions)
      expect(result.priority).toBe(1)
    })
  })

  describe('status mapping', () => {
    it('should map status:in-progress label to in_progress status', () => {
      const result = mapLabels(['status:in-progress'], 'open', defaultConventions)
      expect(result.status).toBe('in_progress')
    })

    it('should use open status from githubState when no in-progress label', () => {
      const result = mapLabels(['bug'], 'open', defaultConventions)
      expect(result.status).toBe('open')
    })

    it('should always use closed status when githubState is closed', () => {
      const result = mapLabels(['status:in-progress'], 'closed', defaultConventions)
      expect(result.status).toBe('closed')
    })

    it('should map closed githubState to closed status', () => {
      const result = mapLabels(['bug', 'P1'], 'closed', defaultConventions)
      expect(result.status).toBe('closed')
    })
  })

  describe('default values', () => {
    it('should default to task type when no type label', () => {
      const result = mapLabels(['P1'], 'open', defaultConventions)
      expect(result.type).toBe('task')
    })

    it('should provide all defaults for empty labels', () => {
      const result = mapLabels([], 'open', defaultConventions)
      expect(result.type).toBe('task')
      expect(result.priority).toBe(2)
      expect(result.status).toBe('open')
      expect(result.remainingLabels).toEqual([])
    })
  })

  describe('remaining labels', () => {
    it('should pass through unknown labels to remainingLabels', () => {
      const result = mapLabels(['bug', 'P1', 'good-first-issue', 'documentation'], 'open', defaultConventions)
      expect(result.remainingLabels).toEqual(['good-first-issue', 'documentation'])
    })

    it('should preserve order of remaining labels', () => {
      const result = mapLabels(['alpha', 'bug', 'beta', 'P1', 'gamma'], 'open', defaultConventions)
      expect(result.remainingLabels).toEqual(['alpha', 'beta', 'gamma'])
    })

    it('should return empty remainingLabels when all labels are consumed', () => {
      const result = mapLabels(['bug', 'P1', 'status:in-progress'], 'open', defaultConventions)
      expect(result.remainingLabels).toEqual([])
    })
  })

  describe('multiple matching labels', () => {
    it('should use first matching type label when multiple present', () => {
      const result = mapLabels(['enhancement', 'bug', 'task'], 'open', defaultConventions)
      expect(result.type).toBe('feature') // enhancement maps to feature
    })

    it('should consume all recognized labels even with duplicates', () => {
      const result = mapLabels(['bug', 'P1', 'P1', 'custom-label'], 'open', defaultConventions)
      expect(result.type).toBe('bug')
      expect(result.priority).toBe(1)
      expect(result.remainingLabels).toEqual(['custom-label'])
    })
  })

  describe('custom conventions', () => {
    it('should work with custom type mappings', () => {
      const customConventions: GitHubConventions = {
        labels: {
          type: {
            'custom-bug': 'bug',
            'story': 'feature',
          },
          priority: defaultConventions.labels.priority,
          status: defaultConventions.labels.status,
        },
        dependencies: defaultConventions.dependencies,
        epics: defaultConventions.epics,
      }

      const result = mapLabels(['custom-bug', 'P0'], 'open', customConventions)
      expect(result.type).toBe('bug')
      expect(result.priority).toBe(0)
    })

    it('should work with custom priority mappings', () => {
      const customConventions: GitHubConventions = {
        labels: {
          type: defaultConventions.labels.type,
          priority: {
            'critical': 0,
            'high': 1,
            'medium': 2,
            'low': 3,
          },
          status: defaultConventions.labels.status,
        },
        dependencies: defaultConventions.dependencies,
        epics: defaultConventions.epics,
      }

      const result = mapLabels(['bug', 'critical'], 'open', customConventions)
      expect(result.type).toBe('bug')
      expect(result.priority).toBe(0)
    })

    it('should work with custom in-progress label', () => {
      const customConventions: GitHubConventions = {
        labels: {
          type: defaultConventions.labels.type,
          priority: defaultConventions.labels.priority,
          status: {
            inProgress: 'in-progress',
          },
        },
        dependencies: defaultConventions.dependencies,
        epics: defaultConventions.epics,
      }

      const result = mapLabels(['bug', 'in-progress'], 'open', customConventions)
      expect(result.status).toBe('in_progress')
    })
  })

  describe('case sensitivity', () => {
    it('should match labels case-sensitively', () => {
      const result = mapLabels(['Bug', 'P1'], 'open', defaultConventions)
      expect(result.type).toBe('task') // 'Bug' should not match 'bug'
      expect(result.remainingLabels).toContain('Bug')
    })

    it('should match priority labels case-sensitively', () => {
      const result = mapLabels(['bug', 'p1'], 'open', defaultConventions)
      expect(result.priority).toBe(2) // 'p1' should not match 'P1'
      expect(result.remainingLabels).toContain('p1')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined inProgress label in conventions', () => {
      const customConventions: GitHubConventions = {
        labels: {
          type: defaultConventions.labels.type,
          priority: defaultConventions.labels.priority,
          status: {
            inProgress: undefined,
          },
        },
        dependencies: defaultConventions.dependencies,
        epics: defaultConventions.epics,
      }

      const result = mapLabels(['bug', 'status:in-progress'], 'open', customConventions)
      expect(result.status).toBe('open') // Should not match any label
      expect(result.remainingLabels).toContain('status:in-progress')
    })

    it('should handle labels array with empty strings', () => {
      const result = mapLabels(['', 'bug', '', 'P1'], 'open', defaultConventions)
      expect(result.type).toBe('bug')
      expect(result.priority).toBe(1)
    })

    it('should handle very large label arrays efficiently', () => {
      const largeLabels = ['custom-1', 'custom-2', ...Array(100).fill('tag'), 'bug', 'P0']
      const result = mapLabels(largeLabels, 'open', defaultConventions)
      expect(result.type).toBe('bug')
      expect(result.priority).toBe(0)
      expect(result.remainingLabels.length).toBeGreaterThan(100)
    })
  })
})
