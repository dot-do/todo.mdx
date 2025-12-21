import { describe, it, expect } from 'vitest'
import { OpenAiAgentsAgent } from '../openai-agents'
import { AgentDef } from '../../base'

describe('OpenAiAgentsAgent', () => {
  const testDef: AgentDef = {
    id: 'test-openai-agent',
    name: 'Test OpenAI Agent',
    description: 'Test agent using OpenAI API',
    tools: ['*'],
    tier: 'worker',
    model: 'overall',
    framework: 'openai-agents',
    instructions: 'You are a helpful assistant.',
  }

  it('should create an instance', () => {
    const agent = new OpenAiAgentsAgent(testDef)
    expect(agent).toBeDefined()
    expect(agent.def).toEqual(testDef)
  })

  it('should have do method', () => {
    const agent = new OpenAiAgentsAgent(testDef)
    expect(typeof agent.do).toBe('function')
  })

  it('should have ask method', () => {
    const agent = new OpenAiAgentsAgent(testDef)
    expect(typeof agent.ask).toBe('function')
  })

  it('should throw error when OPENAI_API_KEY is not set', async () => {
    const agent = new OpenAiAgentsAgent(testDef)

    // Clear any existing env vars
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    ;(globalThis as any).OPENAI_API_KEY = undefined

    const result = await agent.do('test task')

    expect(result.success).toBe(false)
    expect(result.output).toContain('OPENAI_API_KEY')

    // Restore
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey
    }
  })

  it('should emit error event when API key is missing', async () => {
    const agent = new OpenAiAgentsAgent(testDef)
    const events: any[] = []

    // Clear any existing env vars
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    ;(globalThis as any).OPENAI_API_KEY = undefined

    await agent.do('test task', {
      onEvent: (event) => events.push(event),
    })

    expect(events.length).toBeGreaterThan(0)
    expect(events[events.length - 1].type).toBe('error')

    // Restore
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey
    }
  })

  it('should map preset models correctly', () => {
    // Test different model presets
    const presets = ['best', 'fast', 'cheap', 'overall']

    for (const preset of presets) {
      const def = { ...testDef, model: preset }
      const agent = new OpenAiAgentsAgent(def)
      expect(agent.def.model).toBe(preset)
    }
  })

  it('should use custom model when specified', () => {
    const def = { ...testDef, model: 'gpt-4-turbo' }
    const agent = new OpenAiAgentsAgent(def)
    expect(agent.def.model).toBe('gpt-4-turbo')
  })

  it('should handle ask method correctly', async () => {
    const agent = new OpenAiAgentsAgent(testDef)

    // Clear any existing env vars
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    ;(globalThis as any).OPENAI_API_KEY = undefined

    const result = await agent.ask('test question')

    // Should return error since no API key
    expect(result.answer).toContain('OPENAI_API_KEY')
    expect(result.confidence).toBe(0.0)

    // Restore
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey
    }
  })
})
