---
id: todo-oq8w
title: "Cloud sync for agent configurations"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-22T11:46:48.988Z"
updatedAt: "2025-12-22T13:14:53.725Z"
closedAt: "2025-12-22T13:14:53.725Z"
source: "beads"
dependsOn: ["todo-vr3", "todo-n0hn"]
blocks: ["todo-u7dw"]
---

# Cloud sync for agent configurations

Sync agent definitions between repo and cloud:
- Push agents.mdx changes to todo.mdx.do on git push
- Merge with pre-built cloud agents
- Store runtime state (active sessions, capacity) in cloud
- Dashboard shows agent status but repo config is source of truth

### Related Issues

**Depends on:**
- [todo-vr3](./todo-vr3.md)
- [todo-n0hn](./todo-n0hn.md)

**Blocks:**
- [todo-u7dw](./todo-u7dw.md)