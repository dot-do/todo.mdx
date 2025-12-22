import OpenAI from 'openai'
import {
  Agent,
  AgentDef,
  DoOptions,
  AskOptions,
  DoResult,
  AskResult,
  AgentEvent,
} from '../base'
import { ToolRegistry, Tool, Connection } from '../../tools'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * OpenAI function tool format
 */
interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

/**
 * Pending tool call waiting to be executed
 */
interface PendingToolCall {
  id: string
  name: string
  arguments: string
}

/**
 * OpenAI Agents SDK Agent implementation
 *
 * This agent uses the OpenAI API for chat completions with tool use.
 * It follows the same pattern as our other agent implementations, providing
 * compatibility with the OpenAI Agents SDK patterns (agents, handoffs, guardrails).
 *
 * Note: The official OpenAI Agents SDK (openai-agents-js) is still evolving.
 * This implementation uses the core openai package for maximum stability
 * and can be updated to use the Agents SDK when it stabilizes.
 *
 * Features:
 * - Streaming and non-streaming execution
 * - Tool use with function calling
 * - Message history for multi-turn conversations
 * - Event streaming via callbacks
 * - Agentic loop with tool execution
 */
export class OpenAiAgentsAgent extends Agent {
  readonly def: AgentDef
  private messages: OpenAI.ChatCompletionMessageParam[] = []
  private openai: OpenAI | null = null
  private toolRegistry: ToolRegistry | null = null
  private connections: Connection[] = []
  private env: any = null

  constructor(def: AgentDef) {
    super()
    this.def = def
  }

  /**
   * Set the tool registry for resolving tools
   */
  setToolRegistry(registry: ToolRegistry): void {
    this.toolRegistry = registry
  }

  /**
   * Set the connections for tool execution
   */
  setConnections(connections: Connection[]): void {
    this.connections = connections
  }

  /**
   * Set the environment for tool execution
   */
  setEnv(env: any): void {
    this.env = env
  }

  /**
   * Resolve tools from the registry based on def.tools
   * Returns tools in OpenAI function calling format
   */
  resolveTools(): OpenAITool[] {
    if (!this.toolRegistry) {
      return []
    }

    const resolvedTools: OpenAITool[] = []
    const allTools = this.toolRegistry.getAll().flatMap(i => i.tools)

    for (const toolName of this.def.tools) {
      if (toolName === '*') {
        // Wildcard: add all tools
        for (const tool of allTools) {
          resolvedTools.push(this.toolToOpenAI(tool))
        }
      } else {
        // Specific tool name
        const tool = this.toolRegistry.getTool(toolName)
        if (tool) {
          resolvedTools.push(this.toolToOpenAI(tool))
        }
      }
    }

    return resolvedTools
  }

  /**
   * Convert a Tool to OpenAI function format
   */
  private toolToOpenAI(tool: Tool): OpenAITool {
    // Convert Zod schema to JSON Schema
    const jsonSchema = zodToJsonSchema(tool.schema, {
      $refStrategy: 'none',
    })

    // Remove $schema property if present
    const parameters = { ...jsonSchema } as any
    delete parameters.$schema

    return {
      type: 'function',
      function: {
        name: tool.fullName,
        description: `Execute the ${tool.name} action`,
        parameters: parameters,
      },
    }
  }

