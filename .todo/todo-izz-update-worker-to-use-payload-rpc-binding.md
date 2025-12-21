---
id: todo-izz
title: "Update worker to use Payload RPC binding"
state: closed
priority: 1
type: task
labels: []
---

# Update worker to use Payload RPC binding

Remove Drizzle/direct D1 access from worker. Add PAYLOAD service binding to wrangler.toml. Update all data access to use env.PAYLOAD.payload() RPC calls.

### Timeline

- **Created:** 12/20/2025

