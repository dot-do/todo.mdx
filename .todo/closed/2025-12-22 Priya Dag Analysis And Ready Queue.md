---
id: todo-xi5y
title: "Priya: DAG analysis and ready queue"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-22T11:49:15.379Z"
updatedAt: "2025-12-22T12:03:25.865Z"
closedAt: "2025-12-22T12:03:25.865Z"
source: "beads"
dependsOn: ["todo-29oj"]
blocks: ["todo-cob2", "todo-zxgz"]
---

# Priya: DAG analysis and ready queue

Implement dependency graph analysis:
- Build DAG from beads dependencies
- Find all ready issues (no open blockers)
- Identify critical path (longest chain to completion)
- Expose as runtime.dag.ready(), runtime.dag.criticalPath()

This is Priya's core scheduling algorithm.

### Related Issues

**Depends on:**
- [todo-29oj](./todo-29oj.md)

**Blocks:**
- [todo-cob2](./todo-cob2.md)
- [todo-zxgz](./todo-zxgz.md)