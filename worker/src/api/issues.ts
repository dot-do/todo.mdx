/**
 * Issues API
 * GET    /api/repos/:owner/:repo/issues          - List issues
 * POST   /api/repos/:owner/:repo/issues          - Create issue
 * GET    /api/repos/:owner/:repo/issues/:id      - Get issue
 * PATCH  /api/repos/:owner/:repo/issues/:id      - Update issue
 * DELETE /api/repos/:owner/:repo/issues/:id      - Delete issue
 */

import { Hono } from 'hono'
import type { Env } from '../types.js'

const issues = new Hono<{ Bindings: Env }>()

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

// List issues
issues.get('/', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const status = c.req.query('status') // 'open', 'closed', 'all'
  const url = status ? `http://do/issues?status=${status}` : 'http://do/issues'

  const response = await stub.fetch(new Request(url))
  const issues = await response.json()

  return c.json({ issues })
})

// Create issue
issues.post('/', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const body = await c.req.json()

  const response = await stub.fetch(new Request('http://do/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: body.title,
      body: body.body,
      labels: body.labels,
      assignees: body.assignees,
      milestone: body.milestone,
      priority: body.priority,
    }),
  }))

  const issue = await response.json()

  return c.json({ issue }, 201)
})

// Get issue
issues.get('/:id', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const id = c.req.param('id')

  const response = await stub.fetch(new Request(`http://do/issues/${id}`))

  if (!response.ok) {
    return c.json({ error: 'not_found', message: 'Issue not found' }, 404)
  }

  const issue = await response.json()

  return c.json({ issue })
})

// Update issue
issues.patch('/:id', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const id = c.req.param('id')
  const body = await c.req.json()

  const response = await stub.fetch(new Request(`http://do/issues/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))

  if (!response.ok) {
    return c.json({ error: 'not_found', message: 'Issue not found' }, 404)
  }

  const issue = await response.json()

  return c.json({ issue })
})

// Delete issue
issues.delete('/:id', async (c) => {
  const stub = await getRepoStub(c)
  if (!stub) {
    return c.json({ error: 'not_found', message: 'Repository not found or access denied' }, 404)
  }

  const id = c.req.param('id')

  const response = await stub.fetch(new Request(`http://do/issues/${id}`, {
    method: 'DELETE',
  }))

  if (!response.ok) {
    return c.json({ error: 'not_found', message: 'Issue not found' }, 404)
  }

  return c.json({ deleted: true })
})

export { issues }
