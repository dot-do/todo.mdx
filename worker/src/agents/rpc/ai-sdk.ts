/**
 * AiSdkAgentRPC - Worker entrypoint for AI SDK agents
 *
 * Creates AiSdkAgent instances that can be accessed via RPC from DOs
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from '../../types/env'
import type { Agent, AgentDef } from '../base'
import { AiSdkAgent } from '../impl/ai-sdk'

export class AiSdkAgentRPC extends WorkerEntrypoint<Env> {
  /**
   * Create an AiSdkAgent instance from an AgentDef
   *
   * This is the entry point for creating AI SDK agents via Workers RPC.
   * The agent instance is returned as an RPC stub that can be called
   * from Durable Objects or other Workers.
   *
   * @param def - The agent definition
   * @returns AiSdkAgent instance (RPC stub)
   */
  create(def: AgentDef): Agent {
    if (def.framework !== 'ai-sdk') {
      throw new Error(`Invalid framework for AiSdkAgentRPC: ${def.framework}`)
    }

    return new AiSdkAgent(def)
  }
}
