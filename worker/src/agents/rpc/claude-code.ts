/**
 * ClaudeCodeAgentRPC - Worker entrypoint for Claude Code sandbox agents
 *
 * Creates ClaudeCodeAgent instances that can be accessed via RPC from DOs.
 * These agents provide full sandbox execution for complex development tasks.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from '../../types/env'
import type { Agent, AgentDef } from '../base'
import { ClaudeCodeAgent } from '../impl/claude-code'

export class ClaudeCodeAgentRPC extends WorkerEntrypoint<Env> {
  /**
   * Create a ClaudeCodeAgent instance from an AgentDef
   *
   * This is the entry point for creating Claude Code sandbox agents via Workers RPC.
   * The agent instance is returned as an RPC stub that can be called
   * from Durable Objects or other Workers.
   *
   * Sandbox agents are designed for:
   * - Complex multi-file refactoring
   * - Full-stack feature implementation
   * - Deep codebase exploration
   * - Tasks requiring full development environment
   *
   * @param def - The agent definition
   * @returns ClaudeCodeAgent instance (RPC stub)
   * @throws Error if framework is not 'claude-code'
   */
  create(def: AgentDef): Agent {
    if (def.framework !== 'claude-code') {
      throw new Error(`Invalid framework for ClaudeCodeAgentRPC: ${def.framework}`)
    }

    return new ClaudeCodeAgent(def)
  }
}
