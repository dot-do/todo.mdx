---
id: todo-4qtf
title: "Update test helper defaults to production URLs"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T04:47:58.060Z"
updatedAt: "2025-12-21T04:59:51.172Z"
closedAt: "2025-12-21T04:59:51.172Z"
source: "beads"
dependsOn: ["todo-8dmr"]
blocks: ["todo-9i3u", "todo-wee0"]
---

# Update test helper defaults to production URLs

Change default base URLs in test helpers from localhost:8787 to production endpoints.

## Files to update
- `tests/helpers/worker.ts` line 6: `WORKER_BASE_URL` → `https://todo.mdx.do`
- `tests/e2e/mcp-server.test.ts` line 4: `MCP_BASE_URL` → `https://todo.mdx.do`

## Environment variables
```
WORKER_BASE_URL=https://todo.mdx.do
MCP_BASE_URL=https://todo.mdx.do
```

### Related Issues

**Depends on:**
- [todo-8dmr](./todo-8dmr.md)

**Blocks:**
- [todo-9i3u](./todo-9i3u.md)
- [todo-wee0](./todo-wee0.md)