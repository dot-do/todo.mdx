import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeAgentSdkAgent } from '../claude-agent'
import type { AgentDef, AgentEvent } from '../../base'
import type { Tool, Connection } from '../../../tools/types'
import { z } from 'zod'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
      stream: vi.fn(),
    },
  })),
}))

describe('ClaudeAgentSdkAgent', () => {
  const testDef: AgentDef = {
    id: 'test-claude-agent',
    name: 'Test Claude Agent',
    description: 'Agent for testing Claude SDK implementation',
    tools: ['test.echo', 'test.add'],
    tier: 'worker',
    model: 'best',
    framework: 'claude-agent-sdk',
    instructions: 'You are a helpful test agent',
    maxSteps: 10,
  }

  // Create test tools
  const mockEchoTool: Tool = {
    name: 'echo',
    fullName: 'test.echo',
    schema: z.object({ message: z.string() }),
    execute: vi.fn().mockImplementation(async (params: { message: string }) => {
      return { echoed: params.message }
    }),
  }

  const mockAddTool: Tool = {
    name: 'add',
    fullName: 'test.add',
    schema: z.object({ a: z.number(), b: z.number() }),
    execute: vi.fn().mockImplementation(async (params: { a: number; b: number }) => {
      return { sum: params.a + params.b }
    }),
  }

  const mockFailingTool: Tool = {
    name: 'failing',
    fullName: 'test.failing',
    schema: z.object({ input: z.string() }),
    execute: vi.fn().mockImplementation(async () => {
      throw new Error('Tool execution failed')
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Set API key
    ;(globalThis as any).ANTHROPIC_API_KEY = 'test-api-key'
  })

  describe('Constructor', () => {
    it('should create agent with provided definition', () => {
      const agent = new ClaudeAgentSdkAgent(testDef)
      expect(agent.def).toEqual(testDef)
    })
  })

  describe('Tool Resolution', () => {
    it('should resolve tools from agent definition', async () => {
      const agent = new ClaudeAgentSdkAgent(testDef)

      // Set up tools on agent
      agent.setTools([mockEchoTool, mockAddTool])

      const resolvedTools = agent.getResolvedTools()

      expect(resolvedTools).toHaveLength(2)
      expect(resolvedTools.map(t => t.fullName)).toContain('test.echo')
      expect(resolvedTools.map(t => t.fullName)).toContain('test.add')
    })

    it('should convert tools to Anthropic format', async () => {
      const agent = new ClaudeAgentSdkAgent(testDef)
      agent.setTools([mockEchoTool])

      const anthropicTools = agent.getAnthropicTools()

      expect(anthropicTools).toHaveLength(1)
      expect(anthropicTools[0]).toEqual({
        name: 'test.echo',
        description: expect.any(String),
        input_schema: expect.objectContaining({
          type: 'object',
        }),
      })
    })
  })

  describe('Tool Execution', () => {
    it('should execute tool when tool_use block is received', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_call_123',
            name: 'test.echo',
            input: { message: 'hello' },
          },
        ],
        stop_reason: 'tool_use',
      })

      vi.mocked(Anthropic).mockImplementation(() => ({
        messages: { create: mockCreate, stream: vi.fn() },
      }) as any)

      const agent = new ClaudeAgentSdkAgent(testDef)
      agent.setTools([mockEchoTool])

      const events: AgentEvent[] = []
      await agent.do('Echo hello', { stream: false, onEvent: (e) => events.push(e) })

      // Tool should have been executed with the correct params
      // Connection is null and env is undefined when not set
      expect(mockEchoTool.execute).toHaveBeenCalledWith(
        { message: 'hello' },
        null,
        undefined
      )
    })

    it('should emit tool_result event after tool execution', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      // First call returns tool_use, second call returns text
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool_call_123',
              name: 'test.echo',
              input: { message: 'hello' },
            },
          ],
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Done!' }],
          stop_reason: 'end_turn',
        })

      vi.mocked(Anthropic).mockImplementation(() => ({
        messages: { create: mockCreate, stream: vi.fn() },
      }) as any)

      const agent = new ClaudeAgentSdkAgent(testDef)
      agent.setTools([mockEchoTool])

      const events: AgentEvent[] = []
      await agent.do('Echo hello', { stream: false, onEvent: (e) => events.push(e) })

      const toolResultEvent = events.find(e => e.type === 'tool_result')
      expect(toolResultEvent).toBeDefined()
      expect(toolResultEvent).toEqual({
        type: 'tool_result',
        tool: 'test.echo',
        result: { echoed: 'hello' },
        id: 'tool_call_123',
      })
    })

    it('should continue conversation with tool result', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool_call_123',
              name: 'test.add',
              input: { a: 2, b: 3 },
            },
          ],
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'The sum is 5' }],
          stop_reason: 'end_turn',
        })

      vi.mocked(Anthropic).mockImplementation(() => ({
        messages: { create: mockCreate, stream: vi.fn() },
      }) as any)

      const agent = new ClaudeAgentSdkAgent(testDef)
      agent.setTools([mockAddTool])

      const result = await agent.do('Add 2 and 3', { stream: false })

      // Second call should include tool_result in messages
      expect(mockCreate).toHaveBeenCalledTimes(2)
      const secondCallMessages = mockCreate.mock.calls[1][0].messages

      // Should have user message, assistant with tool_use, and user with tool_result
      const toolResultMessage = secondCallMessages.find(
        (m: any) => m.role === 'user' &&
        m.content?.some?.((c: any) => c.type === 'tool_result')
      )
      expect(toolResultMessage).toBeDefined()
      expect(toolResultMessage.content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tool_call_123',
        content: JSON.stringify({ sum: 5 }),
      })
    })

    it('should handle multiple tool calls in sequence', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool_call_1',
              name: 'test.add',
              input: { a: 1, b: 2 },
            },
          ],
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool_call_2',
              name: 'test.add',
              input: { a: 3, b: 4 },
            },
          ],
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'First sum: 3, Second sum: 7' }],
          stop_reason: 'end_turn',
        })

      vi.mocked(Anthropic).mockImplementation(() => ({
        messages: { create: mockCreate, stream: vi.fn() },
      }) as any)

      const agent = new ClaudeAgentSdkAgent(testDef)
      agent.setTools([mockAddTool])

      const events: AgentEvent[] = []
      await agent.do('Add 1+2 then 3+4', { stream: false, onEvent: (e) => events.push(e) })

      // Should have two tool_result events
      const toolResultEvents = events.filter(e => e.type === 'tool_result')
      expect(toolResultEvents).toHaveLength(2)
      expect(mockAddTool.execute).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('should emit error event when tool execution fails', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool_call_fail',
              name: 'test.failing',
              input: { input: 'test' },
            },
          ],
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Tool failed' }],
          stop_reason: 'end_turn',
        })

      vi.mocked(Anthropic).mockImplementation(() => ({
        messages: { create: mockCreate, stream: vi.fn() },
      }) as any)

      const defWithFailingTool: AgentDef = {
        ...testDef,
        tools: ['test.failing'],
      }
      const agent = new ClaudeAgentSdkAgent(defWithFailingTool)
      agent.setTools([mockFailingTool])

      const events: AgentEvent[] = []
      await agent.do('Run failing tool', { stream: false, onEvent: (e) => events.push(e) })

      // Should have tool_result with error
      const toolResultEvent = events.find(e => e.type === 'tool_result')
      expect(toolResultEvent).toBeDefined()
      if (toolResultEvent?.type === 'tool_result') {
        expect(toolResultEvent.result).toEqual({
          error: 'Tool execution failed',
        })
      }
    })

    it('should handle unknown tool gracefully', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool_call_unknown',
              name: 'unknown.tool',
              input: { foo: 'bar' },
            },
          ],
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Unknown tool' }],
          stop_reason: 'end_turn',
        })

      vi.mocked(Anthropic).mockImplementation(() => ({
        messages: { create: mockCreate, stream: vi.fn() },
      }) as any)

      const agent = new ClaudeAgentSdkAgent(testDef)
      agent.setTools([mockEchoTool])

      const events: AgentEvent[] = []
      await agent.do('Use unknown tool', { stream: false, onEvent: (e) => events.push(e) })

      // Should have tool_result with error about unknown tool
      const toolResultEvent = events.find(e => e.type === 'tool_result')
      expect(toolResultEvent).toBeDefined()
      if (toolResultEvent?.type === 'tool_result') {
        expect(toolResultEvent.result).toEqual({
          error: expect.stringContaining('unknown.tool'),
        })
      }
    })
  })

  describe('Streaming Tool Execution', () => {
    it('should execute tools during streaming', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      // Create a mock async iterator for streaming
      const createMockStream = (chunks: any[]) => {
        let index = 0
        return {
          [Symbol.asyncIterator]: () => ({
            next: async () => {
              if (index < chunks.length) {
                return { value: chunks[index++], done: false }
              }
              return { value: undefined, done: true }
            },
          }),
          finalMessage: async () => ({
            content: [
              {
                type: 'tool_use',
                id: 'stream_tool_call',
                name: 'test.echo',
                input: { message: 'stream test' },
              },
            ],
            stop_reason: 'tool_use',
          }),
        }
      }

      const mockStream = vi.fn()
        .mockResolvedValueOnce(createMockStream([
          { type: 'content_block_start', content_block: { type: 'tool_use', id: 'stream_tool_call', name: 'test.echo' } },
          { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"message":' } },
          { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '"stream test"}' } },
          { type: 'content_block_stop' },
          { type: 'message_stop' },
        ]))

      // After tool execution, return final text
      const mockCreate = vi.fn().mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Done streaming' }],
        stop_reason: 'end_turn',
      })

      vi.mocked(Anthropic).mockImplementation(() => ({
        messages: { create: mockCreate, stream: mockStream },
      }) as any)

      const agent = new ClaudeAgentSdkAgent(testDef)
      agent.setTools([mockEchoTool])

      const events: AgentEvent[] = []
      await agent.do('Stream echo test', { stream: true, onEvent: (e) => events.push(e) })

      // Tool should have been executed with the correct params
      expect(mockEchoTool.execute).toHaveBeenCalledWith(
        { message: 'stream test' },
        null,
        undefined
      )

      // Should have tool_result event
      const toolResultEvent = events.find(e => e.type === 'tool_result')
      expect(toolResultEvent).toBeDefined()
    })
  })

  describe('Max Steps', () => {
    it('should respect maxSteps limit', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default

      // Always return tool_use to force agentic loop
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_call_loop',
            name: 'test.echo',
            input: { message: 'loop' },
          },
        ],
        stop_reason: 'tool_use',
      })

      vi.mocked(Anthropic).mockImplementation(() => ({
        messages: { create: mockCreate, stream: vi.fn() },
      }) as any)

      const agent = new ClaudeAgentSdkAgent({
        ...testDef,
        maxSteps: 3,
      })
      agent.setTools([mockEchoTool])

      const result = await agent.do('Loop forever', { stream: false, maxSteps: 3 })

      // Should stop at maxSteps (3 iterations)
      expect(mockCreate).toHaveBeenCalledTimes(3)
      // Result should indicate max steps reached
      expect(result.events.some(e => e.type === 'error')).toBe(true)
    })
  })
})
