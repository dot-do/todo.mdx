---
id: todo-1vuu
title: "Sync detectChanges doesn't handle deleted issues"
state: open
priority: 1
type: bug
labels: ["code-review", "feature-incomplete", "src", "sync"]
createdAt: "2025-12-24T11:15:31.214Z"
updatedAt: "2025-12-24T11:15:31.214Z"
source: "beads"
---

# Sync detectChanges doesn't handle deleted issues

**File:** src/sync.ts:146-209

The `detectChanges` function detects:
- New issues in files (needs beads create)
- New issues in beads (needs file write)
- Modified issues

But it doesn't detect or handle DELETED issues:
- If an issue exists in beads but its file was deleted, nothing happens
- If an issue was closed/deleted in beads but file still exists, nothing happens

The `SyncResult` type includes a `deleted: string[]` field but it's never populated:

```typescript
const result: SyncResult = {
  created: [],
  updated: [],
  deleted: [],  // Never modified
  filesWritten: [],
  conflicts: [],
}
```

**Impact:** Deleted issues are not synced in either direction. Users expect bidirectional sync to propagate deletions.

**Recommendation:** 
1. Detect when a file exists but beads issue doesn't (deleted from beads)
2. Detect when beads issue exists but file doesn't (deleted from files)
3. Apply conflict strategy to determine which deletion wins
4. Actually delete issues/files based on strategy