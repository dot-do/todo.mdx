/**
 * Milestones API
 * GET    /api/repos/:owner/:repo/milestones          - List milestones
 * POST   /api/repos/:owner/:repo/milestones          - Create milestone
 * GET    /api/repos/:owner/:repo/milestones/:id      - Get milestone
 * PATCH  /api/repos/:owner/:repo/milestones/:id      - Update milestone
 */

import { Hono } from 'hono'
import type { Env } from '../types.js'

const milestones = new Hono<{ Bindings: Env }>()

// Helper to verify repo access and get DO stub
async function getRepoStub(c: any) {
  const auth = c.get('auth')
  const owner = c.req.param('owner')
  const repo = c.req.param('repo')
  const fullName = `${owner}/${repo}`

  const result = await c.env.DB.prepare(`
    SELECT r.* FROM repos r
    JOIN user_installations ui ON ui.installation_id = r.installation_id
    WHERE ui.user_id = ? AND r.full_name = ?
  `).bind(auth.userId, fullName).first()

  if (!result) {
    return null
  }

  const doId = c.env.REPO.idFromName(fullName)
  return c.env.REPO.get(doId)
}

// List milestones
milestones.get('/', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const state = c.req.query('state') // 'open', 'closed', 'all'
  const url = state ? `http://do/milestones?state=${state}` : 'http://do/milestones'

  const response = await stub.fetch(new Request(url))
  const milestones = await response.json()

  return c.json({ milestones })
})

// Create milestone
milestones.post('/', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const body = await c.req.json()

  const response = await stub.fetch(new Request('http://do/milestones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: body.title,
      description: body.description,
      dueOn: body.dueOn,
    }),
  }))

  const milestone = await response.json()

  return c.json({ milestone }, 201)
})

// Get milestone
milestones.get('/:id', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const id = c.req.param('id')

  const response = await stub.fetch(new Request(`http://do/milestones/${id}`))

  if (!response.ok) {
    return c.json({ error: 'not_found', message: 'Milestone not found' }, 404)
  }

  const milestone = await response.json()

  return c.json({ milestone })
})

// Update milestone
milestones.patch('/:id', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const id = c.req.param('id')
  const body = await c.req.json()

  const response = await stub.fetch(new Request(`http://do/milestones/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))

  if (!response.ok) {
    return c.json({ error: 'not_found', message: 'Milestone not found' }, 404)
  }

  const milestone = await response.json()

  return c.json({ milestone })
})

export { milestones }
