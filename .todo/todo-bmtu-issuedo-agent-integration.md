---
id: todo-bmtu
title: "IssueDO agent integration"
state: closed
priority: 1
type: task
labels: ["agents", "do"]
createdAt: "2025-12-21T18:47:56.881Z"
updatedAt: "2025-12-21T22:05:21.307Z"
closedAt: "2025-12-21T22:05:21.307Z"
source: "beads"
---

# IssueDO agent integration

Integrate agents into IssueDO:

`worker/src/do/issue.ts`

- Add session?: Agent property
- assignAgent(agentId): get agent via RPC, store in session
- startWork(): call session.do() with YAML-formatted task
- Stream events to persistence and WebSocket
- Update XState machine transitions

State flow:
idle → assigned → todo → preparing → executing → verifying → done

Issue must be assigned to agent AND moved to 'todo' to trigger work.

### Related Issues

**Depends on:**
- **todo-ygfz**
- **todo-1kwc**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
