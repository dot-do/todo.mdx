/**
 * Repos API
 * GET /api/repos - List user's repos
 * GET /api/repos/:owner/:repo - Get repo info
 */

import { Hono } from 'hono'
import type { Env } from '../types.js'

const repos = new Hono<{ Bindings: Env }>()

// List user's repos
repos.get('/', async (c) => {
  const auth = c.get('auth')

  const result = await c.env.DB.prepare(`
    SELECT r.* FROM repos r
    JOIN user_installations ui ON ui.installation_id = r.installation_id
    WHERE ui.user_id = ?
  `).bind(auth.userId).all()

  return c.json({
    repos: result.results.map((repo: any) => ({
      id: repo.id,
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner,
      private: repo.private,
      installationId: repo.installation_id,
    })),
  })
})

// Get repo info
repos.get('/:owner/:repo', async (c) => {
  const auth = c.get('auth')
  const owner = c.req.param('owner')
  const repo = c.req.param('repo')
  const fullName = `${owner}/${repo}`

  // Verify access
  const result = await c.env.DB.prepare(`
    SELECT r.* FROM repos r
    JOIN user_installations ui ON ui.installation_id = r.installation_id
    WHERE ui.user_id = ? AND r.full_name = ?
  `).bind(auth.userId, fullName).first()

  if (!result) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  // Get sync status from DO
  const doId = c.env.REPO.idFromName(fullName)
  const stub = c.env.REPO.get(doId)

  const statusRes = await stub.fetch(new Request('http://do/status'))
  const status = await statusRes.json()

  return c.json({
    id: result.id,
    fullName: result.full_name,
    name: result.name,
    owner: result.owner,
    private: result.private,
    syncStatus: status,
  })
})

// Trigger sync
repos.post('/:owner/:repo/sync', async (c) => {
  const auth = c.get('auth')
  const owner = c.req.param('owner')
  const repo = c.req.param('repo')
  const fullName = `${owner}/${repo}`

  // Verify access
  const result = await c.env.DB.prepare(`
    SELECT r.* FROM repos r
    JOIN user_installations ui ON ui.installation_id = r.installation_id
    WHERE ui.user_id = ? AND r.full_name = ?
  `).bind(auth.userId, fullName).first()

  if (!result) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  // Trigger sync in DO
  const doId = c.env.REPO.idFromName(fullName)
  const stub = c.env.REPO.get(doId)

  const syncRes = await stub.fetch(new Request('http://do/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggeredBy: auth.userId }),
  }))

  const syncResult = await syncRes.json()

  return c.json(syncResult)
})

// Get sync status
repos.get('/:owner/:repo/sync/status', async (c) => {
  const auth = c.get('auth')
  const owner = c.req.param('owner')
  const repo = c.req.param('repo')
  const fullName = `${owner}/${repo}`

  // Verify access
  const result = await c.env.DB.prepare(`
    SELECT r.* FROM repos r
    JOIN user_installations ui ON ui.installation_id = r.installation_id
    WHERE ui.user_id = ? AND r.full_name = ?
  `).bind(auth.userId, fullName).first()

  if (!result) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  // Get status from DO
  const doId = c.env.REPO.idFromName(fullName)
  const stub = c.env.REPO.get(doId)

  const statusRes = await stub.fetch(new Request('http://do/status'))
  const status = await statusRes.json()

  return c.json(status)
})

export { repos }
