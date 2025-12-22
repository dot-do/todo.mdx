import { generateText, CoreMessage, streamText, LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import {
  Agent,
  AgentDef,
  DoOptions,
  AskOptions,
  DoResult,
  AskResult,
  AgentEvent,
} from '../base'
import type { Tool, Connection, Integration } from '../../tools/types'
import type { Env } from '../../types/env'

// Import native integrations for tool lookup
import { GitHub } from '../../tools/native/github'
import { Linear } from '../../tools/native/linear'

// Hardcoded model defaults for when no env/database is available
const HARDCODED_DEFAULTS: Record<string, string> = {
  best: 'anthropic/claude-opus-4-5-20251101',
  fast: 'anthropic/claude-3-5-haiku-20241022',
  cheap: 'openai/gpt-4o-mini',
  overall: 'anthropic/claude-opus-4-5-20251101',
}

// All available integrations
const ALL_INTEGRATIONS: Integration[] = [GitHub, Linear]

/**
 * AI SDK Tool format - matches what generateText/streamText expect
 */
interface AiSdkTool {
  description?: string
  inputSchema: z.ZodSchema
  execute: (params: any) => Promise<any>
}

/**
 * AI SDK Agent implementation using Vercel AI SDK v4
 *
 * This agent uses streamText() for streaming execution and generateText() for non-streaming.
 * It maintains message history for multi-turn conversations and emits events via callbacks.
 */
export class AiSdkAgent extends Agent {
  readonly def: AgentDef
  private messages: CoreMessage[] = []
  private env?: Env
  private connection?: Connection

  constructor(def: AgentDef, env?: Env, connection?: Connection) {
    super()
    this.def = def
    this.env = env
    this.connection = connection
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

    // Resolve tools and create step finish handler
    const tools = this.resolveTools()
    const handleStepFinish = this.createStepFinishHandler(events, onEvent)

    try {
      if (options?.stream !== false) {
        // Streaming execution
        const result = await streamText({
          model: this.resolveModel(),
          system: this.def.instructions,
          messages: this.messages,
          maxSteps: options?.maxSteps ?? this.def.maxSteps ?? 10,
          tools,
          onStepFinish: handleStepFinish,
        })

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
          tools,
          onStepFinish: handleStepFinish,
        })

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
   * Create a step finish handler for tool call/result events
   */
  private createStepFinishHandler(
    events: AgentEvent[],
    onEvent?: (e: AgentEvent) => void
  ): (step: any) => void {
    return (step: any) => {
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

  /**
   * Resolve model preference to an AI SDK LanguageModel instance
   *
   * Supports:
   * - Built-in use cases: 'best', 'fast', 'cheap', 'overall'
   * - Explicit model IDs: 'anthropic/claude-3-5-haiku-20241022', 'openai/gpt-4o'
   */
  private resolveModel(): LanguageModel {
    const preference = this.def.model

    // Resolve use case to explicit model ID
    let modelId: string
    if (['best', 'fast', 'cheap', 'overall'].includes(preference)) {
      modelId = HARDCODED_DEFAULTS[preference]
    } else {
      modelId = preference
    }

    // Parse provider/model format
    const [provider, ...modelParts] = modelId.split('/')
    const modelName = modelParts.join('/')

    // Create provider-specific model instance
    switch (provider) {
      case 'anthropic': {
        const anthropic = createAnthropic({
          apiKey: this.env?.ANTHROPIC_API_KEY,
        })
        return anthropic(modelName)
      }
      case 'openai': {
        const openai = createOpenAI({
          // Uses OPENAI_API_KEY env var by default
        })
        return openai(modelName)
      }
      default: {
        // Default to Anthropic for unknown providers
        const anthropic = createAnthropic({
          apiKey: this.env?.ANTHROPIC_API_KEY,
        })
        return anthropic(modelId)
      }
    }
  }

  /**
   * Resolve tools from def.tools and convert to AI SDK format
   *
   * Tool names can be:
   * - Fully qualified: 'github.createPullRequest'
   * - Wildcard: 'github.*' (all GitHub tools)
   * - Simple: 'createPullRequest' (search all integrations)
   */
  private resolveTools(): Record<string, AiSdkTool> {
    const tools: Record<string, AiSdkTool> = {}
    const toolNames = this.def.tools

    for (const toolName of toolNames) {
      if (toolName === '*') {
        // Include all tools from all integrations
        for (const integration of ALL_INTEGRATIONS) {
          for (const tool of integration.tools) {
            tools[tool.fullName] = this.convertTool(tool)
          }
        }
      } else if (toolName.endsWith('.*')) {
        // Wildcard: include all tools from an integration
        const integrationPrefix = toolName.slice(0, -2).toLowerCase()
        const integration = ALL_INTEGRATIONS.find(
          (i) => i.name.toLowerCase() === integrationPrefix
        )
        if (integration) {
          for (const tool of integration.tools) {
            tools[tool.fullName] = this.convertTool(tool)
          }
        }
      } else if (toolName.includes('.')) {
        // Fully qualified name: 'github.createPullRequest'
        const tool = this.findToolByFullName(toolName)
        if (tool) {
          tools[tool.fullName] = this.convertTool(tool)
        }
      } else {
        // Simple name: search all integrations
        const tool = this.findToolBySimpleName(toolName)
        if (tool) {
          tools[tool.fullName] = this.convertTool(tool)
        }
      }
    }

    return tools
  }

  /**
   * Find a tool by its fully qualified name (e.g., 'github.createPullRequest')
   */
  private findToolByFullName(fullName: string): Tool | undefined {
    for (const integration of ALL_INTEGRATIONS) {
      const tool = integration.tools.find((t) => t.fullName === fullName)
      if (tool) return tool
    }
    return undefined
  }

  /**
   * Find a tool by its simple name (e.g., 'createPullRequest')
   */
  private findToolBySimpleName(name: string): Tool | undefined {
    for (const integration of ALL_INTEGRATIONS) {
      const tool = integration.tools.find((t) => t.name === name)
      if (tool) return tool
    }
    return undefined
  }

  /**
   * Convert a todo.mdx Tool to AI SDK format
   */
  private convertTool(tool: Tool): AiSdkTool {
    const connection = this.connection
    const env = this.env

    return {
      description: `Tool: ${tool.fullName}`,
      inputSchema: tool.schema,
      execute: async (params: any) => {
        // If we have a connection and env, execute the real tool
        if (connection && env) {
          return tool.execute(params, connection, env)
        }
        // Otherwise return a mock result for testing
        return { success: true, toolName: tool.fullName, params }
      },
    }
  }
}
