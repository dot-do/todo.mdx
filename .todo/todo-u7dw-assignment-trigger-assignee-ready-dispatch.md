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
---

# Assignment trigger: assignee + ready → dispatch

Wire assignment to workflow dispatch:
- When issue.assignee is an agent AND issue has no blockers
- Trigger DevelopWorkflow for that agent
- Pass agent config (capabilities, focus, autonomy) to workflow
- Handle re-assignment (cancel previous, start new)

### Related Issues

**Depends on:**
- **todo-vr3**
- **todo-oq8w**

**Blocks:**
- **todo-29oj**

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
