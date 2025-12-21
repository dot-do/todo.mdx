/**
 * Claude Code API Routes
 *
 * Provides API endpoints for starting and managing Claude Code sessions.
 * Works with the ClaudeSandbox Durable Object for execution.
 */

import { Hono } from 'hono'
import type { Env } from '../types.js'
import { getPayloadClient } from '../payload.js'

const app = new Hono<{ Bindings: Env }>()

interface CodeSession {
  sessionId: string
  repo: string
  ref: string
  task: string
  installationId: number
  createdAt: number
  status: 'pending' | 'running' | 'complete' | 'error' | 'terminated'
}

/**
 * POST /api/code/:org/:repo/start
 * Start a new Claude Code session for a repository
 *
 * Body:
 *   - task: string (optional) - Task description for Claude
 *   - ref: string (optional) - Branch/tag/commit (default: main)
 */
app.post('/:org/:repo/start', async (c) => {
  const org = c.req.param('org')
  const repo = c.req.param('repo')
  const fullName = `${org}/${repo}`

  const body = await c.req.json<{ task?: string; ref?: string }>().catch(() => ({ task: undefined, ref: undefined }))
  const task = body.task || 'Explore the codebase and help with development tasks'
  const ref = body.ref || 'main'

  try {
    // Look up the repo to get installation ID
    const payload = await getPayloadClient(c.env)
    const repoResult = await payload.find({
      collection: 'repos',
      where: { fullName: { equals: fullName } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })

    if (!repoResult.docs?.length) {
      return c.json({
        error: 'Repository not found',
        message: `No installation found for ${fullName}. Install the GitHub App first.`
      }, 404)
    }

    const repoDoc = repoResult.docs[0]
    const installation = repoDoc.installation as { installationId: number } | null

    if (!installation?.installationId) {
      return c.json({
        error: 'No installation',
        message: 'Repository has no associated GitHub App installation.'
      }, 400)
    }

    const installationId = installation.installationId

    // Generate session ID
    const sessionId = crypto.randomUUID()

    // Store session in KV
    const session: CodeSession = {
      sessionId,
      repo: fullName,
      ref,
      task,
      installationId,
      createdAt: Date.now(),
      status: 'pending',
    }

    await c.env.OAUTH_KV.put(
      `code:${sessionId}`,
      JSON.stringify(session),
      { expirationTtl: 7200 } // 2 hours
    )

    // Pre-create the sandbox instance
    const doId = c.env.Sandbox.idFromName(sessionId)
    c.env.Sandbox.get(doId)

    return c.json({
      sessionId,
      repo: fullName,
      ref,
      wsUrl: `/api/terminal/${sessionId}?repo=${encodeURIComponent(fullName)}&task=${encodeURIComponent(task)}&installationId=${installationId}`,
      widgetUrl: `/code/${org}/${repo}?session=${sessionId}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Code API] Start error for ${fullName}:`, message)
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/code/:org/:repo/sessions
 * List active Claude Code sessions for a repository
 */
app.get('/:org/:repo/sessions', async (c) => {
  const org = c.req.param('org')
  const repo = c.req.param('repo')
  const fullName = `${org}/${repo}`

  try {
    // List sessions from KV (prefix scan)
    const list = await c.env.OAUTH_KV.list({ prefix: 'code:' })

    const sessions: CodeSession[] = []
    for (const key of list.keys) {
      const session = await c.env.OAUTH_KV.get(key.name, 'json') as CodeSession | null
      if (session && session.repo === fullName) {
        sessions.push(session)
      }
    }

    // Sort by creation time, newest first
    sessions.sort((a, b) => b.createdAt - a.createdAt)

    return c.json({ sessions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

/**
 * GET /api/code/:org/:repo/sessions/:sessionId
 * Get status of a specific session
 */
app.get('/:org/:repo/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')

  const session = await c.env.OAUTH_KV.get(`code:${sessionId}`, 'json') as CodeSession | null
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  return c.json(session)
})

/**
 * DELETE /api/code/:org/:repo/sessions/:sessionId
 * Terminate a Claude Code session
 */
app.delete('/:org/:repo/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')

  const session = await c.env.OAUTH_KV.get(`code:${sessionId}`, 'json') as CodeSession | null
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  // Update status
  session.status = 'terminated'
  await c.env.OAUTH_KV.put(
    `code:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: 300 } // Keep for 5 min after termination
  )

  // Signal sandbox to abort
  const doId = c.env.Sandbox.idFromName(sessionId)
  const sandbox = c.env.Sandbox.get(doId)

  try {
    await sandbox.fetch(new Request('http://sandbox/abort', { method: 'POST' }))
  } catch (e) {
    // Sandbox may already be gone
  }

  return c.json({ success: true })
})

export default app
