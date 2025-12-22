/**
 * Agents Webhook Handler
 * Handles push events with agents.mdx changes
 * Parses MDX and syncs agent configurations to Payload CMS
 */

import type { Context } from 'hono'
import type { Env } from '../types.js'
import { getPayloadClient } from '../payload'
import { parseAgentsMdx, syncAgentsToCloud, deleteRemovedAgents } from 'agents.mdx'

export interface AgentsPushEvent {
  repoFullName: string
  installationId: number
  commit: string
  agentsMdxContent: string
}

/**
 * Handle agents.mdx push event
 * Parses the MDX content and syncs agents to Payload
 */
export async function handleAgentsPush(
  c: Context<{ Bindings: Env }>,
  event: AgentsPushEvent
): Promise<Response> {
  const t0 = Date.now()
  const timing: Record<string, number> = {}

  console.log(`[Agents] Syncing agents.mdx for ${event.repoFullName}`)

  try {
    // Get Payload client
    const payload = await getPayloadClient(c.env)
    timing.payloadInit = Date.now() - t0

    // Find repo in Payload
    const t1 = Date.now()
    const repos = await payload.find({
      collection: 'repos',
      where: { fullName: { equals: event.repoFullName } },
      limit: 1,
      overrideAccess: true,
    })
    timing.repoLookup = Date.now() - t1

    if (!repos.docs || repos.docs.length === 0) {
      console.warn(`[Agents] Repo ${event.repoFullName} not found in Payload`)
      return c.json({
        status: 'error',
        message: 'Repo not found',
        timing,
      }, 404)
    }

    const repoId = repos.docs[0].id

    // Parse agents.mdx
    const t2 = Date.now()
    const parsed = parseAgentsMdx(event.agentsMdxContent, 'agents.mdx')
    timing.parse = Date.now() - t2

    console.log(`[Agents] Parsed ${parsed.agents.length} agents from MDX`)

    // Sync agents to Payload
    const t3 = Date.now()
    const syncResult = await syncAgentsToCloud(parsed.agents, payload, repoId)
    timing.sync = Date.now() - t3

    console.log(
      `[Agents] Synced: ${syncResult.created} created, ${syncResult.updated} updated`
    )

    if (syncResult.errors.length > 0) {
      console.error(`[Agents] Sync errors:`, syncResult.errors)
    }

    // Delete agents that were removed from agents.mdx
    const t4 = Date.now()
    const currentAgentIds = parsed.agents.map(a =>
      a.name.toLowerCase().replace(/\s+/g, '-')
    )
    const deleted = await deleteRemovedAgents(currentAgentIds, payload, repoId)
    timing.cleanup = Date.now() - t4

    console.log(`[Agents] Deleted ${deleted} removed agents`)

    timing.total = Date.now() - t0

    return c.json({
      status: 'synced',
      repo: event.repoFullName,
      agents: parsed.agents.length,
      created: syncResult.created,
      updated: syncResult.updated,
      deleted,
      errors: syncResult.errors,
      timing,
    })
  } catch (error) {
    const err = error as Error
    timing.total = Date.now() - t0
    console.error(`[Agents] Sync error after ${timing.total}ms:`, err.message, err.stack)
    return c.json({
      status: 'error',
      message: err.message,
      timing,
    }, 500)
  }
}

/**
 * Fetch agents.mdx content from GitHub
 */
export async function fetchAgentsMdxFromGitHub(
  repoFullName: string,
  commit: string,
  installationId: number,
  githubAppId: string,
  githubPrivateKey: string
): Promise<string | null> {
  try {
    // Get installation access token
    const { Octokit } = await import('@octokit/rest')
    const { createAppAuth } = await import('@octokit/auth-app')

    const auth = createAppAuth({
      appId: githubAppId,
      privateKey: githubPrivateKey,
      installationId,
    })

    const installationAuth = await auth({ type: 'installation' })
    const octokit = new Octokit({ auth: installationAuth.token })

    // Fetch agents.mdx content
    const [owner, repo] = repoFullName.split('/')
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path: 'agents.mdx',
      ref: commit,
    })

    if ('content' in response.data && response.data.content) {
      // Decode base64 content
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
      return content
    }

    return null
  } catch (error) {
    const err = error as Error
    console.error(`[Agents] Failed to fetch agents.mdx:`, err.message)
    return null
  }
}
