---
id: todo-h5ie
title: "ToolExecutions Payload collection (audit log)"
state: closed
priority: 2
type: task
labels: ["foundation", "payload"]
createdAt: "2025-12-21T14:58:56.020Z"
updatedAt: "2025-12-21T16:10:47.375Z"
closedAt: "2025-12-21T16:10:47.375Z"
source: "beads"
dependsOn: ["todo-qd32", "todo-7t0g"]
---

# ToolExecutions Payload collection (audit log)

Create new Payload collection for tool execution audit log:

`apps/admin/src/collections/ToolExecutions.ts`

Fields:
- doId: text
- tool: text ('GitHub.createPullRequest')
- params: json
- result: json
- error: text
- durationMs: number
- executedAt: date
- user: relationship to users
- connection: relationship to connections

Add to payload.config.ts collections array.

### Related Issues

**Depends on:**
- [todo-qd32](./todo-qd32.md)
- [todo-7t0g](./todo-7t0g.md)