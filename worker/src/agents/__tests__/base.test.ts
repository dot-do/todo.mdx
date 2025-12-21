import { describe, it, expect } from 'vitest'
import {
  Agent,
  type AgentDef,
  type DoOptions,
  type AskOptions,
  type DoResult,
  type AskResult,
  type Artifact,
  type Source,
  type AgentEvent,
} from '../base'

describe('Agent Base Types', () => {
  describe('AgentDef', () => {
    it('should accept valid agent definition with required fields', () => {
      const def: AgentDef = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        tools: ['tool1', 'tool2'],
        tier: 'worker',
        model: 'best',
        framework: 'ai-sdk',
      }

      expect(def.id).toBe('test-agent')
      expect(def.name).toBe('Test Agent')
      expect(def.tier).toBe('worker')
      expect(def.model).toBe('best')
      expect(def.framework).toBe('ai-sdk')
    })

    it('should accept agent definition with all optional fields', () => {
      const def: AgentDef = {
        id: 'full-agent',
        name: 'Full Agent',
        description: 'Agent with all fields',
        tools: ['read', 'write'],
        tier: 'sandbox',
        model: 'claude-3-5-sonnet-20241022',
        framework: 'claude-agent-sdk',
        instructions: 'You are a helpful agent',
        maxSteps: 50,
        timeout: 300000,
      }

      expect(def.instructions).toBe('You are a helpful agent')
      expect(def.maxSteps).toBe(50)
      expect(def.timeout).toBe(300000)
    })

    it('should accept all valid tier values', () => {
      const tiers: Array<AgentDef['tier']> = ['light', 'worker', 'sandbox']

      tiers.forEach((tier) => {
        const def: AgentDef = {
          id: `agent-${tier}`,
          name: 'Test',
          description: 'Test',
          tools: [],
          tier,
          model: 'best',
          framework: 'ai-sdk',
        }
        expect(def.tier).toBe(tier)
      })
    })

    it('should accept all valid model values', () => {
      const models: Array<AgentDef['model']> = [
        'best',
        'fast',
        'cheap',
        'overall',
        'claude-3-5-sonnet-20241022',
        'gpt-4o',
      ]

      models.forEach((model) => {
        const def: AgentDef = {
          id: 'agent',
          name: 'Test',
          description: 'Test',
          tools: [],
          tier: 'worker',
          model,
          framework: 'ai-sdk',
        }
        expect(def.model).toBe(model)
      })
    })

    it('should accept all valid framework values', () => {
      const frameworks: Array<AgentDef['framework']> = [
        'ai-sdk',
        'claude-agent-sdk',
        'openai-agents',
        'claude-code',
      ]

      frameworks.forEach((framework) => {
        const def: AgentDef = {
          id: 'agent',
          name: 'Test',
          description: 'Test',
          tools: [],
          tier: 'worker',
          model: 'best',
          framework,
        }
        expect(def.framework).toBe(framework)
      })
    })
  })

  describe('DoOptions', () => {
    it('should accept empty options object', () => {
      const opts: DoOptions = {}
      expect(opts).toEqual({})
    })

    it('should accept stream option', () => {
      const opts: DoOptions = { stream: true }
      expect(opts.stream).toBe(true)
    })

    it('should accept onEvent callback', () => {
      const callback = (e: AgentEvent) => {
        console.log(e)
      }
      const opts: DoOptions = { onEvent: callback }
      expect(opts.onEvent).toBe(callback)
    })

    it('should accept timeout and maxSteps', () => {
      const opts: DoOptions = {
        timeout: 60000,
        maxSteps: 25,
      }
      expect(opts.timeout).toBe(60000)
      expect(opts.maxSteps).toBe(25)
    })

    it('should accept all options together', () => {
      const callback = (e: AgentEvent) => {
        console.log(e)
      }
      const opts: DoOptions = {
        stream: false,
        onEvent: callback,
        timeout: 120000,
        maxSteps: 100,
      }
      expect(opts.stream).toBe(false)
      expect(opts.onEvent).toBe(callback)
      expect(opts.timeout).toBe(120000)
      expect(opts.maxSteps).toBe(100)
    })
  })

  describe('AskOptions', () => {
    it('should accept empty options object', () => {
      const opts: AskOptions = {}
      expect(opts).toEqual({})
    })

    it('should accept stream option', () => {
      const opts: AskOptions = { stream: true }
      expect(opts.stream).toBe(true)
    })

    it('should accept onEvent callback', () => {
      const callback = (e: AgentEvent) => {
        console.log(e)
      }
      const opts: AskOptions = { onEvent: callback }
      expect(opts.onEvent).toBe(callback)
    })

    it('should accept timeout', () => {
      const opts: AskOptions = { timeout: 30000 }
      expect(opts.timeout).toBe(30000)
    })
  })

  describe('DoResult', () => {
    it('should accept minimal successful result', () => {
      const result: DoResult = {
        success: true,
        output: 'Task completed',
        events: [],
      }
      expect(result.success).toBe(true)
      expect(result.output).toBe('Task completed')
      expect(result.events).toEqual([])
    })

    it('should accept result with artifacts', () => {
      const artifacts: Artifact[] = [
        { type: 'pr', ref: '#123', url: 'https://github.com/org/repo/pull/123' },
        { type: 'commit', ref: 'abc123' },
      ]
      const result: DoResult = {
        success: true,
        output: 'Created PR',
        artifacts,
        events: [],
      }
      expect(result.artifacts).toEqual(artifacts)
    })

    it('should accept failed result', () => {
      const result: DoResult = {
        success: false,
        output: 'Task failed: timeout',
        events: [{ type: 'error', error: 'Timeout after 60s' }],
      }
      expect(result.success).toBe(false)
      expect(result.output).toContain('failed')
    })
  })

  describe('AskResult', () => {
    it('should accept minimal answer', () => {
      const result: AskResult = {
        answer: 'The answer is 42',
      }
      expect(result.answer).toBe('The answer is 42')
    })

    it('should accept answer with sources', () => {
      const sources: Source[] = [
        {
          title: 'Documentation',
          url: 'https://example.com/docs',
          snippet: 'Relevant snippet',
        },
      ]
      const result: AskResult = {
        answer: 'Based on the docs...',
        sources,
      }
      expect(result.sources).toEqual(sources)
    })

    it('should accept answer with confidence', () => {
      const result: AskResult = {
        answer: 'Probably yes',
        confidence: 0.85,
      }
      expect(result.confidence).toBe(0.85)
    })

    it('should accept answer with all fields', () => {
      const result: AskResult = {
        answer: 'Complete answer',
        sources: [{ title: 'Source 1' }],
        confidence: 0.95,
      }
      expect(result.answer).toBe('Complete answer')
      expect(result.sources).toHaveLength(1)
      expect(result.confidence).toBe(0.95)
    })
  })

  describe('Artifact', () => {
    it('should accept PR artifact', () => {
      const artifact: Artifact = {
        type: 'pr',
        ref: '#456',
        url: 'https://github.com/org/repo/pull/456',
      }
      expect(artifact.type).toBe('pr')
      expect(artifact.ref).toBe('#456')
    })

    it('should accept commit artifact without URL', () => {
      const artifact: Artifact = {
        type: 'commit',
        ref: 'abc123def',
      }
      expect(artifact.type).toBe('commit')
      expect(artifact.url).toBeUndefined()
    })

    it('should accept all artifact types', () => {
      const types: Array<Artifact['type']> = ['pr', 'commit', 'file', 'branch']

      types.forEach((type) => {
        const artifact: Artifact = {
          type,
          ref: `ref-${type}`,
        }
        expect(artifact.type).toBe(type)
      })
    })
  })

  describe('Source', () => {
    it('should accept minimal source with just title', () => {
      const source: Source = {
        title: 'Untitled Source',
      }
      expect(source.title).toBe('Untitled Source')
    })

    it('should accept source with all fields', () => {
      const source: Source = {
        title: 'Full Source',
        url: 'https://example.com',
        snippet: 'This is a snippet from the source',
      }
      expect(source.title).toBe('Full Source')
      expect(source.url).toBe('https://example.com')
      expect(source.snippet).toBe('This is a snippet from the source')
    })
  })

  describe('AgentEvent', () => {
    it('should accept thinking event', () => {
      const event: AgentEvent = {
        type: 'thinking',
        content: 'Analyzing the problem...',
      }
      expect(event.type).toBe('thinking')
      if (event.type === 'thinking') {
        expect(event.content).toBe('Analyzing the problem...')
      }
    })

    it('should accept tool_call event', () => {
      const event: AgentEvent = {
        type: 'tool_call',
        tool: 'read_file',
        params: { path: '/test/file.ts' },
        id: 'call_123',
      }
      expect(event.type).toBe('tool_call')
      if (event.type === 'tool_call') {
        expect(event.tool).toBe('read_file')
        expect(event.id).toBe('call_123')
      }
    })

    it('should accept tool_result event', () => {
      const event: AgentEvent = {
        type: 'tool_result',
        tool: 'read_file',
        result: { content: 'file contents' },
        id: 'call_123',
      }
      expect(event.type).toBe('tool_result')
      if (event.type === 'tool_result') {
        expect(event.tool).toBe('read_file')
        expect(event.id).toBe('call_123')
      }
    })

    it('should accept message event', () => {
      const event: AgentEvent = {
        type: 'message',
        content: 'Processing request...',
      }
      expect(event.type).toBe('message')
      if (event.type === 'message') {
        expect(event.content).toBe('Processing request...')
      }
    })

    it('should accept error event', () => {
      const event: AgentEvent = {
        type: 'error',
        error: 'Failed to read file',
      }
      expect(event.type).toBe('error')
      if (event.type === 'error') {
        expect(event.error).toBe('Failed to read file')
      }
    })

    it('should accept done event with DoResult', () => {
      const result: DoResult = {
        success: true,
        output: 'Done',
        events: [],
      }
      const event: AgentEvent = {
        type: 'done',
        result,
      }
      expect(event.type).toBe('done')
      if (event.type === 'done') {
        expect(event.result).toEqual(result)
      }
    })

    it('should accept done event with AskResult', () => {
      const result: AskResult = {
        answer: 'The answer',
      }
      const event: AgentEvent = {
        type: 'done',
        result,
      }
      expect(event.type).toBe('done')
      if (event.type === 'done') {
        expect(event.result).toEqual(result)
      }
    })
  })

  describe('Agent Abstract Class', () => {
    // Concrete implementation for testing
    class TestAgent extends Agent {
      readonly def: AgentDef = {
        id: 'test',
        name: 'Test Agent',
        description: 'For testing',
        tools: [],
        tier: 'light',
        model: 'fast',
        framework: 'ai-sdk',
      }

      async do(task: string, options?: DoOptions): Promise<DoResult> {
        return {
          success: true,
          output: `Completed: ${task}`,
          events: options?.stream ? [{ type: 'message', content: 'Working...' }] : [],
        }
      }

      async ask(question: string, options?: AskOptions): Promise<AskResult> {
        return {
          answer: `Answer to: ${question}`,
          confidence: options?.timeout ? 0.9 : 0.8,
        }
      }
    }

    it('should allow concrete implementation', () => {
      const agent = new TestAgent()
      expect(agent.def.id).toBe('test')
      expect(agent.def.name).toBe('Test Agent')
    })

    it('should implement do method', async () => {
      const agent = new TestAgent()
      const result = await agent.do('test task')

      expect(result.success).toBe(true)
      expect(result.output).toContain('test task')
    })

    it('should implement ask method', async () => {
      const agent = new TestAgent()
      const result = await agent.ask('test question')

      expect(result.answer).toContain('test question')
      expect(result.confidence).toBeDefined()
    })

    it('should pass options to do method', async () => {
      const agent = new TestAgent()
      const result = await agent.do('task', { stream: true })

      expect(result.events.length).toBeGreaterThan(0)
    })

    it('should pass options to ask method', async () => {
      const agent = new TestAgent()
      const result = await agent.ask('question', { timeout: 30000 })

      expect(result.confidence).toBe(0.9)
    })
  })

  describe('Type Exports', () => {
    it('should export AgentDef type', () => {
      const def: AgentDef = {
        id: 'export-test',
        name: 'Export Test',
        description: 'Testing exports',
        tools: [],
        tier: 'worker',
        model: 'best',
        framework: 'ai-sdk',
      }
      expect(def).toBeDefined()
    })

    it('should export all option types', () => {
      const doOpts: DoOptions = { stream: true }
      const askOpts: AskOptions = { stream: false }
      expect(doOpts).toBeDefined()
      expect(askOpts).toBeDefined()
    })

    it('should export all result types', () => {
      const doResult: DoResult = { success: true, output: 'test', events: [] }
      const askResult: AskResult = { answer: 'test' }
      expect(doResult).toBeDefined()
      expect(askResult).toBeDefined()
    })

    it('should export artifact and source types', () => {
      const artifact: Artifact = { type: 'pr', ref: '#1' }
      const source: Source = { title: 'Test' }
      expect(artifact).toBeDefined()
      expect(source).toBeDefined()
    })

    it('should export event types', () => {
      const event: AgentEvent = { type: 'thinking', content: 'test' }
      expect(event).toBeDefined()
    })
  })
})
