---
id: todo-1wm2
title: "Native Linear tools"
state: closed
priority: 2
type: task
labels: ["native", "tools"]
createdAt: "2025-12-21T14:59:23.605Z"
updatedAt: "2025-12-21T16:10:36.710Z"
closedAt: "2025-12-21T16:10:36.710Z"
source: "beads"
dependsOn: ["todo-qd32", "todo-76xz"]
---

# Native Linear tools

Implement native Linear tools using existing OAuth:

`worker/src/tools/native/linear.ts`

Tools:
- linear.createIssue({ title, teamId, description?, priority?, state? })
- linear.updateIssue({ issueId, title?, description?, priority?, state? })
- linear.addComment({ issueId, body })
- linear.listIssues({ teamId, state? })
- linear.createProject({ name, teamId, description? })

Use existing Linear OAuth tokens from connection.

### Related Issues

**Depends on:**
- [todo-qd32](./todo-qd32.md)
- [todo-76xz](./todo-76xz.md)