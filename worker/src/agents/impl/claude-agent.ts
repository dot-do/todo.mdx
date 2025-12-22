import Anthropic from '@anthropic-ai/sdk'
import type {
  MessageParam,
  MessageCreateParams,
  MessageCreateParamsNonStreaming,
  ContentBlock,
  Tool as AnthropicTool,
  ToolResultBlockParam,
  Message,
} from '@anthropic-ai/sdk/resources/messages'
import {
  Agent,
  AgentDef,
  DoOptions,
  AskOptions,
  DoResult,
  AskResult,
  AgentEvent,
} from '../base'
import type { Tool, Connection } from '../../tools/types'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * Claude Agent SDK implementation using Anthropic SDK
 *
 * This agent uses the Anthropic SDK directly for API calls.
 * It maintains message history for multi-turn conversations and emits events via callbacks.
 *
 * Note: The Claude Agent SDK v2 is still in preview. This implementation uses the
 * stable @anthropic-ai/sdk package and can be updated to use the official Agent SDK
 * when it becomes available.
 */
export class ClaudeAgentSdkAgent extends Agent {
  readonly def: AgentDef
  private messages: MessageParam[] = []
  private anthropic: Anthropic | null = null
  private tools: Tool[] = []
  private connection: Connection | null = null
  private env: any = null

  constructor(def: AgentDef) {
    super()
    this.def = def
  }

  /**
   * Set the tools available for this agent
   */
  setTools(tools: Tool[], connection?: Connection, env?: any): void {
    this.tools = tools
    this.connection = connection || null
    this.env = env
  }

  /**
   * Get the resolved tools
   */
  getResolvedTools(): Tool[] {
    return this.tools
  }

