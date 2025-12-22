/**
 * Seed built-in agents to Payload CMS
 *
 * This module provides functionality to populate the agents collection
 * with pre-built agent personas. These are global agents (no repo/org scope)
 * that are available to all repositories.
 */

import { builtinAgents, type AgentDef } from './builtin'

/**
 * Payload client interface (minimal subset needed for seeding)
 */
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
}

/**
 * Convert AgentDef to Payload format for storage
 */
export function agentDefToPayload(agent: AgentDef): Record<string, any> {
  // Map model names to Payload format
  const modelMap: Record<string, string> = {
    best: 'claude-opus-4-5',
    fast: 'claude-haiku-3-5',
    cheap: 'claude-haiku-3-5',
    overall: 'claude-sonnet-4-5',
  }

  const model = modelMap[agent.model] || agent.model

  // Convert tools array to capabilities format
  const tools = agent.tools.map((tool) => {
    if (tool === '*') {
      return { name: 'all', operations: ['*'] }
    }
    const [name, operation] = tool.includes('.')
      ? tool.split('.')
      : [tool, '*']
    return {
      name,
      operations: operation === '*' ? ['*'] : [operation],
    }
  })

  return {
    agentId: agent.id,
    name: agent.name,
    description: agent.description,
    tools,
    tier: agent.tier,
    model,
    framework: agent.framework,
    instructions: agent.instructions,
    maxSteps: agent.maxSteps || 10,
    timeout: agent.timeout || 300000,
    // No repo or org = global agent
  }
}

/**
 * Seed result
 */
export interface SeedResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

/**
 * Seed all built-in agents to Payload CMS
 *
 * This upserts agents - updates if they exist, creates if they don't.
 * Only seeds global agents (no repo/org scope).
 *
 * @param payload - Payload client instance
 * @param force - If true, update existing agents. If false, skip existing.
 * @returns Result with counts of created/updated/skipped agents
 */
export async function seedBuiltinAgents(
  payload: PayloadClient,
  force = false
): Promise<SeedResult> {
  const result: SeedResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (const agent of builtinAgents) {
    try {
      const payloadData = agentDefToPayload(agent)

      // Check if agent already exists (global = no repo/org)
      const existing = await payload.find({
        collection: 'agents',
        where: {
          and: [
            { agentId: { equals: agent.id } },
            { repo: { exists: false } },
            { org: { exists: false } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })

      if (existing.docs.length > 0) {
        if (force) {
          // Update existing agent
          await payload.update({
            collection: 'agents',
            id: existing.docs[0].id,
            data: payloadData,
            overrideAccess: true,
          })
          result.updated++
        } else {
          // Skip existing agent
          result.skipped++
        }
      } else {
        // Create new agent
        await payload.create({
          collection: 'agents',
          data: payloadData,
          overrideAccess: true,
        })
        result.created++
      }
    } catch (error) {
      const err = error as Error
      result.errors.push(`Failed to seed agent ${agent.id}: ${err.message}`)
    }
  }

  return result
}

/**
 * Get all global (built-in) agents from Payload
 */
export async function getGlobalAgents(
  payload: PayloadClient
): Promise<any[]> {
  const result = await payload.find({
    collection: 'agents',
    where: {
      and: [
        { repo: { exists: false } },
        { org: { exists: false } },
      ],
    },
    limit: 100,
    overrideAccess: true,
  })

  return result.docs
}

/**
 * Check if built-in agents are seeded
 */
export async function isSeeded(payload: PayloadClient): Promise<boolean> {
  const existing = await getGlobalAgents(payload)
  return existing.length >= builtinAgents.length
}
