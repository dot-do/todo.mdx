---
id: todo-wp86
title: "Add retry/polling logic for webhook processing"
state: closed
priority: 2
type: task
labels: []
createdAt: "2025-12-21T04:47:58.663Z"
updatedAt: "2025-12-21T05:07:45.559Z"
closedAt: "2025-12-21T05:07:45.559Z"
source: "beads"
---

# Add retry/polling logic for webhook processing

Replace fixed `setTimeout(2000-3000)` waits with retry/polling logic for more reliable tests.

## Current problem
Tests use arbitrary delays waiting for webhook processing:
```typescript
await new Promise(r => setTimeout(r, 2000))
```

## Better approach
```typescript
await waitFor(async () => {
  const issue = await getIssue(id)
  return issue.status === 'synced'
}, { timeout: 10000, interval: 500 })
```

## Files affected
- github-sync.test.ts
- beads-sync-roundtrip.test.ts
- milestones-sync.test.ts
- linear-integration.test.ts

## Benefits
- Faster tests when processing is quick
- More reliable when processing is slow
- Clear timeout errors instead of silent failures

### Related Issues

**Depends on:**
- **todo-8dmr**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
