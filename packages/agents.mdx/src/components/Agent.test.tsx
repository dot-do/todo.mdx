import { describe, it, expect } from 'vitest'
import { Agent } from './Agent'
import type { AgentConfig } from '../types'

describe('Agent component', () => {
  it('creates agent config with basic properties', () => {
    const config = Agent({
      name: 'cody',
      autonomy: 'full',
    })

    expect(config.name).toBe('cody')
    expect(config.autonomy).toBe('full')
    expect(config.capabilities).toBeUndefined()
    expect(config.focus).toBeUndefined()
  })

  it('accepts capabilities array', () => {
    const config = Agent({
      name: 'developer',
      capabilities: [
        { name: 'git', operations: ['commit', 'push'] },
        { name: 'github', operations: ['*'] },
      ],
    })

    expect(config.capabilities).toHaveLength(2)
    expect(config.capabilities?.[0].name).toBe('git')
    expect(config.capabilities?.[0].operations).toEqual(['commit', 'push'])
    expect(config.capabilities?.[1].name).toBe('github')
    expect(config.capabilities?.[1].operations).toEqual(['*'])
  })

  it('accepts focus areas', () => {
    const config = Agent({
      name: 'specialist',
      focus: ['backend', 'api', 'database'],
    })

    expect(config.focus).toEqual(['backend', 'api', 'database'])
  })

  it('supports supervised autonomy', () => {
    const config = Agent({
      name: 'assistant',
      autonomy: 'supervised',
    })

    expect(config.autonomy).toBe('supervised')
  })

  it('supports manual autonomy', () => {
    const config = Agent({
      name: 'helper',
      autonomy: 'manual',
    })

    expect(config.autonomy).toBe('manual')
  })

  it('accepts description', () => {
    const config = Agent({
      name: 'cody',
      description: 'AI coding assistant',
    })

    expect(config.description).toBe('AI coding assistant')
  })

  it('supports extending pre-built agents', () => {
    const config = Agent({
      name: 'custom-cody',
      extends: 'cloud:cody',
      autonomy: 'supervised',
    })

    expect(config.extends).toBe('cloud:cody')
    expect(config.name).toBe('custom-cody')
  })

  it('accepts model configuration', () => {
    const config = Agent({
      name: 'researcher',
      model: 'opus',
    })

    expect(config.model).toBe('opus')
  })

  it('accepts custom instructions', () => {
    const instructions = 'You are a specialist in TypeScript and testing.'
    const config = Agent({
      name: 'tester',
      instructions,
    })

    expect(config.instructions).toBe(instructions)
  })

  it('accepts triggers', () => {
    const config = Agent({
      name: 'auto-dev',
      triggers: [
        { event: 'issue.ready', condition: 'priority >= 3' },
        { event: 'schedule', cron: '0 9 * * *' },
      ],
    })

    expect(config.triggers).toHaveLength(2)
    expect(config.triggers?.[0].event).toBe('issue.ready')
    expect(config.triggers?.[0].condition).toBe('priority >= 3')
    expect(config.triggers?.[1].event).toBe('schedule')
    expect(config.triggers?.[1].cron).toBe('0 9 * * *')
  })

  it('creates complete agent config', () => {
    const config = Agent({
      name: 'full-stack-dev',
      description: 'Full-stack development agent',
      autonomy: 'full',
      model: 'sonnet',
      capabilities: [
        { name: 'git', operations: ['*'] },
        { name: 'github', operations: ['pr', 'issues'] },
        { name: 'claude', operations: ['do', 'research'] },
      ],
      focus: ['typescript', 'react', 'nodejs'],
      triggers: [
        { event: 'issue.ready' },
      ],
      instructions: 'Expert TypeScript developer focusing on clean code.',
    })

    expect(config).toEqual({
      name: 'full-stack-dev',
      description: 'Full-stack development agent',
      autonomy: 'full',
      model: 'sonnet',
      capabilities: [
        { name: 'git', operations: ['*'] },
        { name: 'github', operations: ['pr', 'issues'] },
        { name: 'claude', operations: ['do', 'research'] },
      ],
      focus: ['typescript', 'react', 'nodejs'],
      triggers: [
        { event: 'issue.ready' },
      ],
      instructions: 'Expert TypeScript developer focusing on clean code.',
    })
  })

  it('validates autonomy values at runtime', () => {
    const validConfig = Agent({
      name: 'test',
      autonomy: 'full',
    })
    expect(validConfig.autonomy).toBe('full')

    const validSupervised = Agent({
      name: 'test',
      autonomy: 'supervised',
    })
    expect(validSupervised.autonomy).toBe('supervised')

    const validManual = Agent({
      name: 'test',
      autonomy: 'manual',
    })
    expect(validManual.autonomy).toBe('manual')
  })

  it('validates model values at runtime', () => {
    const opus = Agent({ name: 'test', model: 'opus' })
    expect(opus.model).toBe('opus')

    const sonnet = Agent({ name: 'test', model: 'sonnet' })
    expect(sonnet.model).toBe('sonnet')

    const haiku = Agent({ name: 'test', model: 'haiku' })
    expect(haiku.model).toBe('haiku')
  })
})
