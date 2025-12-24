---
id: todo-ljby
title: "Security: constantTimeCompare leaks length information"
state: open
priority: 2
type: bug
labels: ["code-review", "security", "worker"]
createdAt: "2025-12-24T11:14:56.096Z"
updatedAt: "2025-12-24T11:14:56.096Z"
source: "beads"
---

# Security: constantTimeCompare leaks length information

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/webhook.ts:73-84`

**Problem:** The `constantTimeCompare` function returns `false` immediately if the lengths differ. This leaks timing information about the expected signature length, which partially defeats the purpose of constant-time comparison.

**Code:**
```typescript
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false  // Early exit leaks length info
  }
  // ...
}
```

**Impact:** An attacker could potentially use timing attacks to determine the expected signature length, though the practical impact is limited since HMAC-SHA256 signatures always produce 64 hex characters.

**Recommended Fix:** Either:
1. Pad the shorter string to match the longer one before comparison
2. Or XOR against a fixed-length hash of the expected signature