  /**
   * Convert tools to Anthropic API format
   */
  getAnthropicTools(): AnthropicTool[] {
    return this.tools.map((tool) => {
      // Convert Zod schema to JSON schema
      const jsonSchema = zodToJsonSchema(tool.schema, { target: 'openApi3' })

      return {
        name: tool.fullName,
        description: `Tool: ${tool.fullName}`,
        input_schema: jsonSchema as AnthropicTool['input_schema'],
      }
    })
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(
    toolName: string,
    params: unknown
  ): Promise<{ result: unknown; error?: string }> {
    const tool = this.tools.find((t) => t.fullName === toolName)

    if (!tool) {
      return { result: { error: `Unknown tool: ${toolName}` }, error: `Unknown tool: ${toolName}` }
    }

    try {
      const result = await tool.execute(params, this.connection as Connection, this.env)
      return { result }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { result: { error: errorMessage }, error: errorMessage }
    }
  }

  /**
   * Initialize the Anthropic client
   *
   * Lazy initialization to avoid requiring ANTHROPIC_API_KEY at construction time
   */
  private getClient(): Anthropic {
    if (!this.anthropic) {
      // Get API key from environment
      const apiKey = (globalThis as any).ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is required for ClaudeAgentSdkAgent')
      }

      this.anthropic = new Anthropic({
        apiKey,
      })
    }
    return this.anthropic
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

    // Add task to messages
    this.messages.push({
      role: 'user',
      content: task,
    })

    try {
      const client = this.getClient()

      if (options?.stream !== false) {
        // Streaming execution
        return await this.doStreaming(client, events, onEvent, options)
      } else {
        // Non-streaming execution
        return await this.doNonStreaming(client, events, onEvent, options)
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
   * Streaming execution with agentic loop
   */
  private async doStreaming(
    client: Anthropic,
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined,
    options?: DoOptions
  ): Promise<DoResult> {
    const maxSteps = options?.maxSteps ?? this.def.maxSteps ?? 10
    let step = 0
    let fullText = ''

    while (step < maxSteps) {
      step++
      const params = this.buildMessageParams(options)
      const stream = await client.messages.stream(params as MessageCreateParams)

      let currentToolUseId = ''
      let currentToolName = ''
      let currentToolInput = ''
      const toolUses: Array<{ id: string; name: string; input: unknown }> = []

      for await (const event of stream) {
        switch (event.type) {
          case 'content_block_start':
            if (event.content_block.type === 'tool_use') {
              currentToolUseId = event.content_block.id
              currentToolName = event.content_block.name
              currentToolInput = ''
            }
            break

          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              fullText += event.delta.text
              const messageEvent: AgentEvent = {
                type: 'message',
                content: event.delta.text,
              }
              events.push(messageEvent)
              onEvent?.(messageEvent)
            } else if (event.delta.type === 'input_json_delta') {
              currentToolInput += event.delta.partial_json
            }
            break

          case 'content_block_stop':
            // If we were collecting a tool use, emit the tool_call event
            if (currentToolUseId && currentToolName) {
              const parsedInput = currentToolInput ? JSON.parse(currentToolInput) : {}
              const toolCallEvent: AgentEvent = {
                type: 'tool_call',
                tool: currentToolName,
                params: parsedInput,
                id: currentToolUseId,
              }
              events.push(toolCallEvent)
              onEvent?.(toolCallEvent)

              toolUses.push({
                id: currentToolUseId,
                name: currentToolName,
                input: parsedInput,
              })

              currentToolUseId = ''
              currentToolName = ''
              currentToolInput = ''
            }
            break

          case 'message_stop':
            break
        }
      }

      const finalMessage = await stream.finalMessage()

      // Add assistant response to history
      this.messages.push({
        role: 'assistant',
        content: finalMessage.content,
      })

      // If no tool uses or stop reason is not tool_use, we're done
      if (toolUses.length === 0 || finalMessage.stop_reason !== 'tool_use') {
        const doResult: DoResult = { success: true, output: fullText, events }
        const doneEvent: AgentEvent = {
          type: 'done',
          result: doResult,
        }
        events.push(doneEvent)
        onEvent?.(doneEvent)
        return doResult
      }

      // Execute tools and collect results
      const toolResults: ToolResultBlockParam[] = []
      for (const toolUse of toolUses) {
        const { result, error } = await this.executeTool(toolUse.name, toolUse.input)

        const toolResultEvent: AgentEvent = {
          type: 'tool_result',
          tool: toolUse.name,
          result: error ? { error } : result,
          id: toolUse.id,
        }
        events.push(toolResultEvent)
        onEvent?.(toolResultEvent)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      // Add tool results to messages for next iteration
      this.messages.push({
        role: 'user',
        content: toolResults,
      })
    }

    // Max steps reached
    const errorEvent: AgentEvent = {
      type: 'error',
      error: `Maximum steps (${maxSteps}) reached`,
    }
    events.push(errorEvent)
    onEvent?.(errorEvent)

    const doResult: DoResult = { success: false, output: fullText, events }
    const doneEvent: AgentEvent = {
      type: 'done',
      result: doResult,
    }
    events.push(doneEvent)
    onEvent?.(doneEvent)

    return doResult
  }

  /**
   * Non-streaming execution with agentic loop
   */
  private async doNonStreaming(
    client: Anthropic,
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined,
    options?: DoOptions
  ): Promise<DoResult> {
    const maxSteps = options?.maxSteps ?? this.def.maxSteps ?? 10
    let step = 0
    let fullText = ''

    while (step < maxSteps) {
      step++
      const params = this.buildMessageParams(options)
      const response: Message = await client.messages.create({
        ...params,
        stream: false,
      } as MessageCreateParamsNonStreaming)

      // Collect tool uses to execute
      const toolUses: Array<{ id: string; name: string; input: unknown }> = []

      // Extract text from content blocks
      for (const block of response.content) {
        if (block.type === 'text') {
          fullText += block.text
        } else if (block.type === 'tool_use') {
          const toolCallEvent: AgentEvent = {
            type: 'tool_call',
            tool: block.name,
            params: block.input,
            id: block.id,
          }
          events.push(toolCallEvent)
          onEvent?.(toolCallEvent)

          toolUses.push({
            id: block.id,
            name: block.name,
            input: block.input,
          })
        }
      }

      // Add assistant response to history
      this.messages.push({
        role: 'assistant',
        content: response.content,
      })

      // If no tool uses, we're done
      if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
        const doResult: DoResult = { success: true, output: fullText, events }
        const doneEvent: AgentEvent = {
          type: 'done',
          result: doResult,
        }
        events.push(doneEvent)
        onEvent?.(doneEvent)
        return doResult
      }

      // Execute tools and collect results
      const toolResults: ToolResultBlockParam[] = []
      for (const toolUse of toolUses) {
        const { result, error } = await this.executeTool(toolUse.name, toolUse.input)

        const toolResultEvent: AgentEvent = {
          type: 'tool_result',
          tool: toolUse.name,
          result: error ? { error } : result,
          id: toolUse.id,
        }
        events.push(toolResultEvent)
        onEvent?.(toolResultEvent)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      // Add tool results to messages for next iteration
      this.messages.push({
        role: 'user',
        content: toolResults,
      })
    }

    // Max steps reached
    const errorEvent: AgentEvent = {
      type: 'error',
      error: `Maximum steps (${maxSteps}) reached`,
    }
    events.push(errorEvent)
    onEvent?.(errorEvent)

    const doResult: DoResult = { success: false, output: fullText, events }
    const doneEvent: AgentEvent = {
      type: 'done',
      result: doResult,
    }
    events.push(doneEvent)
    onEvent?.(doneEvent)

    return doResult
  }

  /**
   * Build message params for API call
   */
  private buildMessageParams(options?: DoOptions): Partial<MessageCreateParams> {
    const params: Partial<MessageCreateParams> = {
      model: this.resolveModel(),
      messages: this.messages as MessageParam[],
      max_tokens: 4096,
    }

    if (this.def.instructions) {
      params.system = this.def.instructions
    }

    // Add tools if available
    if (this.tools.length > 0) {
      params.tools = this.getAnthropicTools()
    }

    return params
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
   * Maps def.model to actual Anthropic model IDs
   */
  private resolveModel(): string {
    const modelMap: Record<string, string> = {
      best: 'claude-opus-4-5-20251101',
      fast: 'claude-sonnet-4-5-20250929',
      cheap: 'claude-haiku-3-5-20241022',
      overall: 'claude-sonnet-4-5-20250929',
    }

    // If def.model is a preset, resolve it; otherwise use as-is
    return modelMap[this.def.model] || this.def.model
  }
}
