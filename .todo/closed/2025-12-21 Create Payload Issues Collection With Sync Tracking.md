---
id: todo-ec45
title: "Create Payload Issues collection with sync tracking"
state: closed
priority: 1
type: task
labels: ["admin", "payload", "sync"]
createdAt: "2025-12-22T00:24:15.050Z"
updatedAt: "2025-12-22T00:31:59.178Z"
closedAt: "2025-12-22T00:31:59.178Z"
source: "beads"
dependsOn: ["todo-lk5q"]
blocks: ["todo-okux"]
---

# Create Payload Issues collection with sync tracking

Add a central Issues collection in Payload CMS to provide admin visibility and unified querying.

## Current State
- Issues exist in: beads (local), RepoDO (D1), GitHub (API)
- No Issues collection in Payload despite being referenced in types
- Admin UI can't see issue status

## Required Changes
1. Create `apps/admin/src/collections/Issues.ts`:
   - id, beadsId, githubNumber, linearId
   - title, description, status, priority, type
   - syncedTo: { beads, github, linear }
   - lastSyncAt timestamps per system
2. Add relationships to Repos, Users
3. Add to payload.config.ts collections array
4. Create migration for D1 schema

### Related Issues

**Depends on:**
- [todo-lk5q](./todo-lk5q.md)

**Blocks:**
- [todo-okux](./todo-okux.md)