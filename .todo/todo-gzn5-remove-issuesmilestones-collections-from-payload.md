---
id: todo-gzn5
title: "Remove Issues/Milestones collections from Payload"
state: closed
priority: 2
type: task
labels: ["cleanup", "payload"]
createdAt: "2025-12-20T23:32:11.283Z"
updatedAt: "2025-12-21T21:35:25.188Z"
closedAt: "2025-12-21T21:35:25.188Z"
source: "beads"
---

# Remove Issues/Milestones collections from Payload

With RepoDO as the source of truth, Payload no longer needs Issues/Milestones collections.

## Collections to Remove
- `apps/admin/src/collections/Issues.ts`
- `apps/admin/src/collections/Milestones.ts`

## Files to Update
- `apps/admin/src/payload.config.ts` - remove from collections array
- `apps/admin/src/payload-types.ts` - regenerate
- `worker/src/mcp/index.ts` - remove Payload issue queries
- `worker/src/do/repo.ts` - remove syncToPayload()

## Collections to Keep
- Users - authentication
- Installations - GitHub App installs
- Repos - repository metadata
- Media - file uploads
- SyncEvents - audit log (optional, could move to DO)

## Migration
- No data migration needed (RepoDO is new source of truth)
- Run Payload migrations to drop tables

### Related Issues

**Depends on:**
- **todo-8ufg**
- **todo-fnmo**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
