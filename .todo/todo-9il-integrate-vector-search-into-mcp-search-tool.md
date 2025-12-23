---
id: todo-9il
title: "Integrate vector search into MCP `search` tool"
state: closed
priority: 2
type: feature
labels: ["mcp", "search", "vectorize"]
createdAt: "2025-12-20T18:52:16.232Z"
updatedAt: "2025-12-20T19:05:35.383Z"
closedAt: "2025-12-20T19:05:35.383Z"
source: "beads"
---

# Integrate vector search into MCP `search` tool

Update the MCP `search` tool to use Vectorize for semantic search instead of (or in addition to) keyword matching.

## Current Implementation
`worker/src/mcp/index.ts` - search tool does keyword matching:
```typescript
const matchesQuery =
  issue.title?.toLowerCase().includes(query) ||
  issue.body?.toLowerCase().includes(query)
```

## New Implementation

### Hybrid Search Strategy
1. Generate query embedding via Workers AI
2. Query Vectorize for top-K similar vectors
3. Optionally combine with keyword results for hybrid ranking

### Updated Search Tool
```typescript
this.server.tool(
  'search',
  'Semantic search across issues and projects',
  {
    query: z.string().describe('Natural language search query'),
    limit: z.number().optional().default(10),
    type: z.enum(['issue', 'milestone', 'all']).optional()
  },
  async ({ query, limit, type }) => {
    // Generate query embedding
    const queryEmbedding = await env.AI.run('@cf/baai/bge-m3', {
      text: [query]
    })

    // Vector search
    const results = await env.VECTORIZE.query(queryEmbedding.data[0], {
      topK: limit,
      filter: type !== 'all' ? { type } : undefined,
      returnMetadata: true
    })

    // Format results per ChatGPT spec
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results.matches.map(m => ({
          id: m.id,
          title: m.metadata?.title,
          url: m.metadata?.url,
          score: m.score
        })))
      }]
    }
  }
)
```

## Considerations
- Cache query embeddings for repeated searches
- Consider hybrid: vector search + keyword boost
- Add relevance score to results

### Related Issues

**Depends on:**
- **todo-4j2**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
