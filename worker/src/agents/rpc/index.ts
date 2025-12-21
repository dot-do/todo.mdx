/**
 * AgentRPC - Unified factory for agent creation
 *
 * Routes agent creation requests to framework-specific RPC entrypoints
 * and resolves agent definitions with inheritance (repo → org → builtin)
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from '../../types/env'
import type { Agent, AgentDef } from '../base'
import { getBuiltinAgent } from '../builtin'
import { createDrizzle } from '../../db/drizzle'
import { eq, and, or, isNull } from 'drizzle-orm'

export interface AgentResolutionContext {
  orgId?: string
  repoId?: string
}

export class AgentRPC extends WorkerEntrypoint<Env> {
  /**
   * Create an agent stub from an AgentDef
   *
   * Routes to framework-specific RPC entrypoint based on def.framework
   */
  create(def: AgentDef): Agent {
    switch (def.framework) {
      case 'ai-sdk':
        return this.env.AI_SDK_AGENT.create(def)
      case 'claude-code':
        return this.env.CLAUDE_CODE_AGENT.create(def)
      case 'openai-agents':
        return this.env.OPENAI_AGENT.create(def)
      case 'claude-agent-sdk':
        return this.env.CLAUDE_AGENT.create(def)
      default:
        throw new Error(`Unknown agent framework: ${(def as any).framework}`)
    }
  }

  /**
   * Get an agent by ID with inheritance resolution
   *
   * Resolution order:
   * 1. Repo-level agent (if repoId provided)
   * 2. Org-level agent (if orgId provided)
   * 3. Built-in agent
   * 4. Error if not found
   *
   * @param agentId - The agent ID to resolve
   * @param context - Resolution context (orgId, repoId)
   * @returns Agent instance
   */
  async get(agentId: string, context: AgentResolutionContext = {}): Promise<Agent> {
    const def = await this.resolveAgentDef(agentId, context)
    return this.create(def)
  }

  /**
   * Resolve an agent definition with inheritance
   *
   * This is the core resolution logic that checks:
   * 1. Repo-level custom agents (from Payload)
   * 2. Org-level custom agents (from Payload)
   * 3. Built-in agents (from code)
   *
   * @param agentId - The agent ID to resolve
   * @param context - Resolution context
   * @returns AgentDef with all fields resolved
   */
  private async resolveAgentDef(
    agentId: string,
    context: AgentResolutionContext
  ): Promise<AgentDef> {
    // Try to load from database if context is provided
    if (context.orgId || context.repoId) {
      const db = createDrizzle(this.env.DB)

      try {
        // Query for custom agents (repo-level or org-level)
        // Note: This assumes there's an 'agents' table in the schema
        // For now, we'll skip database lookup since the schema doesn't include it yet
        // and fall through to built-in agents

        // TODO: When Agents collection is added to Payload, uncomment this:
        /*
        const result = await db
          .select()
          .from(agents)
          .where(
            and(
              eq(agents.agentId, agentId),
              or(
                context.repoId ? eq(agents.repoId, parseInt(context.repoId)) : undefined,
                context.orgId ? eq(agents.orgId, parseInt(context.orgId)) : undefined,
                isNull(agents.repoId)
              )
            )
          )
          .orderBy(
            // Prefer repo-level, then org-level, then global
            agents.repoId ? 'DESC' : 'ASC'
          )
          .limit(1)

        if (result.length > 0) {
          const customAgent = result[0]
          return {
            id: customAgent.agentId,
            name: customAgent.name,
            description: customAgent.description || '',
            tools: JSON.parse(customAgent.tools || '[]'),
            tier: customAgent.tier as 'light' | 'worker' | 'sandbox',
            model: customAgent.model || 'overall',
            framework: customAgent.framework as AgentDef['framework'],
            instructions: customAgent.instructions || undefined,
            maxSteps: customAgent.maxSteps || undefined,
            timeout: customAgent.timeout || undefined,
          }
        }
        */
      } catch (error) {
        console.error('[AgentRPC] Error loading custom agent:', error)
        // Fall through to built-in agents
      }
    }

    // Fall back to built-in agents
    const builtinDef = getBuiltinAgent(agentId)
    if (builtinDef) {
      return builtinDef
    }

    throw new Error(`Agent not found: ${agentId}`)
  }

  /**
   * List all available agents for a given context
   *
   * Returns built-in agents plus any custom agents defined at org/repo level
   *
   * @param context - Resolution context
   * @returns Array of agent IDs
   */
  async list(context: AgentResolutionContext = {}): Promise<string[]> {
    const builtinIds = (await import('../builtin')).getBuiltinAgentIds()

    // TODO: When Agents collection exists, also query custom agents
    /*
    if (context.orgId || context.repoId) {
      const db = createDrizzle(this.env.DB)
      const customAgents = await db
        .select({ agentId: agents.agentId })
        .from(agents)
        .where(
          or(
            context.repoId ? eq(agents.repoId, parseInt(context.repoId)) : undefined,
            context.orgId ? eq(agents.orgId, parseInt(context.orgId)) : undefined
          )
        )

      const customIds = customAgents.map(a => a.agentId)
      return [...new Set([...builtinIds, ...customIds])]
    }
    */

    return builtinIds
  }
}
