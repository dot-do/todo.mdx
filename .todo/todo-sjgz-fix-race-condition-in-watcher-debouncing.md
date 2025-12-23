---
id: todo-sjgz
title: "Fix race condition in watcher debouncing"
state: closed
priority: 1
type: bug
labels: ["race-condition", "watcher"]
createdAt: "2025-12-23T12:43:57.119Z"
updatedAt: "2025-12-23T12:53:19.560Z"
closedAt: "2025-12-23T12:53:19.560Z"
source: "beads"
---

# Fix race condition in watcher debouncing

**Issue**: Multiple timers can stack up if files change rapidly. The `isSyncing` check happens inside the timer callback, not when scheduling.

**Location**: `src/watcher.ts` lines 106-133

**Fix**:
- Clear existing timer before scheduling new one
- Track pending event to process latest change
- Prevent timer stacking with proper state management

**Test Cases**:
- Should only sync once for 10 rapid file changes
- Should process latest event, not first
- Should not start new sync while syncing
- Should queue sync if changes occur during active sync

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
