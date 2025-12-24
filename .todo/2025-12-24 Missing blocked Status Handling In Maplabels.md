---
id: todo-9snk
title: "Missing 'blocked' status handling in mapLabels"
state: open
priority: 3
type: task
labels: ["code-review", "feature-gap", "worker"]
createdAt: "2025-12-24T11:15:55.081Z"
updatedAt: "2025-12-24T11:15:55.081Z"
source: "beads"
---

# Missing 'blocked' status handling in mapLabels

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/label-mapper.ts:25-84`

**Problem:** The `mapLabels` function maps to `open`, `in_progress`, or `closed` status, but beads supports a `blocked` status that is never set from GitHub labels.

**Code:**
```typescript
export interface MappedFields {
  type: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  priority: 0 | 1 | 2 | 3 | 4
  status: 'open' | 'in_progress' | 'closed'  // Missing 'blocked'
  remainingLabels: string[]
}
```

**Also in conventions.ts:**
```typescript
labels: {
  status: { inProgress?: string }  // No blocked label support
}
```

**Impact:** Issues with 'blocked' status in beads will lose that status when synced round-trip through GitHub. There's no way to mark an issue as blocked via GitHub labels.

**Recommended Fix:** Add blocked status support to conventions:
```typescript
status: { 
  inProgress?: string
  blocked?: string  // e.g., 'status:blocked'
}
```

And update mapLabels to check for blocked label.