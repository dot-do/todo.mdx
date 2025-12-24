---
id: todo-3lkg
title: "Uncaught errors in watcher debounce callback can crash process"
state: open
priority: 1
type: bug
labels: ["code-review", "error-handling", "src", "watcher"]
createdAt: "2025-12-24T11:14:42.291Z"
updatedAt: "2025-12-24T11:14:42.291Z"
source: "beads"
---

# Uncaught errors in watcher debounce callback can crash process

**File:** src/watcher.ts:112-151

The setTimeout callback in `triggerSync` catches errors from `sync()` but not from `onChange()`:

```typescript
state.debounceTimer = setTimeout(async () => {
  // ...
  try {
    state.isSyncing = true

    // Emit change event - NOT in try/catch!
    if (onChange) {
      onChange(event)  // If this throws, isSyncing stays true forever
    }

    // Perform sync
    await sync({...})
  } catch (error) {
    console.error('Sync failed:', error)
  } finally {
    state.isSyncing = false
    // ...
  }
}, debounceMs)
```

**Impact:** If `onChange` callback throws:
1. `isSyncing` remains true forever, blocking all future syncs
2. The `finally` block never runs
3. Pending events are never processed

**Recommendation:** Wrap the `onChange` call in its own try/catch, or move it inside the existing try block.