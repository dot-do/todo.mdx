---
id: todo-a0ao
title: "Parser validateId returns untrimmed ID but validates trimmed version"
state: closed
priority: 2
type: bug
labels: ["code-review", "parser", "src", "validation"]
createdAt: "2025-12-24T11:15:09.396Z"
updatedAt: "2025-12-25T11:52:12.317Z"
closedAt: "2025-12-25T11:52:12.317Z"
source: "beads"
---

# Parser validateId returns untrimmed ID but validates trimmed version

**File:** src/parser.ts:106-121

The `validateId` function has inconsistent handling of whitespace:

```typescript
function validateId(id: unknown): string {
  if (id === null || id === undefined || id === '') {
    throw new Error('ID cannot be empty or undefined')
  }

  if (typeof id !== 'string') {
    throw new Error('ID must be a string')
  }

  const trimmed = id.trim()
  if (trimmed === '') {
    throw new Error('ID cannot be empty or whitespace-only')
  }

  return id  // Returns ORIGINAL, not trimmed!
}
```

**Impact:** IDs like `"  todo-123  "` with leading/trailing whitespace will pass validation but the whitespace will be preserved, causing ID mismatches during sync (beads likely stores trimmed IDs).

**Recommendation:** Return `trimmed` instead of `id` to normalize IDs.