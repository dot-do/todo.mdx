/**
 * Search API - Semantic search using Vectorize
 */

import { Hono } from 'hono'
import type { Env } from '../types.js'

const search = new Hono<{ Bindings: Env }>()

/**
 * GET /api/search?q=...&limit=10&type=issue|milestone|all
 * Semantic search across issues and milestones
 */
search.get('/', async (c) => {
  const query = c.req.query('q')
  if (!query) {
    return c.json({ error: 'Missing required query parameter: q' }, 400)
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100)
  const type = c.req.query('type') as 'issue' | 'milestone' | 'all' | undefined

  try {
    // Generate query embedding via Workers AI
    const embeddingResult = await c.env.AI.run('@cf/baai/bge-m3', {
      text: [query],
    }) as { data: number[][] }

    const queryEmbedding = embeddingResult.data[0]

    // Query Vectorize for semantic matches
    const vectorResults = await c.env.VECTORIZE.query(queryEmbedding, {
      topK: limit,
      filter: type && type !== 'all' ? { type } : undefined,
      returnMetadata: 'all',
    })

    // Format results
    const results = vectorResults.matches.map((match) => ({
      id: match.id,
      score: match.score,
      title: match.metadata?.title,
      type: match.metadata?.type,
      repo: match.metadata?.repo,
      status: match.metadata?.status,
      url: match.metadata?.url,
    }))

    return c.json({
      query,
      count: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return c.json({ error: 'Search failed', message: error.message }, 500)
  }
})

/**
 * POST /api/search
 * Semantic search with JSON body (for longer queries)
 */
search.post('/', async (c) => {
  const body = await c.req.json() as { query?: string; limit?: number; type?: string }
  const { query, limit: bodyLimit, type } = body

  if (!query) {
    return c.json({ error: 'Missing required field: query' }, 400)
  }

  const limit = Math.min(bodyLimit || 10, 100)

  try {
    // Generate query embedding via Workers AI
    const embeddingResult = await c.env.AI.run('@cf/baai/bge-m3', {
      text: [query],
    }) as { data: number[][] }

    const queryEmbedding = embeddingResult.data[0]

    // Query Vectorize for semantic matches
    const vectorResults = await c.env.VECTORIZE.query(queryEmbedding, {
      topK: limit,
      filter: type && type !== 'all' ? { type } : undefined,
      returnMetadata: 'all',
    })

    // Format results
    const results = vectorResults.matches.map((match) => ({
      id: match.id,
      score: match.score,
      title: match.metadata?.title,
      type: match.metadata?.type,
      repo: match.metadata?.repo,
      status: match.metadata?.status,
      url: match.metadata?.url,
    }))

    return c.json({
      query,
      count: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return c.json({ error: 'Search failed', message: error.message }, 500)
  }
})

/**
 * GET /api/search/similar/:id
 * Find similar issues/milestones to a given ID
 */
search.get('/similar/:id', async (c) => {
  const id = c.req.param('id')
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100)

  try {
    // Fetch existing vector by ID
    const existing = await c.env.VECTORIZE.getByIds([id])

    if (!existing.length || !existing[0].values) {
      return c.json({ error: 'Vector not found for the given ID' }, 404)
    }

    // Find similar vectors (excluding self)
    const vectorResults = await c.env.VECTORIZE.query(existing[0].values, {
      topK: limit + 1, // +1 to account for excluding self
      returnMetadata: 'all',
    })

    // Format results, excluding the original ID
    const results = vectorResults.matches
      .filter((match) => match.id !== id)
      .slice(0, limit)
      .map((match) => ({
        id: match.id,
        score: match.score,
        title: match.metadata?.title,
        type: match.metadata?.type,
        repo: match.metadata?.repo,
        status: match.metadata?.status,
        url: match.metadata?.url,
      }))

    return c.json({
      id,
      count: results.length,
      similar: results,
    })
  } catch (error: any) {
    console.error('Similar search error:', error)
    return c.json({ error: 'Similar search failed', message: error.message }, 500)
  }
})

export { search }
