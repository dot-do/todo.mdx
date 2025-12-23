---
id: todo-lbbd
title: "Wire callClaude() to ClaudeSandbox DO"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:41:10.726Z"
updatedAt: "2025-12-21T19:07:12.878Z"
closedAt: "2025-12-21T19:07:12.878Z"
source: "beads"
dependsOn: ["todo-d502"]
blocks: ["todo-dexj"]
---

# Wire callClaude() to ClaudeSandbox DO

Route `callClaude()` in agents.mdx cloud transport to the ClaudeSandbox Durable Object.

Currently throws: `throw new Error('callClaude not implemented')`

Implementation:
1. Get ClaudeSandbox DO stub from env
2. Call sandbox.run() with task, repo, context
3. Return result with diff/summary

### Related Issues

**Depends on:**
- [todo-d502](./todo-d502.md)

**Blocks:**
- [todo-dexj](./todo-dexj.md)