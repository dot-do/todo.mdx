import Anthropic from '@anthropic-ai/sdk'
import type {
  MessageParam,
  MessageCreateParams,
  ContentBlock,
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

  constructor(def: AgentDef) {
    super()
    this.def = def
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
   * Streaming execution
   */
  private async doStreaming(
    client: Anthropic,
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined,
    options?: DoOptions
  ): Promise<DoResult> {
    const params = this.buildMessageParams(options)

    const stream = await client.messages.stream(params as MessageCreateParams)

    let fullText = ''
    let currentToolUseId = ''
    let currentToolName = ''
    let currentToolInput = ''

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
            const toolCallEvent: AgentEvent = {
              type: 'tool_call',
              tool: currentToolName,
              params: currentToolInput ? JSON.parse(currentToolInput) : {},
              id: currentToolUseId,
            }
            events.push(toolCallEvent)
            onEvent?.(toolCallEvent)

            // TODO: Execute the tool and emit tool_result
            // For now, we don't execute tools - that requires tool resolution
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

    const doneEvent: AgentEvent = {
      type: 'done',
      result: { success: true, output: fullText, events },
    }
    events.push(doneEvent)
    onEvent?.(doneEvent)

    return { success: true, output: fullText, events }
  }

  /**
   * Non-streaming execution
   */
  private async doNonStreaming(
    client: Anthropic,
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined,
    options?: DoOptions
  ): Promise<DoResult> {
    const params = this.buildMessageParams(options)

    const response = await client.messages.create(params as MessageCreateParams)

    // Extract text from content blocks
    let fullText = ''
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

        // TODO: Execute the tool and emit tool_result
      }
    }

    // Add assistant response to history
    this.messages.push({
      role: 'assistant',
      content: response.content,
    })

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

    // TODO: Add tools when tool resolution is implemented
    // if (this.def.tools.length > 0) {
    //   params.tools = this.resolveTools()
    // }

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