  /**
   * Initialize the OpenAI client
   *
   * Lazy initialization to avoid requiring OPENAI_API_KEY at construction time
   */
  private getClient(): OpenAI {
    if (!this.openai) {
      // Get API key from environment
      const apiKey = (globalThis as any).OPENAI_API_KEY || process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for OpenAiAgentsAgent')
      }

      this.openai = new OpenAI({
        apiKey,
      })
    }
    return this.openai
  }

  /**
   * Execute a task with tool use and agentic loop
   *
   * Supports both streaming and non-streaming execution based on options.stream.
   * Maintains message history for conversation context.
   */
  async do(task: string, options?: DoOptions): Promise<DoResult> {
    const events: AgentEvent[] = []
    const onEvent = options?.onEvent

    // Add system message if we have instructions and this is first message
    if (this.def.instructions && this.messages.length === 0) {
      this.messages.push({
        role: 'system',
        content: this.def.instructions,
      })
    }

    // Add task to messages
    this.messages.push({
      role: 'user',
      content: task,
    })

    try {
      const client = this.getClient()
      const maxSteps = options?.maxSteps ?? this.def.maxSteps ?? 10

      if (options?.stream !== false) {
        // Streaming execution
        return await this.doStreaming(client, events, onEvent, options, maxSteps)
      } else {
        // Non-streaming execution with agentic loop
        return await this.doNonStreaming(client, events, onEvent, options, maxSteps)
      }
    } catch (error) {
      const errorEvent: AgentEvent = {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      }
      events.push(errorEvent)
      onEvent?.(errorEvent)

      return {
        success: false,
        output: error instanceof Error ? error.message : String(error),
        events,
      }
    }
  }

  /**
   * Streaming execution using OpenAI chat completions stream
   */
  private async doStreaming(
    client: OpenAI,
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined,
    options?: DoOptions,
    maxSteps: number = 10
  ): Promise<DoResult> {
    let step = 0
    let fullText = ''

    while (step < maxSteps) {
      step++

      const tools = this.resolveTools()
      const stream = await client.chat.completions.create({
        model: this.resolveModel(),
        messages: this.messages,
        stream: true,
        ...(tools.length > 0 ? { tools } : {}),
      })

      let currentText = ''
      const pendingToolCalls: PendingToolCall[] = []
      let currentToolCallIndex = -1
      let finishReason: string | null = null

      for await (const chunk of stream) {
        const choice = chunk.choices[0]
        const delta = choice?.delta
        finishReason = choice?.finish_reason || finishReason

        if (delta?.content) {
          currentText += delta.content
          fullText += delta.content
          const messageEvent: AgentEvent = {
            type: 'message',
            content: delta.content,
          }
          events.push(messageEvent)
          onEvent?.(messageEvent)
        }

        // Handle tool calls in stream
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            if (toolCall.index !== undefined && toolCall.index !== currentToolCallIndex) {
              // Start of a new tool call
              currentToolCallIndex = toolCall.index
              pendingToolCalls[currentToolCallIndex] = {
                id: toolCall.id || '',
                name: toolCall.function?.name || '',
                arguments: toolCall.function?.arguments || '',
              }
            } else if (currentToolCallIndex >= 0) {
              // Continue building current tool call
              const pending = pendingToolCalls[currentToolCallIndex]
              if (toolCall.id) pending.id = toolCall.id
              if (toolCall.function?.name) pending.name = toolCall.function.name
              if (toolCall.function?.arguments) pending.arguments += toolCall.function.arguments
            }
          }
        }
      }

      // Add assistant message to history
      if (currentText || pendingToolCalls.length > 0) {
        const assistantMessage: OpenAI.ChatCompletionMessageParam = {
          role: 'assistant',
          content: currentText || null,
        }

        if (pendingToolCalls.length > 0) {
          ;(assistantMessage as any).tool_calls = pendingToolCalls.map((tc, idx) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          }))
        }

        this.messages.push(assistantMessage)
      }

      // If no tool calls, we're done
      if (pendingToolCalls.length === 0 || finishReason !== 'tool_calls') {
        break
      }

      // Execute tools and emit events
      await this.processToolCalls(pendingToolCalls, events, onEvent)
    }

    const doneEvent: AgentEvent = {
      type: 'done',
      result: { success: true, output: fullText, events },
    }
    events.push(doneEvent)
    onEvent?.(doneEvent)

    return { success: true, output: fullText, events }
  }

  /**
   * Non-streaming execution with agentic loop
   */
  private async doNonStreaming(
    client: OpenAI,
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined,
    options?: DoOptions,
    maxSteps: number = 10
  ): Promise<DoResult> {
    let step = 0
    let fullText = ''

    while (step < maxSteps) {
      step++

      const tools = this.resolveTools()
      const response = await client.chat.completions.create({
        model: this.resolveModel(),
        messages: this.messages,
        ...(tools.length > 0 ? { tools } : {}),
      })

      const message = response.choices[0]?.message
      const finishReason = response.choices[0]?.finish_reason
      const textContent = message?.content || ''
      fullText += textContent

      // Add assistant response to history
      this.messages.push({
        role: 'assistant',
        content: textContent || null,
        tool_calls: message?.tool_calls,
      })

      // If no tool calls, we're done
      if (!message?.tool_calls || message.tool_calls.length === 0) {
        break
      }

      // Convert OpenAI tool calls to PendingToolCall format
      const pendingToolCalls: PendingToolCall[] = message.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments || '{}',
      }))

      // Execute tools and emit events
      await this.processToolCalls(pendingToolCalls, events, onEvent)

      // Continue loop to process tool results
    }

    const doResult: DoResult = { success: true, output: fullText, events }

    const doneEvent: AgentEvent = {
      type: 'done',
      result: doResult,
    }
    events.push(doneEvent)
    onEvent?.(doneEvent)

    return doResult
  }

  /**
   * Process tool calls: emit events, execute, and add results to messages.
   * Returns the results for each tool call.
   */
  private async processToolCalls(
    toolCalls: PendingToolCall[],
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined
  ): Promise<Array<{ id: string; result: any }>> {
    const results: Array<{ id: string; result: any }> = []

    for (const toolCall of toolCalls) {
      // Parse arguments for event
      let params: any = {}
      try {
        params = toolCall.arguments ? JSON.parse(toolCall.arguments) : {}
      } catch {
        // Invalid JSON handled in executeToolCall
      }

      // Emit tool_call event
      const toolCallEvent: AgentEvent = {
        type: 'tool_call',
        tool: toolCall.name,
        params,
        id: toolCall.id,
      }
      events.push(toolCallEvent)
      onEvent?.(toolCallEvent)

      // Execute the tool
      const toolResult = await this.executeToolCall(toolCall)

      // Emit tool_result event
      const toolResultEvent: AgentEvent = {
        type: 'tool_result',
        tool: toolCall.name,
        result: toolResult,
        id: toolCall.id,
      }
      events.push(toolResultEvent)
      onEvent?.(toolResultEvent)

      // Add tool result to messages
      this.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      })

      results.push({ id: toolCall.id, result: toolResult })
    }

    return results
  }

  /**
   * Execute a tool call and return the result
   */
  private async executeToolCall(toolCall: PendingToolCall): Promise<any> {
    // Parse arguments
    let params: any
    try {
      params = toolCall.arguments ? JSON.parse(toolCall.arguments) : {}
    } catch (e) {
      return {
        error: `Invalid JSON in tool arguments: ${e instanceof Error ? e.message : String(e)}`,
      }
    }

    // Find the tool
    if (!this.toolRegistry) {
      return {
        error: `Tool not found: ${toolCall.name} (no registry configured)`,
      }
    }

    const tool = this.toolRegistry.getTool(toolCall.name)
    if (!tool) {
      return {
        error: `Tool not found: ${toolCall.name}`,
      }
    }

    // Find connection for the tool's app
    const integration = this.toolRegistry.getAll().find(i =>
      i.tools.some(t => t.fullName === toolCall.name)
    )

    let connection: Connection | undefined
    if (integration) {
      connection = this.connections.find(c =>
        c.app.toLowerCase() === integration.name.toLowerCase()
      )
    }

    // Execute the tool
    try {
      // Validate params against schema
      const validated = tool.schema.parse(params)

      // Execute with connection (may be undefined for default tools)
      const result = await tool.execute(validated, connection as Connection, this.env)
      return result
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  /**
   * Answer a question without tool use
   *
   * ask() is essentially do() with stream=false and different return type
   */
  async ask(question: string, options?: AskOptions): Promise<AskResult> {
    const result = await this.do(question, {
      ...options,
      stream: options?.stream ?? false,
    })

    return {
      answer: result.output,
      confidence: result.success ? 1.0 : 0.0,
    }
  }

  /**
   * Resolve the model name from the AgentDef
   *
   * Maps def.model to actual OpenAI model IDs
   */
  private resolveModel(): string {
    const modelMap: Record<string, string> = {
      best: 'gpt-4o',
      fast: 'gpt-4o-mini',
      cheap: 'gpt-4o-mini',
      overall: 'gpt-4o',
    }

    // If def.model is a preset, resolve it; otherwise use as-is
    return modelMap[this.def.model] || this.def.model
  }
}
