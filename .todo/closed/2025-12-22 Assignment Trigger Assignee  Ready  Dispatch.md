---
id: todo-u7dw
title: "Assignment trigger: assignee + ready → dispatch"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-22T11:46:55.052Z"
updatedAt: "2025-12-22T12:43:34.990Z"
closedAt: "2025-12-22T12:43:34.990Z"
source: "beads"
dependsOn: ["todo-vr3", "todo-oq8w"]
blocks: ["todo-29oj"]
---

# Assignment trigger: assignee + ready → dispatch

Wire assignment to workflow dispatch:
- When issue.assignee is an agent AND issue has no blockers
- Trigger DevelopWorkflow for that agent
- Pass agent config (capabilities, focus, autonomy) to workflow
- Handle re-assignment (cancel previous, start new)

### Related Issues

**Depends on:**
- [todo-vr3](./todo-vr3.md)
- [todo-oq8w](./todo-oq8w.md)

**Blocks:**
- [todo-29oj](./todo-29oj.md)