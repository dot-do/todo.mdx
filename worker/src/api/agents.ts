/**
 * Agents API
 * GET /api/agents - List all agents (global + repo-specific)
 * GET /api/agents/:agentId - Get agent details
 * GET /api/agents/:agentId/sessions - Get active sessions for agent
 * POST /api/repos/:owner/:repo/agents/sync - Manually trigger agent sync
 */

import { Hono } from 'hono'
import type { Env } from '../types.js'
import { getPayloadClient } from '../payload'

const agents = new Hono<{ Bindings: Env }>()

/**
 * List all agents (filtered by access)
 * Query params:
 * - repo: filter by repo (owner/name)
 * - global: only global agents (true/false)
 */
agents.get('/', async (c) => {
  const payload = await getPayloadClient(c.env)
  const repoParam = c.req.query('repo')
  const globalOnly = c.req.query('global') === 'true'

  let where: any = {}

  if (globalOnly) {
    // Only global agents (no repo or org)
    where = {
      and: [
        { repo: { exists: false } },
        { org: { exists: false } },
      ],
    }
  } else if (repoParam) {
    // Get repo ID first
    const repos = await payload.find({
      collection: 'repos',
      where: { fullName: { equals: repoParam } },
      limit: 1,
      overrideAccess: true,
    })

    if (repos.docs.length === 0) {
      return c.json({ error: 'Repo not found' }, 404)
    }

    const repoId = repos.docs[0].id

    // Get agents for this repo (including global)
    where = {
      or: [
        { repo: { equals: repoId } },
        { and: [{ repo: { exists: false } }, { org: { exists: false } }] },
      ],
    }
  }

  const result = await payload.find({
    collection: 'agents',
    where,
    limit: 100,
    overrideAccess: true,
  })

  return c.json({
    agents: result.docs.map((agent: any) => ({
      id: agent.id,
      agentId: agent.agentId,
      name: agent.name,
      description: agent.description,
      tier: agent.tier,
      framework: agent.framework,
      model: agent.model,
      tools: agent.tools,
      scope: agent.repo ? 'repo' : agent.org ? 'org' : 'global',
      repoId: agent.repo,
      orgId: agent.org,
    })),
    total: result.totalDocs,
  })
})

/**
 * Get agent details by agentId
 */
agents.get('/:agentId', async (c) => {
  const agentId = c.req.param('agentId')
  const payload = await getPayloadClient(c.env)

  const result = await payload.find({
    collection: 'agents',
    where: { agentId: { equals: agentId } },
    limit: 1,
    overrideAccess: true,
  })

  if (result.docs.length === 0) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  const agent = result.docs[0]

  return c.json({
    id: agent.id,
    agentId: agent.agentId,
    name: agent.name,
    description: agent.description,
    tier: agent.tier,
    framework: agent.framework,
    model: agent.model,
    tools: agent.tools,
    instructions: agent.instructions,
    maxSteps: agent.maxSteps,
    timeout: agent.timeout,
    githubUsername: agent.githubUsername,
    reviewRole: agent.reviewRole,
    canEscalate: agent.canEscalate,
    scope: agent.repo ? 'repo' : agent.org ? 'org' : 'global',
    repoId: agent.repo,
    orgId: agent.org,
  })
})

/**
 * Get active sessions for an agent
 * This would query the SessionDO or a sessions collection
 * For now, returns a stub
 */
agents.get('/:agentId/sessions', async (c) => {
  const agentId = c.req.param('agentId')

  // TODO: Query SessionDO or sessions collection
  // For now, return empty array
  return c.json({
    agentId,
    activeSessions: [],
    totalSessions: 0,
  })
})

/**
 * Get agent runtime state (capacity, availability)
 * Returns current state from cost controls and session tracking
 */
