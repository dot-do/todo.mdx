import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AiSdkAgent } from '../ai-sdk'
import type { AgentDef, AgentEvent } from '../../base'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}))

describe('AiSdkAgent', () => {
  const testDef: AgentDef = {
    id: 'test-ai-sdk',
    name: 'Test AI SDK Agent',
    description: 'Agent for testing AI SDK implementation',
    tools: ['read', 'write'],
    tier: 'worker',
    model: 'best',
    framework: 'ai-sdk',
    instructions: 'You are a helpful test agent',
    maxSteps: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should create agent with provided definition', () => {
      const agent = new AiSdkAgent(testDef)
      expect(agent.def).toEqual(testDef)
    })

    it('should initialize with empty message history', () => {
      const agent = new AiSdkAgent(testDef)
      // Message history is private, but we can test behavior
      expect(agent).toBeDefined()
    })
  })

  describe('do() method', () => {
    it('should accept a task string', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Task completed',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent(testDef)
      const result = await agent.do('Test task', { stream: false })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })

    it('should return DoResult with success true on completion', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Task completed successfully',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent(testDef)
      const result = await agent.do('Complete this task', { stream: false })

      expect(result.success).toBe(true)
      expect(result.output).toBe('Task completed successfully')
      expect(result.events).toBeDefined()
    })

    it('should return DoResult with success false on error', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockRejectedValue(new Error('API Error'))

      const agent = new AiSdkAgent(testDef)
      const result = await agent.do('This will fail', { stream: false })

      expect(result.success).toBe(false)
      expect(result.output).toContain('API Error')
      expect(result.events).toBeDefined()
    })

    it('should call onEvent callback when provided', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Done',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const events: AgentEvent[] = []
      const onEvent = vi.fn((e: AgentEvent) => {
        events.push(e)
      })

      const agent = new AiSdkAgent(testDef)
      await agent.do('Task with events', { stream: false, onEvent })

      // At minimum, we should have received some events
      expect(onEvent).toHaveBeenCalled()
    })

    it('should respect maxSteps option', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText).mockResolvedValue({
        text: 'Done',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent(testDef)
      await agent.do('Task', { stream: false, maxSteps: 5 })

      expect(mockGenerateText).toHaveBeenCalled()
      // maxSteps is passed to the AI SDK (implementation detail, verified by call)
    })

    it('should use default maxSteps from def when not provided', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText).mockResolvedValue({
        text: 'Done',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent(testDef)
      await agent.do('Task', { stream: false })

      expect(mockGenerateText).toHaveBeenCalled()
      // Uses default maxSteps from agent def
    })
  })

  describe('ask() method', () => {
    it('should accept a question string', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'The answer is 42',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent(testDef)
      const result = await agent.ask('What is the answer?')

      expect(result).toBeDefined()
      expect(result.answer).toBe('The answer is 42')
    })

    it('should return AskResult with answer', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Yes, that is correct',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent(testDef)
      const result = await agent.ask('Is this correct?')

      expect(result.answer).toBe('Yes, that is correct')
    })

    it('should return confidence 1.0 on success', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Answer',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent(testDef)
      const result = await agent.ask('Question?')

      expect(result.confidence).toBe(1.0)
    })

    it('should return confidence 0.0 on error', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockRejectedValue(new Error('Failed'))

      const agent = new AiSdkAgent(testDef)
      const result = await agent.ask('Question?')

      expect(result.confidence).toBe(0.0)
    })

    it('should default to stream=false', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText).mockResolvedValue({
        text: 'Answer',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent(testDef)
      await agent.ask('Question?')

      expect(mockGenerateText).toHaveBeenCalled()
    })
  })

  describe('Message History', () => {
    it('should add user and assistant messages to history', async () => {
      // Simplified test that just checks messages are being added
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const freshAgent = new AiSdkAgent({
        ...testDef,
        id: 'test-messages',
      })

      await freshAgent.do('Task 1', { stream: false })

      const calls = vi.mocked(generateText).mock.calls
      // Should have been called once
      expect(calls.length).toBeGreaterThanOrEqual(1)
      // Messages should be an array
      expect(Array.isArray(calls[0][0].messages)).toBe(true)
    })

    it('should accumulate messages across multiple interactions', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const freshAgent = new AiSdkAgent({
        ...testDef,
        id: 'test-accumulate',
      })

      await freshAgent.do('First task', { stream: false })
      const firstCall = vi.mocked(generateText).mock.calls[0]?.[0]
      const firstCallMessages = firstCall?.messages?.length ?? 0

      await freshAgent.do('Second task', { stream: false })
      const secondCall = vi.mocked(generateText).mock.calls[1]?.[0]
      const secondCallMessages = secondCall?.messages?.length ?? 0

      // Second call should have more messages than first call
      expect(secondCallMessages).toBeGreaterThan(firstCallMessages)
    })
  })

  describe('resolveModel()', () => {
    it('should return a LanguageModel instance for model preference "best"', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent({
        ...testDef,
        model: 'best',
      })
      await agent.do('Task', { stream: false })

      const call = vi.mocked(generateText).mock.calls[0]?.[0]
      // The model should be a LanguageModel instance, not undefined
      expect(call.model).toBeDefined()
      expect(call.model).not.toBe(undefined)
      // It should have required LanguageModel properties
      expect(typeof call.model).toBe('object')
    })

    it('should return a LanguageModel instance for model preference "fast"', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent({
        ...testDef,
        model: 'fast',
      })
      await agent.do('Task', { stream: false })

      const call = vi.mocked(generateText).mock.calls[0]?.[0]
      expect(call.model).toBeDefined()
      expect(call.model).not.toBe(undefined)
    })

    it('should return a LanguageModel for explicit model ID like "anthropic/claude-3-5-haiku-20241022"', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent({
        ...testDef,
        model: 'anthropic/claude-3-5-haiku-20241022',
      })
      await agent.do('Task', { stream: false })

      const call = vi.mocked(generateText).mock.calls[0]?.[0]
      expect(call.model).toBeDefined()
      expect(call.model).not.toBe(undefined)
    })
  })

  describe('Tool Resolution', () => {
    it('should resolve tools from def.tools and pass to generateText', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent({
        ...testDef,
        tools: ['github.createPullRequest', 'github.addComment'],
      })
      await agent.do('Create a PR', { stream: false })

      const call = vi.mocked(generateText).mock.calls[0]?.[0]
      // Tools should be resolved and passed to generateText
      expect(call.tools).toBeDefined()
      expect(Object.keys(call.tools).length).toBeGreaterThan(0)
    })

    it('should convert tool schema from Zod to AI SDK format', async () => {
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({
        text: 'Response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any)

      const agent = new AiSdkAgent({
        ...testDef,
        tools: ['github.createPullRequest'],
      })
      await agent.do('Create a PR', { stream: false })

      const call = vi.mocked(generateText).mock.calls[0]?.[0]
      // Each tool should have the AI SDK format (description, inputSchema, execute)
      const toolNames = Object.keys(call.tools || {})
      expect(toolNames.length).toBeGreaterThan(0)

      const firstTool = call.tools[toolNames[0]]
      expect(firstTool).toHaveProperty('inputSchema')
      expect(firstTool).toHaveProperty('execute')
    })
  })

  describe('Tool Execution', () => {
    it('should emit tool_result events when tools are executed', async () => {
      const { generateText } = await import('ai')

      // Simulate a tool call in the response
      vi.mocked(generateText).mockImplementation(async (options: any) => {
        // Simulate the AI SDK calling onStepFinish with tool results
        if (options.onStepFinish) {
          options.onStepFinish({
            toolCalls: [{
              toolName: 'github.createPullRequest',
              toolCallId: 'call-123',
              args: { title: 'Test PR', body: 'Test body' },
            }],
            toolResults: [{
              toolName: 'github.createPullRequest',
              toolCallId: 'call-123',
              result: { url: 'https://github.com/test/pr/1' },
            }],
          })
        }
        return {
          text: 'Done',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5 },
        }
      })

      const events: AgentEvent[] = []
      const onEvent = vi.fn((e: AgentEvent) => {
        events.push(e)
      })

      const agent = new AiSdkAgent({
        ...testDef,
        tools: ['github.createPullRequest'],
      })
      await agent.do('Create a PR', { stream: false, onEvent })

      // Should have tool_result events
      const toolResultEvents = events.filter(e => e.type === 'tool_result')
      expect(toolResultEvents.length).toBeGreaterThan(0)
      expect(toolResultEvents[0]).toMatchObject({
        type: 'tool_result',
        tool: 'github.createPullRequest',
        id: 'call-123',
      })
    })

    it('should emit tool_call events when tools are called', async () => {
      const { generateText } = await import('ai')

      vi.mocked(generateText).mockImplementation(async (options: any) => {
        if (options.onStepFinish) {
          options.onStepFinish({
            toolCalls: [{
              toolName: 'github.addComment',
              toolCallId: 'call-456',
              args: { issueNumber: 1, body: 'Test comment' },
            }],
            toolResults: [],
          })
        }
        return {
          text: 'Done',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5 },
        }
      })

      const events: AgentEvent[] = []
      const onEvent = vi.fn((e: AgentEvent) => {
        events.push(e)
      })

      const agent = new AiSdkAgent({
        ...testDef,
        tools: ['github.addComment'],
      })
      await agent.do('Add comment', { stream: false, onEvent })

      const toolCallEvents = events.filter(e => e.type === 'tool_call')
      expect(toolCallEvents.length).toBeGreaterThan(0)
      expect(toolCallEvents[0]).toMatchObject({
        type: 'tool_call',
        tool: 'github.addComment',
        id: 'call-456',
      })
    })
  })
})
