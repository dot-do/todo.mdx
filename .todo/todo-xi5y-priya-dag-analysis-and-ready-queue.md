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
- **todo-29oj**

**Blocks:**
- **todo-cob2**
- **todo-zxgz**

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
