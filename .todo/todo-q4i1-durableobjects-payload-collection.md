---
id: todo-q4i1
title: "DurableObjects Payload collection"
state: closed
priority: 1
type: task
labels: ["foundation", "payload"]
createdAt: "2025-12-21T14:58:50.551Z"
updatedAt: "2025-12-21T15:12:17.250Z"
closedAt: "2025-12-21T15:12:17.250Z"
source: "beads"
---

# DurableObjects Payload collection

Create new Payload collection to track all active Durable Objects:

`apps/admin/src/collections/DurableObjects.ts`

Fields:
- type: select ['org', 'repo', 'project', 'pr', 'issue']
- doId: text (unique)
- ref: text ('owner/repo#123')
- state: json (XState snapshot)
- lastHeartbeat: date
- org: relationship to installations
- repo: relationship to repos
- issue: relationship to issues

Indexes on [type, lastHeartbeat] for finding stale DOs.

Add to payload.config.ts collections array.

### Related Issues

**Depends on:**
- **todo-qd32**

**Blocks:**
- **todo-0sts**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