agents.get('/:agentId/state', async (c) => {
  const agentId = c.req.param('agentId')
  const payload = await getPayloadClient(c.env)

  // Find agent
  const result = await payload.find({
    collection: 'agents',
    where: { agentId: { equals: agentId } },
    limit: 1,
    overrideAccess: true,
  })

  if (result.docs.length === 0) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  const agent = result.docs[0]

  // If agent is repo-scoped, check repo cost controls
  let capacity = 'unlimited'
  let available = true
  let currentLoad = 0

  if (agent.repo) {
    const repos = await payload.find({
      collection: 'repos',
      where: { id: { equals: agent.repo } },
      limit: 1,
      overrideAccess: true,
    })

    if (repos.docs.length > 0) {
      const repo = repos.docs[0]
      const costControls = repo.costControls || {}

      if (costControls.enabled && !costControls.inheritFromOrg) {
        // Check budget exceeded
        if (costControls.budgetExceeded) {
          available = false
        }

        // Check session limits
        const maxConcurrent = costControls.maxConcurrentSessions || Infinity
        const activeSessions = costControls.activeSessions || 0
        currentLoad = maxConcurrent > 0 ? activeSessions / maxConcurrent : 0

        if (activeSessions >= maxConcurrent) {
          available = false
        }

        capacity = `${activeSessions}/${maxConcurrent}`
      }
    }
  }

  return c.json({
    agentId,
    tier: agent.tier,
    framework: agent.framework,
    available,
    capacity,
    currentLoad,
    state: available ? 'ready' : 'unavailable',
  })
})

/**
 * Manually trigger agent sync for a repo
 */
agents.post('/repos/:owner/:repo/sync', async (c) => {
  const owner = c.req.param('owner')
  const repo = c.req.param('repo')
  const fullName = `${owner}/${repo}`

  const payload = await getPayloadClient(c.env)

  // Find repo
  const repos = await payload.find({
    collection: 'repos',
    where: { fullName: { equals: fullName } },
    limit: 1,
    overrideAccess: true,
  })

  if (repos.docs.length === 0) {
    return c.json({ error: 'Repo not found' }, 404)
  }

  const repoDoc = repos.docs[0]

  // Fetch agents.mdx from GitHub and sync
  try {
    const { fetchAgentsMdxFromGitHub, handleAgentsPush } = await import('../webhooks/agents')

    const agentsMdxContent = await fetchAgentsMdxFromGitHub(
      fullName,
      repoDoc.defaultBranch || 'main',
      repoDoc.installation,
      c.env.GITHUB_APP_ID,
      c.env.GITHUB_PRIVATE_KEY
    )

    if (!agentsMdxContent) {
      return c.json({
        status: 'error',
        message: 'agents.mdx not found in repo',
      }, 404)
    }

    const result = await handleAgentsPush(c, {
      repoFullName: fullName,
      installationId: repoDoc.installation,
      commit: repoDoc.defaultBranch || 'main',
      agentsMdxContent,
    })

    return result
  } catch (error) {
    const err = error as Error
    return c.json({
      status: 'error',
      message: err.message,
    }, 500)
  }
})

/**
 * Seed built-in agents to the database
 * POST /api/agents/seed
 * Query params:
 * - force: if true, update existing agents (default: false)
 */
agents.post('/seed', async (c) => {
  const payload = await getPayloadClient(c.env)
  const force = c.req.query('force') === 'true'

  try {
    const { seedBuiltinAgents } = await import('../agents/seed')
    const result = await seedBuiltinAgents(payload, force)

    return c.json({
      status: 'success',
      ...result,
    })
  } catch (error) {
    const err = error as Error
    return c.json({
      status: 'error',
      message: err.message,
    }, 500)
  }
})

/**
 * Check seed status
 * GET /api/agents/seed/status
 */
agents.get('/seed/status', async (c) => {
  const payload = await getPayloadClient(c.env)

  try {
    const { isSeeded, getGlobalAgents } = await import('../agents/seed')
    const { builtinAgents } = await import('../agents/builtin')

    const seeded = await isSeeded(payload)
    const globalAgents = await getGlobalAgents(payload)

    return c.json({
      seeded,
      globalAgentsCount: globalAgents.length,
      builtinAgentsCount: builtinAgents.length,
      agents: globalAgents.map((a: any) => ({
        id: a.agentId,
        name: a.name,
        tier: a.tier,
      })),
    })
  } catch (error) {
    const err = error as Error
    return c.json({
      status: 'error',
      message: err.message,
    }, 500)
  }
})

export { agents }
