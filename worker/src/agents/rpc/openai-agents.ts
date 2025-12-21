/**
 * OpenAiAgentRPC - Worker entrypoint for OpenAI Agents SDK agents
 *
 * Creates OpenAiAgentsAgent instances that can be accessed via RPC from DOs.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from '../../types/env'
import type { Agent, AgentDef } from '../base'
import { OpenAiAgentsAgent } from '../impl/openai-agents'

export class OpenAiAgentRPC extends WorkerEntrypoint<Env> {
  /**
   * Create an OpenAiAgentsAgent instance from an AgentDef
   *
   * This is the entry point for creating OpenAI agents via Workers RPC.
   * The agent instance is returned as an RPC stub that can be called
   * from Durable Objects or other Workers.
   *
   * @param def - The agent definition
   * @returns OpenAiAgentsAgent instance (RPC stub)
   * @throws Error if framework is not 'openai-agents'
   */
  create(def: AgentDef): Agent {
    if (def.framework !== 'openai-agents') {
      throw new Error(`Invalid framework for OpenAiAgentRPC: ${def.framework}`)
    }

    return new OpenAiAgentsAgent(def)
  }
}
