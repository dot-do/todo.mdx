/**
 * Agent Sync Service
 * Syncs agent configurations between repo (agents.mdx) and cloud (Payload CMS)
 */

import type { AgentConfig, AgentRegistryEntry } from './types'

/** Agent data for Payload CMS */
export interface PayloadAgentData {
  agentId: string
  name: string
  description?: string
  tools: any[]
  tier: 'light' | 'worker' | 'sandbox'
  model?: string
  framework: 'ai-sdk' | 'claude-agent-sdk' | 'openai-agents' | 'claude-code'
  instructions?: string
  maxSteps?: number
  timeout?: number
  repo?: string // Payload repo ID
  org?: string // Payload installation ID
}

/** Payload client interface (minimal subset) */
export interface PayloadClient {
  find(args: {
    collection: string
    where?: any
    limit?: number
    overrideAccess?: boolean
  }): Promise<{ docs: any[] }>

  create(args: {
    collection: string
    data: any
    overrideAccess?: boolean
  }): Promise<any>

  update(args: {
    collection: string
    id: string
    data: any
    overrideAccess?: boolean
  }): Promise<any>

  delete(args: {
    collection: string
    id: string
    overrideAccess?: boolean
  }): Promise<void>
}

/**
 * Convert AgentConfig to Payload agent data
 */
export function agentConfigToPayloadData(
  config: AgentConfig,
  repoId?: string,
  orgId?: string
): PayloadAgentData {
  // Map autonomy and model to tier and framework
  const tier: 'light' | 'worker' | 'sandbox' =
    config.autonomy === 'full' ? 'sandbox' :
    config.autonomy === 'supervised' ? 'worker' :
    'light'

  const framework =
    config.model === 'opus' || config.model === 'sonnet' || config.model === 'haiku'
      ? 'claude-agent-sdk'
      : 'ai-sdk'

  // Convert capabilities to tools array (simplified)
  const tools = (config.capabilities || []).map(cap => ({
    name: cap.name,
    operations: cap.operations || ['*'],
  }))

  const data: PayloadAgentData = {
    agentId: config.name.toLowerCase().replace(/\s+/g, '-'),
    name: config.name,
    description: config.description,
    tools,
    tier,
    model: config.model || 'overall',
    framework,
    instructions: config.instructions,
    maxSteps: 10,
    timeout: 300000,
  }

  if (repoId) {
    data.repo = repoId
  }
  if (orgId) {
    data.org = orgId
  }

  return data
}

/**
 * Sync agents to Payload CMS
 * Upserts agents from repo config, preserving existing global agents
 */
export async function syncAgentsToCloud(
  agents: AgentConfig[],
  payload: PayloadClient,
  repoId: string
): Promise<{ created: number; updated: number; errors: string[] }> {
  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const agent of agents) {
    try {
      const payloadData = agentConfigToPayloadData(agent, repoId)

      // Check if agent exists for this repo
      const existing = await payload.find({
        collection: 'agents',
        where: {
          and: [
            { agentId: { equals: payloadData.agentId } },
            { repo: { equals: repoId } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })

      if (existing.docs.length > 0) {
        // Update existing agent
        await payload.update({
          collection: 'agents',
          id: existing.docs[0].id,
          data: payloadData,
          overrideAccess: true,
        })
        updated++
      } else {
        // Create new agent
        await payload.create({
          collection: 'agents',
          data: payloadData,
          overrideAccess: true,
        })
        created++
      }
    } catch (error) {
      const err = error as Error
      errors.push(`Failed to sync agent ${agent.name}: ${err.message}`)
    }
  }

  return { created, updated, errors }
}

/**
 * Merge repo agents with built-in/global agents
 * Repo-specific agents override global agents with the same agentId
 */
export function mergeAgents(
  repoAgents: AgentRegistryEntry[],
  globalAgents: AgentRegistryEntry[]
): AgentRegistryEntry[] {
  const merged = new Map<string, AgentRegistryEntry>()

  // Add global agents first
  for (const agent of globalAgents) {
    const key = agent.name.toLowerCase().replace(/\s+/g, '-')
    merged.set(key, agent)
  }

  // Override with repo agents (if same agentId)
  for (const agent of repoAgents) {
    const key = agent.name.toLowerCase().replace(/\s+/g, '-')
    merged.set(key, agent)
  }

  return Array.from(merged.values())
}

/**
 * Get agents for a specific repo (including global agents)
 */
export async function getAgentsForRepo(
  payload: PayloadClient,
  repoId: string
): Promise<AgentRegistryEntry[]> {
  // Get repo-specific agents and global agents
  const result = await payload.find({
    collection: 'agents',
    where: {
      or: [
        { repo: { equals: repoId } },
        { and: [{ repo: { exists: false } }, { org: { exists: false } }] },
      ],
    },
    overrideAccess: true,
  })

  // Convert Payload agents to AgentRegistryEntry
  return result.docs.map((doc: any) => ({
    name: doc.name,
    description: doc.description,
    capabilities: doc.tools?.map((t: any) => ({
      name: t.name,
      operations: t.operations,
    })),
    autonomy:
      doc.tier === 'sandbox' ? 'full' :
      doc.tier === 'worker' ? 'supervised' :
      'manual',
    model: doc.model === 'overall' ? 'sonnet' : doc.model,
    instructions: doc.instructions,
  }))
}

/**
 * Delete repo-specific agents that are no longer in agents.mdx
 */
export async function deleteRemovedAgents(
  currentAgentIds: string[],
  payload: PayloadClient,
  repoId: string
): Promise<number> {
  // Get all repo-specific agents
  const existing = await payload.find({
    collection: 'agents',
    where: { repo: { equals: repoId } },
    overrideAccess: true,
  })

  let deleted = 0
  for (const agent of existing.docs) {
    if (!currentAgentIds.includes(agent.agentId)) {
      await payload.delete({
        collection: 'agents',
        id: agent.id,
        overrideAccess: true,
      })
      deleted++
    }
  }

  return deleted
}
