---
id: todo-izz
title: "Update worker to use Payload RPC binding"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-20T15:09:31.755Z"
updatedAt: "2025-12-20T17:35:36.878Z"
closedAt: "2025-12-20T17:35:36.878Z"
source: "beads"
dependsOn: ["todo-8mg"]
---

# Update worker to use Payload RPC binding

Remove Drizzle/direct D1 access from worker. Add PAYLOAD service binding to wrangler.toml. Update all data access to use env.PAYLOAD.payload() RPC calls.

### Related Issues

**Depends on:**
- [todo-8mg](./todo-8mg.md)