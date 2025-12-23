---
id: todo-cz6j
title: "Expose GitHub PR tools in MCP server"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-22T00:24:57.430Z"
updatedAt: "2025-12-22T00:29:24.371Z"
closedAt: "2025-12-22T00:29:24.371Z"
source: "beads"
dependsOn: ["todo-lk5q"]
---

# Expose GitHub PR tools in MCP server

Add MCP wrappers for native GitHub tools: createBranch, createPullRequest, mergePullRequest. Files: worker/src/mcp/index.ts, worker/src/tools/native/github.ts. Add Zod validation and access control.

### Related Issues

**Depends on:**
- [todo-lk5q](./todo-lk5q.md)