---
id: todo-fnmo
title: "Update MCP tools to query RepoDO instead of Payload"
state: closed
priority: 1
type: task
labels: ["mcp", "worker"]
createdAt: "2025-12-20T23:32:11.018Z"
updatedAt: "2025-12-20T23:40:14.197Z"
closedAt: "2025-12-20T23:40:14.197Z"
source: "beads"
dependsOn: ["todo-8ufg", "todo-3zw8"]
blocks: ["todo-gzn5"]
---

# Update MCP tools to query RepoDO instead of Payload

MCP tools should query RepoDO directly for issue data, not Payload.

## Current Flow
```
MCP tool → Payload RPC → D1 → response
```

## New Flow
```
MCP tool → RepoDO → SQLite → response
```

## Tools to Update
- `search` - query RepoDO issues table
- `fetch` - get issue details from RepoDO
- `roadmap` - query dependencies from RepoDO
- `do` - create/update via RepoDO (which syncs to GitHub)

## Implementation
```typescript
// In TodoMCP
async handleSearch(query: string) {
  const repos = await this.getUserRepos(env, workosUserId)
  
  const results = []
  for (const repo of repos) {
    const repoDO = env.REPO.get(env.REPO.idFromName(repo.fullName))
    const response = await repoDO.fetch(new Request('http://internal/search', {
      method: 'POST',
      body: JSON.stringify({ query })
    }))
    results.push(...await response.json())
  }
  
  return results
}
```

## Files to modify
- `worker/src/mcp/index.ts` - update tool handlers
- `worker/src/do/repo.ts` - add search/query endpoints

### Related Issues

**Depends on:**
- [todo-8ufg](./todo-8ufg.md)
- [todo-3zw8](./todo-3zw8.md)

**Blocks:**
- [todo-gzn5](./todo-gzn5.md)