---
id: todo-w6ra
title: "Add Linear webhook handlers for bidirectional sync"
state: closed
priority: 1
type: task
labels: ["linear", "sync", "webhooks"]
createdAt: "2025-12-22T00:24:25.758Z"
updatedAt: "2025-12-22T06:49:22.076Z"
closedAt: "2025-12-22T06:49:22.076Z"
source: "beads"
dependsOn: ["todo-lk5q"]
---

# Add Linear webhook handlers for bidirectional sync

Implement webhook handlers for Linear events to enable bidirectional sync.

## Current State
- LinearIntegrations collection exists with webhook secrets
- No webhook handlers in worker
- Linear sync is read-only (API calls out, nothing comes in)

## Required Changes
1. Add Linear webhook route in `worker/src/index.ts`
2. Implement signature verification
3. Handle events:
   - Issue created → create in RepoDO + GitHub
   - Issue updated → sync status/title/labels
   - Issue deleted → close in other systems
   - Comment added → sync to GitHub
4. Add to LinearIntegrations: lastWebhookAt timestamp

### Related Issues

**Depends on:**
- [todo-lk5q](./todo-lk5q.md)