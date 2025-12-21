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
 */
export class OpenAiAgentsAgent extends Agent {
  readonly def: AgentDef
  private messages: OpenAI.ChatCompletionMessageParam[] = []
  private openai: OpenAI | null = null

  constructor(def: AgentDef) {
    super()
    this.def = def
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
   * Streaming execution using OpenAI chat completions stream
   */
  private async doStreaming(
    client: OpenAI,
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined,
    options?: DoOptions
  ): Promise<DoResult> {
    const stream = await client.chat.completions.create({
      model: this.resolveModel(),
      messages: this.messages,
      stream: true,
      // TODO: Add tools when tool resolution is implemented
      // tools: this.resolveTools(),
    })

    let fullText = ''
    let currentToolCallId = ''
    let currentToolName = ''
    let currentToolArgs = ''

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta

      if (delta?.content) {
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
          if (toolCall.id) {
            // New tool call starting
            if (currentToolCallId && currentToolName) {
              // Emit previous tool call
              const toolCallEvent: AgentEvent = {
                type: 'tool_call',
                tool: currentToolName,
                params: currentToolArgs ? JSON.parse(currentToolArgs) : {},
                id: currentToolCallId,
              }
              events.push(toolCallEvent)
              onEvent?.(toolCallEvent)
            }
            currentToolCallId = toolCall.id
            currentToolName = toolCall.function?.name || ''
            currentToolArgs = toolCall.function?.arguments || ''
          } else {
            // Continuing previous tool call
            if (toolCall.function?.arguments) {
              currentToolArgs += toolCall.function.arguments
            }
          }
        }
      }
    }

    // Emit final tool call if any
    if (currentToolCallId && currentToolName) {
      const toolCallEvent: AgentEvent = {
        type: 'tool_call',
        tool: currentToolName,
        params: currentToolArgs ? JSON.parse(currentToolArgs) : {},
        id: currentToolCallId,
      }
      events.push(toolCallEvent)
      onEvent?.(toolCallEvent)
    }

    // Add assistant response to history
    this.messages.push({
      role: 'assistant',
      content: fullText,
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
    client: OpenAI,
    events: AgentEvent[],
    onEvent: ((e: AgentEvent) => void) | undefined,
    options?: DoOptions
  ): Promise<DoResult> {
    const response = await client.chat.completions.create({
      model: this.resolveModel(),
      messages: this.messages,
      // TODO: Add tools when tool resolution is implemented
      // tools: this.resolveTools(),
    })

    const message = response.choices[0]?.message
    const fullText = message?.content || ''

    // Handle tool calls
    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const toolCallEvent: AgentEvent = {
          type: 'tool_call',
          tool: toolCall.function.name,
          params: JSON.parse(toolCall.function.arguments || '{}'),
          id: toolCall.id,
        }
        events.push(toolCallEvent)
        onEvent?.(toolCallEvent)

        // TODO: Execute the tool and emit tool_result
      }
    }

    // Add assistant response to history
    this.messages.push({
      role: 'assistant',
      content: fullText,
      tool_calls: message?.tool_calls,
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
