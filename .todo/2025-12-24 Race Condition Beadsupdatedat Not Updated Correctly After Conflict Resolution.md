---
id: todo-bqc2
title: "Race condition: beadsUpdatedAt not updated correctly after conflict resolution"
state: open
priority: 1
type: bug
labels: ["code-review", "sync", "worker"]
createdAt: "2025-12-24T11:15:23.082Z"
updatedAt: "2025-12-24T11:15:23.082Z"
source: "beads"
---

# Race condition: beadsUpdatedAt not updated correctly after conflict resolution

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/sync-orchestrator.ts:463-468`

**Problem:** When GitHub wins conflict resolution, the mapping is updated with the old `beadsIssue.updatedAt` instead of the new timestamp from the updated beads issue.

**Code:**
```typescript
if (resolution === 'github') {
  // Update beads from GitHub
  const convertedBeads = convertGitHubToBeads(ghIssue, { ... })
  await beadsOps.updateIssue(beadsIssue.id!, convertedBeads)

  await mappingOps.updateMapping(mapping.$id, {
    lastSyncedAt: new Date().toISOString(),
    beadsUpdatedAt: beadsIssue.updatedAt,  // BUG: Uses OLD timestamp
    githubUpdatedAt: ghIssue.updated_at,
  })
}
```

**Impact:** The `beadsUpdatedAt` in the mapping won't reflect the actual updated timestamp of the beads issue after the sync, which could cause:
1. Incorrect conflict detection in subsequent syncs
2. Unnecessary re-syncing of already-synced issues
3. Potential sync loops

**Recommended Fix:** Use the updatedAt from the converted beads issue or re-fetch after update:
```typescript
const updated = await beadsOps.updateIssue(beadsIssue.id!, convertedBeads)
await mappingOps.updateMapping(mapping.$id, {
  lastSyncedAt: new Date().toISOString(),
  beadsUpdatedAt: updated.updatedAt,  // Use actual updated timestamp
  githubUpdatedAt: ghIssue.updated_at,
})
```