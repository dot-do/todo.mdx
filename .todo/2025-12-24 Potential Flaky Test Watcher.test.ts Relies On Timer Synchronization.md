---
id: todo-gt7k
title: "Potential flaky test: watcher.test.ts relies on timer synchronization"
state: open
priority: 3
type: task
labels: ["code-review", "flaky-tests", "tests"]
createdAt: "2025-12-24T11:15:25.236Z"
updatedAt: "2025-12-24T11:15:25.236Z"
source: "beads"
---

# Potential flaky test: watcher.test.ts relies on timer synchronization

**Location:** /Users/nathanclevenger/projects/todo.mdx/tests/watcher.test.ts

**Problem:** The watcher tests heavily use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` with precise timing expectations. While this is generally acceptable, several patterns could cause flakiness:

1. **Race conditions in async timing:**
```typescript
vi.advanceTimersByTime(150)
await vi.runAllTimersAsync()
expect(sync).toHaveBeenCalledTimes(1)
```

2. **Timer-based assertions** that depend on exact microtask scheduling:
```typescript
queueMicrotask(() => watcher.emit('ready'))
```

3. **Complex sync promise chains** in tests like `serialize multiple overlapping sync operations` that depend on specific resolution order.

**Risk:** Tests may pass locally but fail in CI due to:
- Different event loop behaviors
- Load-dependent timing differences
- Node.js version variations in microtask handling

**Recommendation:** Consider adding explicit sync points or using more robust async testing patterns that don't depend on precise timing.