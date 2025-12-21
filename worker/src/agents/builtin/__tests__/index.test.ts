import { describe, it, expect } from 'vitest'
import { builtinAgents, getBuiltinAgent, getBuiltinAgentIds } from '../index'

describe('builtin agents', () => {
  it('should have exactly 5 agents', () => {
    expect(builtinAgents).toHaveLength(5)
  })

  it('should have correct agent IDs', () => {
    const ids = getBuiltinAgentIds()
    expect(ids).toEqual(['priya', 'reed', 'benny', 'dana', 'fiona'])
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
    expect(getBuiltinAgent('dana')?.tier).toBe('worker')
    expect(getBuiltinAgent('fiona')?.tier).toBe('sandbox')
  })

  it('should have correct frameworks', () => {
    expect(getBuiltinAgent('priya')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('reed')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('benny')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('dana')?.framework).toBe('ai-sdk')
    expect(getBuiltinAgent('fiona')?.framework).toBe('claude-code')
  })

  it('should have correct models', () => {
    expect(getBuiltinAgent('priya')?.model).toBe('fast')
    expect(getBuiltinAgent('reed')?.model).toBe('fast')
    expect(getBuiltinAgent('benny')?.model).toBe('overall')
    expect(getBuiltinAgent('dana')?.model).toBe('overall')
    expect(getBuiltinAgent('fiona')?.model).toBe('best')
  })
})
