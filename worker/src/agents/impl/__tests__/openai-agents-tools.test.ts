import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAiAgentsAgent } from '../openai-agents'
import type { AgentDef, AgentEvent } from '../../base'
import { ToolRegistry, type Tool, type Integration, type Connection } from '../../../tools'
import { z } from 'zod'

// Mock the OpenAI module
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  }
})

describe('OpenAiAgentsAgent - Tool Execution', () => {
  let registry: ToolRegistry
  let mockExecute: ReturnType<typeof vi.fn>
  let testConnection: Connection
  let originalApiKey: string | undefined

  // Create test tool that tracks calls
  const createTestTool = (name: string, execute: typeof mockExecute): Tool => ({
    name,
    fullName: `test.${name}`,
    schema: z.object({
      input: z.string(),
    }),
    execute,
  })

  // Create test integration
  const createTestIntegration = (tools: Tool[]): Integration => ({
    name: 'Test',
    tools,
  })

  const testDef: AgentDef = {
    id: 'test-openai-agent-tools',
    name: 'Test OpenAI Agent with Tools',
    description: 'Test agent for tool execution',
    tools: ['test.echo', 'test.add'],
    tier: 'worker',
    model: 'overall',
    framework: 'openai-agents',
    instructions: 'You are a helpful assistant with access to tools.',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Save original API key
    originalApiKey = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'test-api-key'
    ;(globalThis as any).OPENAI_API_KEY = 'test-api-key'

    // Set up mock tool execute function
    mockExecute = vi.fn().mockResolvedValue({ result: 'success' })

    // Create test connection
    testConnection = {
      id: 'test-connection-1',
      user: 'test-user',
      app: 'Test',
      provider: 'native',
      externalId: 'ext-123',
      externalRef: {},
      status: 'active',
      scopes: ['read', 'write'],
    }

    // Set up registry with test tools
    registry = new ToolRegistry()
    registry.register(createTestIntegration([
      createTestTool('echo', mockExecute),
      createTestTool('add', vi.fn().mockResolvedValue({ sum: 42 })),
    ]))
  })

  afterEach(() => {
    // Restore original API key
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey
    } else {
      delete process.env.OPENAI_API_KEY
    }
    ;(globalThis as any).OPENAI_API_KEY = undefined
  })

  describe('Tool Resolution', () => {
    it('should resolve tools from registry based on def.tools', async () => {
      const agent = new OpenAiAgentsAgent(testDef)

      // Agent should be able to get tools from registry
      agent.setToolRegistry(registry)
      const resolvedTools = agent.resolveTools()

      expect(resolvedTools).toBeDefined()
      expect(resolvedTools).toHaveLength(2)
      expect(resolvedTools.map(t => t.function.name)).toContain('test.echo')
      expect(resolvedTools.map(t => t.function.name)).toContain('test.add')
    })

    it('should resolve tools with correct OpenAI function format', async () => {
      const agent = new OpenAiAgentsAgent(testDef)
      agent.setToolRegistry(registry)
      const resolvedTools = agent.resolveTools()

      // Each tool should have the OpenAI function calling format
      for (const tool of resolvedTools) {
        expect(tool).toHaveProperty('type', 'function')
        expect(tool).toHaveProperty('function')
        expect(tool.function).toHaveProperty('name')
        expect(tool.function).toHaveProperty('description')
        expect(tool.function).toHaveProperty('parameters')
      }
    })

    it('should handle wildcard "*" in tools array', async () => {
      const wildcardDef: AgentDef = {
        ...testDef,
        tools: ['*'],
      }

      const agent = new OpenAiAgentsAgent(wildcardDef)
      agent.setToolRegistry(registry)
      const resolvedTools = agent.resolveTools()

      // Wildcard should resolve all tools in registry
      expect(resolvedTools.length).toBeGreaterThanOrEqual(2)
    })

    it('should return empty array when no registry is set', async () => {
      const agent = new OpenAiAgentsAgent(testDef)
      // No registry set
      const resolvedTools = agent.resolveTools()

      expect(resolvedTools).toEqual([])
    })
  })

  describe('Tool Execution', () => {
    it('should execute tools when tool_call events occur', async () => {
      const OpenAI = (await import('openai')).default
      const mockCreate = vi.fn()
        // First response with tool call
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'test.echo',
                  arguments: JSON.stringify({ input: 'hello' }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        })
        // Second response after tool result
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'The tool returned: success',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          }],
        })

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const agent = new OpenAiAgentsAgent(testDef)
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const events: AgentEvent[] = []
      await agent.do('Use the echo tool with input "hello"', {
        stream: false,
        onEvent: (e) => events.push(e),
      })

      // Tool execute should have been called
      expect(mockExecute).toHaveBeenCalledWith(
        { input: 'hello' },
        testConnection,
        null  // env is null unless explicitly set
      )
    })

    it('should emit tool_result events with execution results', async () => {
      const OpenAI = (await import('openai')).default
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call_456',
                type: 'function',
                function: {
                  name: 'test.echo',
                  arguments: JSON.stringify({ input: 'test' }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'Done',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          }],
        })

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const agent = new OpenAiAgentsAgent(testDef)
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const events: AgentEvent[] = []
      await agent.do('Call the echo tool', {
        stream: false,
        onEvent: (e) => events.push(e),
      })

      // Find tool_result event
      const toolResultEvent = events.find(e => e.type === 'tool_result')
      expect(toolResultEvent).toBeDefined()
      expect(toolResultEvent?.type).toBe('tool_result')
      expect((toolResultEvent as any).tool).toBe('test.echo')
      expect((toolResultEvent as any).id).toBe('call_456')
      expect((toolResultEvent as any).result).toEqual({ result: 'success' })
    })

    it('should continue conversation loop after tool execution', async () => {
      const OpenAI = (await import('openai')).default
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call_789',
                type: 'function',
                function: {
                  name: 'test.echo',
                  arguments: JSON.stringify({ input: 'hello' }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'I executed the tool and got: success',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          }],
        })

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const agent = new OpenAiAgentsAgent(testDef)
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const result = await agent.do('Use echo', { stream: false })

      // API should have been called twice: once for initial, once after tool result
      expect(mockCreate).toHaveBeenCalledTimes(2)

      // Second call should include tool result in messages
      const secondCall = mockCreate.mock.calls[1][0]
      expect(secondCall.messages).toContainEqual(
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'call_789',
        })
      )
    })

    it('should handle multiple tool calls in a single response', async () => {
      const addExecute = vi.fn().mockResolvedValue({ sum: 42 })
      registry.register(createTestIntegration([
        createTestTool('echo', mockExecute),
        {
          name: 'add',
          fullName: 'test.add',
          schema: z.object({ a: z.number(), b: z.number() }),
          execute: addExecute,
        },
      ]))

      const OpenAI = (await import('openai')).default
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'test.echo',
                    arguments: JSON.stringify({ input: 'first' }),
                  },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: {
                    name: 'test.add',
                    arguments: JSON.stringify({ a: 1, b: 2 }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'Both tools executed',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          }],
        })

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const agent = new OpenAiAgentsAgent(testDef)
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const events: AgentEvent[] = []
      await agent.do('Use both tools', {
        stream: false,
        onEvent: (e) => events.push(e),
      })

      // Both tools should be executed
      expect(mockExecute).toHaveBeenCalled()
      expect(addExecute).toHaveBeenCalled()

      // Should emit two tool_result events
      const toolResults = events.filter(e => e.type === 'tool_result')
      expect(toolResults).toHaveLength(2)
    })
  })

  describe('Tool Execution Error Handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const errorExecute = vi.fn().mockRejectedValue(new Error('Tool failed'))
      registry.register(createTestIntegration([
        createTestTool('failing', errorExecute),
      ]))

      const OpenAI = (await import('openai')).default
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call_error',
                type: 'function',
                function: {
                  name: 'test.failing',
                  arguments: JSON.stringify({ input: 'test' }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'Tool failed, here is the error',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          }],
        })

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const defWithFailing: AgentDef = {
        ...testDef,
        tools: ['test.failing'],
      }

      const agent = new OpenAiAgentsAgent(defWithFailing)
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const events: AgentEvent[] = []
      const result = await agent.do('Call failing tool', {
        stream: false,
        onEvent: (e) => events.push(e),
      })

      // Should still succeed overall (agent handles the error)
      expect(result.success).toBe(true)

      // Tool result should contain error information
      const toolResult = events.find(e => e.type === 'tool_result') as any
      expect(toolResult).toBeDefined()
      expect(toolResult.result).toHaveProperty('error')
      expect(toolResult.result.error).toContain('Tool failed')
    })

    it('should emit tool_result with error when tool not found', async () => {
      const OpenAI = (await import('openai')).default
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call_unknown',
                type: 'function',
                function: {
                  name: 'nonexistent.tool',
                  arguments: '{}',
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'Could not find tool',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          }],
        })

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const agent = new OpenAiAgentsAgent(testDef)
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const events: AgentEvent[] = []
      await agent.do('Call unknown tool', {
        stream: false,
        onEvent: (e) => events.push(e),
      })

      const toolResult = events.find(e => e.type === 'tool_result') as any
      expect(toolResult).toBeDefined()
      expect(toolResult.result).toHaveProperty('error')
      expect(toolResult.result.error).toContain('not found')
    })

    it('should handle invalid JSON in tool arguments', async () => {
      const OpenAI = (await import('openai')).default
      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call_invalid',
                type: 'function',
                function: {
                  name: 'test.echo',
                  arguments: 'not valid json',
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'Invalid arguments handled',
              tool_calls: undefined,
            },
            finish_reason: 'stop',
          }],
        })

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const agent = new OpenAiAgentsAgent(testDef)
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const events: AgentEvent[] = []
      await agent.do('Call with bad args', {
        stream: false,
        onEvent: (e) => events.push(e),
      })

      const toolResult = events.find(e => e.type === 'tool_result') as any
      expect(toolResult).toBeDefined()
      expect(toolResult.result).toHaveProperty('error')
    })
  })

  describe('Streaming Tool Execution', () => {
    it('should execute tools during streaming responses', async () => {
      const OpenAI = (await import('openai')).default

      // Mock streaming response with tool calls
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  id: 'stream_call_1',
                  type: 'function',
                  function: {
                    name: 'test.echo',
                    arguments: '',
                  },
                }],
              },
            }],
          }
          yield {
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  function: {
                    arguments: '{"in',
                  },
                }],
              },
            }],
          }
          yield {
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  function: {
                    arguments: 'put":"test"}',
                  },
                }],
              },
            }],
          }
          yield {
            choices: [{
              delta: {},
              finish_reason: 'tool_calls',
            }],
          }
        },
      }

      // Mock for the follow-up after tool result
      const mockNonStreamResponse = {
        choices: [{
          message: {
            content: 'Tool executed successfully',
            tool_calls: undefined,
          },
          finish_reason: 'stop',
        }],
      }

      const mockCreate = vi.fn()
        .mockResolvedValueOnce(mockStream)
        .mockResolvedValueOnce(mockNonStreamResponse)

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const agent = new OpenAiAgentsAgent(testDef)
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const events: AgentEvent[] = []
      await agent.do('Stream and use echo', {
        stream: true,
        onEvent: (e) => events.push(e),
      })

      // Tool should be executed
      expect(mockExecute).toHaveBeenCalled()

      // Should have tool_result event
      const toolResult = events.find(e => e.type === 'tool_result')
      expect(toolResult).toBeDefined()
    })
  })

  describe('Max Steps Limiting', () => {
    it('should respect maxSteps option to prevent infinite loops', async () => {
      const OpenAI = (await import('openai')).default

      // Always return tool calls to simulate infinite loop
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'infinite_call',
              type: 'function',
              function: {
                name: 'test.echo',
                arguments: JSON.stringify({ input: 'loop' }),
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      })

      vi.mocked(OpenAI).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      }) as any)

      const agent = new OpenAiAgentsAgent({ ...testDef, maxSteps: 3 })
      agent.setToolRegistry(registry)
      agent.setConnections([testConnection])

      const result = await agent.do('Infinite tool loop', {
        stream: false,
        maxSteps: 3,
      })

      // Should stop after maxSteps
      expect(mockCreate.mock.calls.length).toBeLessThanOrEqual(3)
    })
  })
})
