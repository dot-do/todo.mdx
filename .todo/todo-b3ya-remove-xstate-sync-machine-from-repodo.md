---
id: todo-b3ya
title: "Remove XState sync machine from RepoDO"
state: closed
priority: 2
type: chore
labels: ["cleanup", "worker"]
createdAt: "2025-12-20T23:32:11.551Z"
updatedAt: "2025-12-20T23:36:08.528Z"
closedAt: "2025-12-20T23:36:08.528Z"
source: "beads"
---

# Remove XState sync machine from RepoDO

The current XState state machine adds complexity without benefit for the new sync model.

## Current Complexity
- XState machine with idle/syncing/retrying/error states
- Event queue with ENQUEUE/PROCESS_NEXT/SYNC_COMPLETE
- Persisted state in DO storage
- Race condition bugs (todo-k2j)

## New Approach
Direct upserts with simple error handling:
```typescript
async onGitHubIssue(payload) {
  try {
    this.upsertIssue(mapGitHubToInternal(payload.issue))
    await this.commitBeadsJsonl()
  } catch (error) {
    console.error('Sync failed:', error)
    // Could add to a simple retry queue if needed
  }
}
```

## Files to modify
- `worker/src/do/repo.ts` - remove syncMachine, syncActor, related methods

## Related
- Closes todo-k2j (race condition fix no longer needed)

### Related Issues

**Depends on:**
- **todo-8ufg**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
