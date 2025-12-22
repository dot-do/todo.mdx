import { describe, it, expect } from 'vitest'
import { builtinAgents, getBuiltinAgent, getBuiltinAgentIds } from '../index'

describe('builtin agents', () => {
  it('should have exactly 10 agents', () => {
    expect(builtinAgents).toHaveLength(10)
  })

  it('should have correct agent IDs', () => {
    const ids = getBuiltinAgentIds()
    expect(ids).toEqual(['priya', 'reed', 'benny', 'cody', 'dana', 'dana-docs', 'tom', 'sam', 'quinn', 'fiona'])
  })

  it('should find agent by id', () => {
    const priya = getBuiltinAgent('priya')
    expect(priya).toBeDefined()
    expect(priya?.name).toBe('Product Priya')
    expect(priya?.tier).toBe('light')
    expect(priya?.model).toBe('fast')
  })

  it('should return undefined for unknown agent', () => {
    const unknown = getBuiltinAgent('unknown')
    expect(unknown).toBeUndefined()
  })

  it('should have all required fields', () => {
    builtinAgents.forEach(agent => {
      expect(agent.id).toBeTruthy()
      expect(agent.name).toBeTruthy()
      expect(agent.description).toBeTruthy()
      expect(agent.tools).toBeInstanceOf(Array)
      expect(agent.tools.length).toBeGreaterThan(0)
      expect(['light', 'worker', 'sandbox']).toContain(agent.tier)
      expect(agent.model).toBeTruthy()
      expect(['ai-sdk', 'claude-agent-sdk', 'openai-agents', 'claude-code']).toContain(agent.framework)
      expect(agent.instructions).toBeTruthy()
    })
  })

  it('should have correct tiers', () => {
    expect(getBuiltinAgent('priya')?.tier).toBe('light')
    expect(getBuiltinAgent('reed')?.tier).toBe('light')
    expect(getBuiltinAgent('benny')?.tier).toBe('light')
    expect(getBuiltinAgent('cody')?.tier).toBe('worker')
    expect(getBuiltinAgent('dana')?.tier).toBe('worker')
    expect(getBuiltinAgent('dana-docs')?.tier).toBe('light')
    expect(getBuiltinAgent('tom')?.tier).toBe('worker')
    expect(getBuiltinAgent('sam')?.tier).toBe('worker')
    expect(getBuiltinAgent('quinn')?.tier).toBe('worker')
    expect(getBuiltinAgent('fiona')?.tier).toBe('sandbox')
  })

  it('should have correct frameworks', () => {
    expect(getBuiltinAgent('priya')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('reed')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('benny')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('cody')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('dana')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('dana-docs')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('tom')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('sam')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('quinn')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('fiona')?.framework).toBe('claude-code')
  })

  it('should have correct models', () => {
    expect(getBuiltinAgent('priya')?.model).toBe('fast')
    expect(getBuiltinAgent('reed')?.model).toBe('fast')
    expect(getBuiltinAgent('benny')?.model).toBe('overall')
    expect(getBuiltinAgent('cody')?.model).toBe('claude-sonnet-4-5')
    expect(getBuiltinAgent('dana')?.model).toBe('overall')
    expect(getBuiltinAgent('dana-docs')?.model).toBe('claude-haiku-3-5')
    expect(getBuiltinAgent('tom')?.model).toBe('claude-sonnet-4-5')
    expect(getBuiltinAgent('sam')?.model).toBe('claude-sonnet-4-5')
    expect(getBuiltinAgent('quinn')?.model).toBe('claude-sonnet-4-5')
    expect(getBuiltinAgent('fiona')?.model).toBe('best')
  })

  describe('Coder Cody', () => {
    const cody = getBuiltinAgent('cody')

    it('should have all required integrations', () => {
      expect(cody).toBeDefined()
      expect(cody?.tools).toContain('github.*')
      expect(cody?.tools).toContain('linear.*')
      expect(cody?.tools).toContain('slack.*')
    })

    it('should have access to all source file operations', () => {
      expect(cody?.tools).toContain('file.*')
      expect(cody?.tools).toContain('code.*')
      expect(cody?.tools).toContain('git.*')
    })

    it('should use claude-sonnet model', () => {
      expect(cody?.model).toBe('claude-sonnet-4-5')
    })

    it('should have instructions covering autonomy levels', () => {
      expect(cody?.instructions).toContain('Full')
      expect(cody?.instructions).toContain('Assisted')
      expect(cody?.instructions).toContain('Supervised')
    })

    it('should have coding best practices in instructions', () => {
      expect(cody?.instructions).toContain('clean')
      expect(cody?.instructions).toContain('test')
      expect(cody?.instructions).toContain('TypeScript strict mode')
      expect(cody?.instructions).toContain('conventional commits')
    })
  })

  describe('Docs Dana', () => {
    const dana = getBuiltinAgent('dana-docs')

    it('should be defined with correct name', () => {
      expect(dana).toBeDefined()
      expect(dana?.name).toBe('Docs Dana')
    })

    it('should have github, file, and git capabilities', () => {
      expect(dana?.tools).toContain('github.*')
      expect(dana?.tools).toContain('file.*')
      expect(dana?.tools).toContain('git.*')
    })

    it('should be light tier', () => {
      expect(dana?.tier).toBe('light')
    })

    it('should use claude-haiku-3-5 model', () => {
      expect(dana?.model).toBe('claude-haiku-3-5')
    })

    it('should use ai-sdk framework', () => {
      expect(dana?.framework).toBe('ai-sdk')
    })

    it('should have documentation-specific instructions', () => {
      expect(dana?.instructions).toContain('documentation')
      expect(dana?.instructions).toContain('technical writing')
    })

    it('should cover API documentation', () => {
      expect(dana?.instructions).toContain('API')
    })

    it('should cover README best practices', () => {
      expect(dana?.instructions).toContain('README')
    })

    it('should cover code examples', () => {
      expect(dana?.instructions).toContain('code examples')
    })

    it('should cover Markdown formatting', () => {
      expect(dana?.instructions).toContain('Markdown')
    })

    it('should emphasize keeping docs in sync with code', () => {
      expect(dana?.instructions).toContain('sync')
    })

    it('should be user-focused', () => {
      expect(dana?.instructions).toContain('user')
    })

    it('should cover changelog and release notes', () => {
      expect(dana?.instructions).toContain('changelog')
      expect(dana?.instructions).toContain('release notes')
    })
  })
})
