/**
 * Search API - Hybrid search using Vectorize + keyword matching
 */

import { Hono } from 'hono'
import type { Env } from '../types.js'

const search = new Hono<{ Bindings: Env }>()

interface SearchResult {
  id: string
  score?: number
  title?: string
  type?: string
  repo?: string
  status?: string
  url?: string
}

/**
 * Perform hybrid search combining vector and keyword matching
 */
async function hybridSearch(
  env: Env,
  query: string,
  limit: number,
  type?: string
): Promise<SearchResult[]> {
  const resultsMap = new Map<string, SearchResult>()
  const queryLower = query.toLowerCase()

  // 1. Vector search (semantic) - gracefully handle if Vectorize is empty/unavailable
  try {
    const embeddingResult = await env.AI.run('@cf/baai/bge-m3', {
      text: [query],
    }) as { data: number[][] }

    const queryEmbedding = embeddingResult.data[0]

    const vectorResults = await env.VECTORIZE.query(queryEmbedding, {
      topK: Math.min(limit, 50),
      filter: type && type !== 'all' ? { type } : undefined,
      returnMetadata: 'all',
    })

    for (const match of vectorResults.matches) {
      if (!resultsMap.has(match.id)) {
        resultsMap.set(match.id, {
          id: match.id,
          score: match.score,
          title: match.metadata?.title as string | undefined,
          type: match.metadata?.type as string | undefined,
          repo: match.metadata?.repo as string | undefined,
          status: match.metadata?.status as string | undefined,
          url: match.metadata?.url as string | undefined,
        })
      }
    }
  } catch (vectorError) {
    console.log('Vector search unavailable, using keyword search only:', vectorError)
  }

  // 2. Keyword search via Payload (for issues not yet in Vectorize)
  try {
    // Search issues collection
    if (!type || type === 'all' || type === 'issue') {
      const issuesResult = await env.PAYLOAD.find({
        collection: 'issues',
        where: {
          or: [
            { title: { contains: query } },
            { body: { contains: query } },
          ],
        },
        limit: limit,
      })

      for (const issue of (issuesResult.docs || []) as any[]) {
        const issueId = `issue:${issue.repo?.fullName || 'unknown'}:${issue.githubNumber || issue.id}`
        if (!resultsMap.has(issueId)) {
          resultsMap.set(issueId, {
            id: issueId,
            title: issue.title,
            type: 'issue',
            repo: issue.repo?.fullName,
            status: issue.state || issue.status,
            url: issue.htmlUrl || `https://github.com/${issue.repo?.fullName}/issues/${issue.githubNumber}`,
          })
        }
      }
    }

    // Search milestones collection
    if (!type || type === 'all' || type === 'milestone') {
      const milestonesResult = await env.PAYLOAD.find({
        collection: 'milestones',
        where: {
          or: [
            { title: { contains: query } },
            { description: { contains: query } },
          ],
        },
        limit: limit,
      })

      for (const milestone of (milestonesResult.docs || []) as any[]) {
        const milestoneId = `milestone:${milestone.repo?.fullName || 'unknown'}:${milestone.githubNumber || milestone.id}`
        if (!resultsMap.has(milestoneId)) {
          resultsMap.set(milestoneId, {
            id: milestoneId,
            title: milestone.title,
            type: 'milestone',
            repo: milestone.repo?.fullName,
            status: milestone.state,
            url: milestone.htmlUrl,
          })
        }
      }
    }
  } catch (keywordError) {
    console.log('Keyword search error:', keywordError)
  }

  // Sort by score (vector results first) and limit
  return Array.from(resultsMap.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
}

/**
 * GET /api/search?q=...&limit=10&type=issue|milestone|all
 * Hybrid search across issues and milestones
 */
search.get('/', async (c) => {
  const query = c.req.query('q')
  if (!query) {
    return c.json({ error: 'Missing required query parameter: q' }, 400)
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100)
  const type = c.req.query('type') as 'issue' | 'milestone' | 'all' | undefined

  try {
    const results = await hybridSearch(c.env, query, limit, type)

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
 * Hybrid search with JSON body (for longer queries)
 */
search.post('/', async (c) => {
  const body = await c.req.json() as { query?: string; limit?: number; type?: string }
  const { query, limit: bodyLimit, type } = body

  if (!query) {
    return c.json({ error: 'Missing required field: query' }, 400)
  }

  const limit = Math.min(bodyLimit || 10, 100)

  try {
    const results = await hybridSearch(c.env, query, limit, type)

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
