/**
 * AiSdkAgentRPC - Worker entrypoint for AI SDK agents
 *
 * Creates AiSdkAgent instances that can be accessed via RPC from DOs
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from '../../types/env'
import type { Agent, AgentDef } from '../base'
import type { Connection } from '../../tools/types'
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
   * @param connection - Optional connection for tool execution
   * @returns AiSdkAgent instance (RPC stub)
   */
  create(def: AgentDef, connection?: Connection): Agent {
    if (def.framework !== 'ai-sdk') {
      throw new Error(`Invalid framework for AiSdkAgentRPC: ${def.framework}`)
    }

    // Pass env and connection to agent for model resolution and tool execution
    return new AiSdkAgent(def, this.env, connection)
  }
}
