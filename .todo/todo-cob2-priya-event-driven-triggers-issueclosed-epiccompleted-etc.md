---
id: todo-cob2
title: "Priya: Event-driven triggers (issue.closed, epic.completed, etc.)"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-22T11:49:02.122Z"
updatedAt: "2025-12-22T13:56:59.410Z"
closedAt: "2025-12-22T13:56:59.410Z"
source: "beads"
---

# Priya: Event-driven triggers (issue.closed, epic.completed, etc.)

Wire Priya to react to beads events:
- on.issue.closed → analyze DAG, find newly unblocked issues, assign agents
- on.epic.completed → close epic, post summary, consider next phase
- on.issue.blocked → flag, reassign agent to other ready work
- on.pr.merged → verify linked issue closed

Use beads-workflows hooks API.

### Related Issues

**Depends on:**
- **todo-29oj**
- **todo-xi5y**

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
