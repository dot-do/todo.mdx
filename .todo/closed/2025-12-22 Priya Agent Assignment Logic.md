---
id: todo-zxgz
title: "Priya: Agent assignment logic"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-22T11:49:21.460Z"
updatedAt: "2025-12-22T13:58:23.258Z"
closedAt: "2025-12-22T13:58:23.258Z"
source: "beads"
dependsOn: ["todo-29oj", "todo-xi5y", "todo-4xkm"]
---

# Priya: Agent assignment logic

Implement Priya's assignment algorithm:
1. Get ready issues from DAG
2. For each issue, find best-fit agent (capabilities, focus area)
3. Assign: bd update <id> --assignee=<agent>
4. Assignment triggers DevelopWorkflow (via agents.mdx trigger)

No artificial capacity limits - DAG structure is the natural throttle.

### Related Issues

**Depends on:**
- [todo-29oj](./todo-29oj.md)
- [todo-xi5y](./todo-xi5y.md)
- [todo-4xkm](./todo-4xkm.md)