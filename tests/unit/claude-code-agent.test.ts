/**
 * Unit Tests: Claude Code Agent
 *
 * TDD RED PHASE: Tests for ClaudeCodeAgent.do() behavior.
 * These tests verify the agent properly delegates to sandbox infrastructure.
 *
 * The ClaudeCodeAgent should:
 * 1. NOT return a placeholder message
 * 2. Use sandbox to execute tasks
 * 3. Return actual results from sandbox execution
 * 4. Emit proper events during execution
 */

import { describe, test, expect, vi } from 'vitest'

// Import the agent implementation
import { ClaudeCodeAgent } from '../../worker/src/agents/impl/claude-code'
import type { AgentDef, DoOptions, AgentEvent } from '../../worker/src/agents/base'

// Mock agent definition for testing
const mockAgentDef: AgentDef = {
  id: 'claude-code-test',
  name: 'Claude Code Test Agent',
  description: 'Test agent for TDD',
  tools: ['read', 'write', 'bash'],
  tier: 'sandbox',
  model: 'best',
  framework: 'claude-code',
}

describe('ClaudeCodeAgent', () => {
  describe('constructor', () => {
    test('creates agent with definition', () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      expect(agent.def).toBe(mockAgentDef)
      expect(agent.def.tier).toBe('sandbox')
      expect(agent.def.framework).toBe('claude-code')
    })
  })

  describe('do()', () => {
    test('does NOT return placeholder message', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const result = await agent.do('Test task', {})

      // These are the key assertions - the current placeholder implementation
      // returns these strings which should NOT be present after implementation
      expect(result.output).not.toContain('Claude Code Sandbox Agent (Placeholder)')
      expect(result.output).not.toContain('Implementation pending')
      expect(result.output).not.toContain('not yet implemented')

      // The result should indicate success when properly implemented
      // (This will fail initially, confirming we're in RED phase)
      expect(result.success).toBe(true)
    })

    test('returns success=true for valid sandbox execution', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const result = await agent.do('echo "hello"', {})

      // Success should be true when sandbox execution works
      expect(result.success).toBe(true)
    })

    test('emits thinking event before execution', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const events: AgentEvent[] = []
      const options: DoOptions = {
        onEvent: (e) => events.push(e),
      }

      await agent.do('Test task', options)

      // Should have a thinking event
      const thinkingEvents = events.filter(e => e.type === 'thinking')
      expect(thinkingEvents.length).toBeGreaterThan(0)
    })

    test('emits done event after execution', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const events: AgentEvent[] = []
      const options: DoOptions = {
        onEvent: (e) => events.push(e),
      }

      await agent.do('Test task', options)

      // Should have a done event
      const doneEvents = events.filter(e => e.type === 'done')
      expect(doneEvents.length).toBe(1)
    })

    test('returns artifacts for sandbox execution', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const result = await agent.do('Create a test file', {})

      // After proper implementation, artifacts should be present
      // for tasks that create/modify files
      expect(result.artifacts).toBeDefined()
      expect(Array.isArray(result.artifacts)).toBe(true)
    })

    test('includes events history in result', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const result = await agent.do('Test task', {})

      expect(result.events).toBeDefined()
      expect(Array.isArray(result.events)).toBe(true)
      expect(result.events.length).toBeGreaterThan(0)
    })

    test('output contains meaningful content after execution', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const result = await agent.do('List files', {})

      // Output should contain actual results, not placeholder text
      expect(result.output.length).toBeGreaterThan(0)
      expect(result.output).not.toContain('For simple tasks, consider using')
    })
  })

  describe('ask()', () => {
    test('returns recommendation to use lighter agent', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const result = await agent.ask('What is TypeScript?', {})

      // ask() should recommend lighter agents
      expect(result.answer).toContain('sandbox')
      expect(result.confidence).toBeGreaterThan(0)
    })

    test('emits message event', async () => {
      const agent = new ClaudeCodeAgent(mockAgentDef)
      const events: AgentEvent[] = []
      const options = {
        onEvent: (e: AgentEvent) => events.push(e),
      }

      await agent.ask('What is TypeScript?', options)

      const messageEvents = events.filter(e => e.type === 'message')
      expect(messageEvents.length).toBeGreaterThan(0)
    })
  })
})
