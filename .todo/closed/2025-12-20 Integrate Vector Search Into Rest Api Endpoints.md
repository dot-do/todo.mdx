---
id: todo-pt4
title: "Integrate vector search into REST API endpoints"
state: closed
priority: 2
type: feature
labels: ["api", "search", "vectorize"]
createdAt: "2025-12-20T18:52:16.322Z"
updatedAt: "2025-12-20T19:06:54.266Z"
closedAt: "2025-12-20T19:06:54.266Z"
source: "beads"
dependsOn: ["todo-4j2"]
---

# Integrate vector search into REST API endpoints

Add semantic search endpoints to the REST API using Vectorize.

## New API Endpoints

### GET /api/search
```typescript
// worker/src/api/search.ts
app.get('/search', async (c) => {
  const query = c.req.query('q')
  const limit = parseInt(c.req.query('limit') || '10')
  const type = c.req.query('type') // 'issue' | 'milestone' | 'all'

  // Generate embedding
  const embedding = await c.env.AI.run('@cf/baai/bge-m3', {
    text: [query]
  })

  // Query Vectorize
  const results = await c.env.VECTORIZE.query(embedding.data[0], {
    topK: limit,
    filter: type ? { type } : undefined,
    returnMetadata: true
  })

  return c.json({
    query,
    results: results.matches.map(m => ({
      id: m.id,
      score: m.score,
      ...m.metadata
    }))
  })
})
```

### POST /api/search (for longer queries)
Same as above but accepts JSON body with query text.

### GET /api/similar/:id
Find similar issues/milestones:
```typescript
app.get('/similar/:id', async (c) => {
  const id = c.req.param('id')
  
  // Fetch existing vector
  const existing = await c.env.VECTORIZE.getByIds([id])
  if (!existing.length) return c.json({ error: 'Not found' }, 404)

  // Find similar (excluding self)
  const results = await c.env.VECTORIZE.query(existing[0].values, {
    topK: 11, // +1 to exclude self
    returnMetadata: true
  })

  return c.json({
    id,
    similar: results.matches
      .filter(m => m.id !== id)
      .slice(0, 10)
  })
})
```

## Authentication
- Public search: rate-limited, no auth
- Authenticated search: uses user's repo access to filter results

### Related Issues

**Depends on:**
- [todo-4j2](./todo-4j2.md)