---
id: todo-rl4l
title: "Infinite loop potential in handleCollision function"
state: open
priority: 2
type: bug
labels: ["code-review", "patterns", "src"]
createdAt: "2025-12-24T11:14:26.261Z"
updatedAt: "2025-12-24T11:14:26.261Z"
source: "beads"
---

# Infinite loop potential in handleCollision function

**File:** src/patterns.ts:374-393

The `handleCollision` function has no upper bound on the counter, which could lead to an infinite loop if `existingFiles` is corrupted or contains a huge number of collision entries.

```typescript
function handleCollision(filename: string, existingFiles: string[]): string {
  // ...
  let counter = 1
  let candidateFilename = `${baseName}-${counter}${extension}`

  while (existingFiles.includes(candidateFilename)) {
    counter++
    candidateFilename = `${baseName}-${counter}${extension}`
  }
  // No upper limit check
}
```

**Impact:** If existingFiles array is somehow corrupted or contains malformed data, this could cause the application to hang.

**Recommendation:** Add a maximum iteration limit (e.g., 10000) and throw an error if exceeded.