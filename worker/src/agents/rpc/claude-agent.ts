/**
 * ClaudeAgentSdkAgentRPC - Worker entrypoint for Claude Agent SDK agents
 *
 * Creates ClaudeAgentSdkAgent instances that can be accessed via RPC from DOs
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from '../../types/env'
import type { Agent, AgentDef } from '../base'
import { ClaudeAgentSdkAgent } from '../impl/claude-agent'

export class ClaudeAgentSdkAgentRPC extends WorkerEntrypoint<Env> {
  /**
   * Create a ClaudeAgentSdkAgent instance from an AgentDef
   *
   * This is the entry point for creating Claude Agent SDK agents via Workers RPC.
   * The agent instance is returned as an RPC stub that can be called
   * from Durable Objects or other Workers.
   *
   * @param def - The agent definition
   * @returns ClaudeAgentSdkAgent instance (RPC stub)
   */
  create(def: AgentDef): Agent {
    if (def.framework !== 'claude-agent-sdk') {
      throw new Error(`Invalid framework for ClaudeAgentSdkAgentRPC: ${def.framework}`)
    }

    return new ClaudeAgentSdkAgent(def)
  }
}
