---
id: todo-f8ou
title: "Potential ReDoS: User-provided regex patterns used unsafely"
state: open
priority: 2
type: bug
labels: ["code-review", "security", "worker"]
createdAt: "2025-12-24T11:15:49.746Z"
updatedAt: "2025-12-24T11:15:49.746Z"
source: "beads"
---

# Potential ReDoS: User-provided regex patterns used unsafely

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/parser.ts:63-107`

**Problem:** The `extractMultilineContent` function creates RegExp objects from user-configurable patterns in `GitHubConventions`. If a user provides a malicious regex pattern, it could cause catastrophic backtracking (ReDoS).

**Code:**
```typescript
function extractMultilineContent(body: string, pattern: string): string[] {
  const results: string[] = []
  const regex = new RegExp(pattern, 'gmi')  // User-controlled pattern
  let match: RegExpExecArray | null

  while ((match = regex.exec(body)) !== null) {
    // ... process matches
  }
  return results
}
```

**Also in:**
- `parseIssueBody` at line 132-134 (dependencies pattern)
- `parseIssueBody` at line 145-150 (blocks pattern)
- `parseIssueBody` at line 158 (epics pattern)
- `stripConventionPatterns` in github-to-beads.ts lines 34-56

**Impact:** A specially crafted regex pattern in conventions config could cause the worker to hang or consume excessive CPU, potentially causing denial of service.

**Recommended Fix:**
1. Validate/sanitize regex patterns before use
2. Use a regex timeout mechanism
3. Pre-define allowed patterns and only allow selection from safe options
4. Use a safe-regex library to check for exponential backtracking