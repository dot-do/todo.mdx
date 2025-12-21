import { generateText, CoreMessage, streamText } from 'ai'
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
 * AI SDK Agent implementation using Vercel AI SDK v6
 *
 * This agent uses streamText() for streaming execution and generateText() for non-streaming.
 * It maintains message history for multi-turn conversations and emits events via callbacks.
 */
export class AiSdkAgent extends Agent {
  readonly def: AgentDef
  private messages: CoreMessage[] = []

  constructor(def: AgentDef) {
    super()
    this.def = def
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
    this.messages.push({ role: 'user', content: task })

    try {
      if (options?.stream !== false) {
        // Streaming execution
        const result = await streamText({
          model: this.resolveModel(),
          system: this.def.instructions,
          messages: this.messages,
          maxSteps: options?.maxSteps ?? this.def.maxSteps ?? 10,
          tools: {}, // TODO: resolve tools from def.tools
          onStepFinish: (step: any) => {
            if (step.toolCalls?.length) {
              for (const call of step.toolCalls) {
                const event: AgentEvent = {
                  type: 'tool_call',
                  tool: call.toolName,
                  params: (call as any).args ?? call.input,
                  id: call.toolCallId,
                }
                events.push(event)
                onEvent?.(event)
              }
            }
            if (step.toolResults?.length) {
              for (const toolResult of step.toolResults) {
                const event: AgentEvent = {
                  type: 'tool_result',
                  tool: toolResult.toolName,
                  result: (toolResult as any).result ?? toolResult.output,
                  id: toolResult.toolCallId,
                }
                events.push(event)
                onEvent?.(event)
              }
            }
          },
        } as any)

        // Consume the stream
        const text = await result.text

        // Add assistant response to history
        this.messages.push({ role: 'assistant', content: text })

        const doneEvent: AgentEvent = {
          type: 'done',
          result: { success: true, output: text, events },
        }
        events.push(doneEvent)
        onEvent?.(doneEvent)

        return { success: true, output: text, events }
      } else {
        // Non-streaming execution
        const result = await generateText({
          model: this.resolveModel(),
          system: this.def.instructions,
          messages: this.messages,
          maxSteps: options?.maxSteps ?? this.def.maxSteps ?? 10,
          tools: {},
        } as any)

        this.messages.push({ role: 'assistant', content: result.text })

        const doResult: DoResult = { success: true, output: result.text, events }

        const doneEvent: AgentEvent = {
          type: 'done',
          result: doResult,
        }
        events.push(doneEvent)
        onEvent?.(doneEvent)

        return doResult
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
   * Answer a question without tool use
   *
   * ask() is essentially do() with stream=false and different return type
   */
  async ask(question: string, options?: AskOptions): Promise<AskResult> {
    // ask() is essentially do() with stream=false and different return type
    const result = await this.do(question, {
      ...options,
      stream: options?.stream ?? false,
    })

    return {
      answer: result.output,
      confidence: result.success ? 1.0 : 0.0,
    }
  }

  private resolveModel(): any {
    // TODO: Implement dynamic model resolution using ModelDefaults
    // For now, return a placeholder that will be replaced
    // when we implement the model resolution logic
    return undefined as any
  }
}
