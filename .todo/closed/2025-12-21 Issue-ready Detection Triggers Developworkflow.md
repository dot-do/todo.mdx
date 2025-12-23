---
id: todo-dexj
title: "Issue-ready detection triggers DevelopWorkflow"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:41:21.425Z"
updatedAt: "2025-12-21T19:07:12.879Z"
closedAt: "2025-12-21T19:07:12.879Z"
source: "beads"
dependsOn: ["todo-d502", "todo-lbbd", "todo-yy2h"]
blocks: ["todo-addd"]
---

# Issue-ready detection triggers DevelopWorkflow

When an issue becomes ready (all deps closed), spawn DevelopWorkflow.

Trigger points:
1. Issue closed → check if any dependents now unblocked
2. Issue created with no deps → immediately ready
3. Dependency removed → check if now unblocked

Implementation in RepoDO:
- On issue state change, query ready issues
- For newly ready issues, spawn workflow instance

### Related Issues

**Depends on:**
- [todo-d502](./todo-d502.md)
- [todo-lbbd](./todo-lbbd.md)
- [todo-yy2h](./todo-yy2h.md)

**Blocks:**
- [todo-addd](./todo-addd.md)