---
id: todo-d06d
title: "IssueDO XState machine for task execution"
state: closed
priority: 1
type: task
labels: ["do", "xstate"]
createdAt: "2025-12-21T14:59:12.714Z"
updatedAt: "2025-12-21T16:10:58.047Z"
closedAt: "2025-12-21T16:10:58.047Z"
source: "beads"
---

# IssueDO XState machine for task execution

Create IssueDO with XState machine for task execution lifecycle:

`worker/src/do/issue.ts`
`worker/src/do/machines/issue.ts`

States: idle → preparing → executing → verifying → done
Also: blocked, failed

Events:
- ASSIGN_AGENT: trigger agent assignment
- TOOLS_READY / TOOLS_MISSING: from preparing
- COMPLETED / FAILED / TIMEOUT: from executing
- VERIFIED / REJECTED: from verifying

Endpoints:
- POST /assign-agent - trigger agent assignment
- GET /state - return current XState snapshot
- POST /cancel - abort execution

Integrates with existing Claude sandbox for execution.

### Related Issues

**Depends on:**
- **todo-qd32**
- **todo-0sts**
- **todo-xi84**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
