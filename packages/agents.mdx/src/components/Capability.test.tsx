import { describe, it, expect } from 'vitest'
import { Capability } from './Capability'
import type { CapabilityConfig } from '../types'

describe('Capability component', () => {
  it('creates capability config with name only', () => {
    const config = Capability({ name: 'git' })

    expect(config.name).toBe('git')
    expect(config.operations).toBeUndefined()
    expect(config.description).toBeUndefined()
  })

  it('creates capability with specific operations', () => {
    const config = Capability({
      name: 'git',
      operations: ['commit', 'push', 'pull'],
    })

    expect(config.name).toBe('git')
    expect(config.operations).toEqual(['commit', 'push', 'pull'])
  })

  it('supports wildcard operations', () => {
    const config = Capability({
      name: 'github',
      operations: ['*'],
    })

    expect(config.operations).toEqual(['*'])
  })

  it('accepts description', () => {
    const config = Capability({
      name: 'claude',
      description: 'AI-powered code generation and research',
    })

    expect(config.description).toBe('AI-powered code generation and research')
  })

  it('accepts constraints', () => {
    const config = Capability({
      name: 'github',
      operations: ['pr', 'issues'],
      constraints: {
        rateLimit: 100,
        requireApproval: true,
      },
    })

    expect(config.constraints).toEqual({
      rateLimit: 100,
      requireApproval: true,
    })
  })

  it('creates complete capability config', () => {
    const config = Capability({
      name: 'git',
      operations: ['commit', 'push', 'branch'],
      description: 'Git version control operations',
      constraints: {
        maxCommitsPerHour: 10,
        requireReview: false,
      },
    })

    expect(config).toEqual({
      name: 'git',
      operations: ['commit', 'push', 'branch'],
      description: 'Git version control operations',
      constraints: {
        maxCommitsPerHour: 10,
        requireReview: false,
      },
    })
  })

  it('handles various capability names', () => {
    const capabilities = [
      Capability({ name: 'git' }),
      Capability({ name: 'github' }),
      Capability({ name: 'claude' }),
      Capability({ name: 'linear' }),
      Capability({ name: 'slack' }),
      Capability({ name: 'filesystem' }),
      Capability({ name: 'bash' }),
    ]

    expect(capabilities).toHaveLength(7)
    expect(capabilities.map(c => c.name)).toEqual([
      'git',
      'github',
      'claude',
      'linear',
      'slack',
      'filesystem',
      'bash',
    ])
  })

  it('handles read-only capabilities', () => {
    const config = Capability({
      name: 'filesystem',
      operations: ['read'],
      description: 'Read-only file system access',
    })

    expect(config.operations).toEqual(['read'])
  })

  it('handles write-restricted capabilities', () => {
    const config = Capability({
      name: 'database',
      operations: ['read', 'write'],
      constraints: {
        tablesAllowed: ['issues', 'todos'],
        deleteDisabled: true,
      },
    })

    expect(config.operations).toEqual(['read', 'write'])
    expect(config.constraints?.tablesAllowed).toEqual(['issues', 'todos'])
    expect(config.constraints?.deleteDisabled).toBe(true)
  })

  it('supports empty operations array', () => {
    const config = Capability({
      name: 'disabled',
      operations: [],
    })

    expect(config.operations).toEqual([])
  })
})
