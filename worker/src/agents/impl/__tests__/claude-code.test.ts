import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeCodeAgent } from '../claude-code'
import { AgentDef } from '../../base'

describe('ClaudeCodeAgent', () => {
  const testDef: AgentDef = {
    id: 'test-claude-code',
    name: 'Test Claude Code Agent',
    description: 'Test sandbox agent',
    tools: ['*'],
    tier: 'sandbox',
    model: 'best',
    framework: 'claude-code',
    instructions: 'Test instructions',
  }

  it('should create an instance', () => {
    const agent = new ClaudeCodeAgent(testDef)
    expect(agent).toBeDefined()
    expect(agent.def).toEqual(testDef)
  })

  it('should have do method', () => {
    const agent = new ClaudeCodeAgent(testDef)
    expect(typeof agent.do).toBe('function')
  })

  it('should have ask method', () => {
    const agent = new ClaudeCodeAgent(testDef)
    expect(typeof agent.ask).toBe('function')
  })

  // TDD RED: These tests expect real sandbox execution, NOT placeholder
  describe('do() sandbox execution', () => {
    it('should NOT return placeholder message', async () => {
      const agent = new ClaudeCodeAgent(testDef)
      const result = await agent.do('echo "hello"')

      // The placeholder strings should NOT be present
      expect(result.output).not.toContain('Claude Code Sandbox Agent (Placeholder)')
      expect(result.output).not.toContain('Implementation pending')
      expect(result.output).not.toContain('not yet implemented')
    })

    it('should return success=true for valid tasks', async () => {
      const agent = new ClaudeCodeAgent(testDef)
      const result = await agent.do('echo "hello"')

      // Real execution should succeed
      expect(result.success).toBe(true)
    })

    it('should include meaningful output', async () => {
      const agent = new ClaudeCodeAgent(testDef)
      const result = await agent.do('List files in the current directory')

      expect(result.output.length).toBeGreaterThan(0)
      expect(result.output).not.toContain('For simple tasks, consider using')
    })

    it('should include artifacts for file operations', async () => {
      const agent = new ClaudeCodeAgent(testDef)
      const result = await agent.do('Create a test file')

      expect(result.artifacts).toBeDefined()
      expect(Array.isArray(result.artifacts)).toBe(true)
    })
  })

  it('should emit events during do()', async () => {
    const agent = new ClaudeCodeAgent(testDef)
    const events: any[] = []

    await agent.do('test task', {
      onEvent: (event) => events.push(event),
    })

    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe('thinking')
  })

  it('should return suggestion for ask()', async () => {
    const agent = new ClaudeCodeAgent(testDef)
    const result = await agent.ask('test question')

    expect(result).toBeDefined()
    expect(result.answer).toContain('Claude Code sandbox')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('should emit event during ask()', async () => {
    const agent = new ClaudeCodeAgent(testDef)
    const events: any[] = []

    await agent.ask('test question', {
      onEvent: (event) => events.push(event),
    })

    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe('message')
  })

  it('should include events array in result', async () => {
    const agent = new ClaudeCodeAgent(testDef)
    const result = await agent.do('test task')

    expect(result.events).toBeDefined()
    expect(Array.isArray(result.events)).toBe(true)
    expect(result.events.length).toBeGreaterThan(0)
  })
})
