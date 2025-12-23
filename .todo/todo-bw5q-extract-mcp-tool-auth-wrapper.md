---
id: todo-bw5q
title: "Extract MCP tool auth wrapper"
state: closed
priority: 2
type: chore
labels: ["mcp", "refactor", "worker"]
createdAt: "2025-12-22T08:05:53.307Z"
updatedAt: "2025-12-22T08:12:55.118Z"
closedAt: "2025-12-22T08:12:55.118Z"
source: "beads"
---

# Extract MCP tool auth wrapper

worker/src/mcp/index.ts has 20+ tool definitions repeating the same pattern:
1. Auth check
2. Get user repos
3. Verify access
4. Call RepoDO
5. Return result or error

Create withRepoAccess() higher-order function to reduce boilerplate.

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
