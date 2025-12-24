---
id: todo-2ys6
title: "Bug: generateId uses Math.random() which is not cryptographically secure"
state: open
priority: 2
type: bug
labels: ["code-review", "security", "worker"]
createdAt: "2025-12-24T11:15:01.428Z"
updatedAt: "2025-12-24T11:15:01.428Z"
source: "beads"
---

# Bug: generateId uses Math.random() which is not cryptographically secure

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/entities.ts:72-81`

**Problem:** The `generateId()` function uses `Math.random()` which is not cryptographically secure. While this may be acceptable for non-security-sensitive IDs, it could lead to predictable ID collisions in high-throughput scenarios.

**Code:**
```typescript
function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]  // Not crypto-safe
  }
  const timestamp = Date.now().toString(36)
  return `${timestamp}${result}`
}
```

**Impact:** 
- 8 characters from a 36-char alphabet = ~2.8 trillion combinations
- Combined with timestamp provides reasonable uniqueness
- Risk: In high-concurrency scenarios within same millisecond, collisions are more likely

**Recommended Fix:** Use `crypto.getRandomValues()` which is available in Cloudflare Workers:
```typescript
const array = new Uint8Array(8)
crypto.getRandomValues(array)
```