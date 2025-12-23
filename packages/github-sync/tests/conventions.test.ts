import { describe, expect, it } from 'vitest'
import { defaultConventions, mergeConventions, type GitHubConventions } from '../src/conventions'

describe('defaultConventions', () => {
  it('should have type mappings for standard labels', () => {
    expect(defaultConventions.labels.type).toEqual({
      'bug': 'bug',
      'enhancement': 'feature',
      'task': 'task',
      'epic': 'epic',
      'chore': 'chore',
    })
  })

  it('should have priority mappings for P0-P4 labels', () => {
    expect(defaultConventions.labels.priority).toEqual({
      'P0': 0,
      'P1': 1,
      'P2': 2,
      'P3': 3,
      'P4': 4,
    })
  })

  it('should have status:in-progress as default in-progress label', () => {
    expect(defaultConventions.labels.status.inProgress).toBe('status:in-progress')
  })

  it('should have dependency pattern configuration', () => {
    expect(defaultConventions.dependencies.pattern).toMatch(/Depends on/)
    expect(defaultConventions.dependencies.separator).toBe(', ')
  })

  it('should have blocks pattern configuration', () => {
    expect(defaultConventions.dependencies.blocksPattern).toMatch(/Blocks/)
  })

  it('should have epic configuration', () => {
    expect(defaultConventions.epics.labelPrefix).toBe('epic:')
    expect(defaultConventions.epics.bodyPattern).toMatch(/Parent/)
  })
})

describe('mergeConventions', () => {
  it('should return defaults when custom is empty', () => {
    const result = mergeConventions({})
    expect(result).toEqual(defaultConventions)
  })

  it('should deep merge custom labels.type onto defaults', () => {
    const custom: Partial<GitHubConventions> = {
      labels: {
        type: {
          'custom-bug': 'bug',
        },
        priority: {},
        status: {},
      },
    }
    const result = mergeConventions(custom)

    expect(result.labels.type).toEqual({
      'bug': 'bug',
      'enhancement': 'feature',
      'task': 'task',
      'epic': 'epic',
      'chore': 'chore',
      'custom-bug': 'bug',
    })
  })

  it('should deep merge custom labels.priority onto defaults', () => {
    const custom: Partial<GitHubConventions> = {
      labels: {
        type: {},
        priority: {
          'critical': 0,
          'high': 1,
        },
        status: {},
      },
    }
    const result = mergeConventions(custom)

    expect(result.labels.priority).toEqual({
      'P0': 0,
      'P1': 1,
      'P2': 2,
      'P3': 3,
      'P4': 4,
      'critical': 0,
      'high': 1,
    })
  })

  it('should override status.inProgress when provided', () => {
    const custom: Partial<GitHubConventions> = {
      labels: {
        type: {},
        priority: {},
        status: {
          inProgress: 'in-progress',
        },
      },
    }
    const result = mergeConventions(custom)

    expect(result.labels.status.inProgress).toBe('in-progress')
  })

  it('should override dependency patterns when provided', () => {
    const custom: Partial<GitHubConventions> = {
      dependencies: {
        pattern: 'Requires:\\s*(.+)',
        separator: '; ',
      },
    }
    const result = mergeConventions(custom)

    expect(result.dependencies.pattern).toBe('Requires:\\s*(.+)')
    expect(result.dependencies.separator).toBe('; ')
  })

  it('should override epic configuration when provided', () => {
    const custom: Partial<GitHubConventions> = {
      epics: {
        labelPrefix: 'parent:',
        bodyPattern: 'Epic:\\s*#(\\d+)',
      },
    }
    const result = mergeConventions(custom)

    expect(result.epics.labelPrefix).toBe('parent:')
    expect(result.epics.bodyPattern).toBe('Epic:\\s*#(\\d+)')
  })

  it('should use provided defaults instead of defaultConventions', () => {
    const customDefaults: GitHubConventions = {
      labels: {
        type: { 'feature': 'feature' },
        priority: { 'P1': 1 },
        status: { inProgress: 'wip' },
      },
      dependencies: {
        pattern: 'Deps:\\s*(.+)',
        separator: ' ',
      },
      epics: {
        labelPrefix: 'e:',
        bodyPattern: 'E:\\s*#(\\d+)',
      },
    }

    const result = mergeConventions({}, customDefaults)
    expect(result).toEqual(customDefaults)
  })

  it('should preserve defaults for unspecified nested properties', () => {
    const custom: Partial<GitHubConventions> = {
      labels: {
        type: {},
        priority: {},
        status: {},
      },
    }
    const result = mergeConventions(custom)

    // Should keep all default type mappings
    expect(result.labels.type['bug']).toBe('bug')
    expect(result.labels.type['enhancement']).toBe('feature')

    // Should keep all default priority mappings
    expect(result.labels.priority['P0']).toBe(0)
    expect(result.labels.priority['P4']).toBe(4)
  })
})
