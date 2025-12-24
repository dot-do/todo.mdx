---
id: todo-0raa
title: "Race condition: watcher can process events during shutdown"
state: open
priority: 1
type: bug
labels: ["code-review", "race-condition", "src", "watcher"]
createdAt: "2025-12-24T11:14:31.593Z"
updatedAt: "2025-12-24T11:14:31.593Z"
source: "beads"
---

# Race condition: watcher can process events during shutdown

**File:** src/watcher.ts:226-243

The watcher's `close()` method has a race condition. After setting `isReady = false` at the end, there's a window where:
1. A debounced callback could fire before watchers are closed
2. `pendingEvent` could be set by a concurrent event before being cleared

```typescript
async close() {
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer)
  }
  state.pendingEvent = undefined  // Race: could be set again here

  await Promise.all([
    state.beadsWatcher?.close(),
    state.todoWatcher?.close(),
  ])

  state.isReady = false  // Should be set FIRST
}
```

**Impact:** Sync operations could be triggered during/after shutdown, potentially causing errors or data corruption.

**Recommendation:** Set `isReady = false` at the START of close(), before clearing timers and pending events.