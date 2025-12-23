---
id: todo-b5z
title: "Fix N+1 query in MCP search tool"
state: closed
priority: 1
type: bug
labels: ["performance", "worker"]
assignee: "agent-4"
createdAt: "2025-12-20T20:02:54.485Z"
updatedAt: "2025-12-20T20:14:43.640Z"
closedAt: "2025-12-20T20:14:43.640Z"
source: "beads"
---

# Fix N+1 query in MCP search tool

In src/mcp/index.ts:49-76, sequential Durable Object calls in loop cause slow response times with multiple repos. Parallelize with Promise.all().

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
