---
id: todo-4j2
title: "Set up Vectorize index with Workers AI bge-m3 embeddings"
state: closed
priority: 1
type: task
labels: [search, vectorize, workers-ai]
---

# Set up Vectorize index with Workers AI bge-m3 embeddings

Configure Cloudflare Vectorize with Workers AI embedding model for semantic search.

## Setup Required

### 1. Create Vectorize Index
```bash
wrangler vectorize create todo-embeddings --dimensions=1024 --metric=cosine
```

Note: `@cf/baai/bge-m3` outputs 1024-dimensional vectors.

### 2. Add Bindings to wrangler.jsonc
```jsonc
{
  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "todo-embeddings"
    }
  ],
  "ai": {
    "binding": "AI"
  }
}
```

### 3. Update Types
Add to `worker/src/types.ts`:
```typescript
interface Env {
  // ... existing
  VECTORIZE: VectorizeIndex
  AI: Ai
}
```

## Embedding Model
- Model: `@cf/baai/bge-m3`
- Dimensions: 1024
- Good for: multilingual, semantic similarity
- [Docs](https://developers.cloudflare.com/workers-ai/models/bge-m3/)

## Vector Schema
Each vector should include metadata:
```typescript
{
  id: string           // issue/milestone ID
  values: number[]     // 1024-dim embedding
  metadata: {
    type: 'issue' | 'milestone'
    repo: string
    title: string
    status: string
    url: string
  }
}
```

### Related Issues

**Blocks:**
- **todo-9il**: Integrate vector search into MCP `search` tool
- **todo-kdl**: Create Cloudflare Workflow for embedding generation
- **todo-pt4**: Integrate vector search into REST API endpoints

### Timeline

- **Created:** 12/20/2025

