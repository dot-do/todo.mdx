---
id: todo-8tpg
title: "Expose GitHub PR tools in MCP server"
state: closed
priority: 0
type: task
labels: ["github", "mcp", "p0-blocker"]
createdAt: "2025-12-22T00:24:09.687Z"
updatedAt: "2025-12-22T08:41:41.105Z"
closedAt: "2025-12-22T08:41:41.105Z"
source: "beads"
---

# Expose GitHub PR tools in MCP server

Add MCP tool wrappers for existing native GitHub tools to enable autonomous PR workflow.

## Current State
- Native tools exist in `worker/src/tools/native/github.ts`:
  - `github.createBranch()`
  - `github.createPullRequest()`
  - `github.mergePullRequest()`
- These are NOT exposed in MCP server (`worker/src/mcp/index.ts`)

## Required Changes
1. Add `create_branch` MCP tool
2. Add `create_pull_request` MCP tool  
3. Add `merge_pull_request` MCP tool
4. Add proper input validation (Zod schemas)
5. Add access control (verify user has repo access)

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
