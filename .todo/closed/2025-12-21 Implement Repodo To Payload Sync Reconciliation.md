---
id: todo-okux
title: "Implement RepoDO to Payload sync reconciliation"
state: closed
priority: 1
type: task
labels: ["payload", "sync", "workflow"]
createdAt: "2025-12-22T00:24:20.405Z"
updatedAt: "2025-12-22T06:49:34.346Z"
closedAt: "2025-12-22T06:49:34.346Z"
source: "beads"
dependsOn: ["todo-ec45", "todo-lk5q"]
---

# Implement RepoDO to Payload sync reconciliation

Create periodic job to sync issues from RepoDO to Payload Issues collection.

## Current State
- RepoDO has all issue data per repo
- Payload has no visibility into RepoDO issues
- No reconciliation between systems

## Required Changes
1. Create `worker/src/workflows/reconcile.ts` Cloudflare Workflow
2. Query all repos from Payload
3. For each repo, get RepoDO stub and fetch issues
4. Upsert to Payload Issues collection
5. Track lastSyncAt, detect conflicts
6. Schedule via cron (every 5 minutes)

### Related Issues

**Depends on:**
- [todo-ec45](./todo-ec45.md)
- [todo-lk5q](./todo-lk5q.md)