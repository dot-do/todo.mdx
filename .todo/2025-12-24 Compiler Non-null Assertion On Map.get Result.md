---
id: todo-p6sx
title: "Compiler non-null assertion on Map.get result"
state: open
priority: 3
type: task
labels: ["code-review", "compiler", "src", "type-safety"]
createdAt: "2025-12-24T11:15:15.257Z"
updatedAt: "2025-12-24T11:15:15.257Z"
source: "beads"
---

# Compiler non-null assertion on Map.get result

**File:** src/compiler.ts:71

The code uses a non-null assertion on a Map.get result without guarantee:

```typescript
function groupByType(issues: TodoIssue[]): Map<string, TodoIssue[]> {
  const groups = new Map<string, TodoIssue[]>()

  for (const issue of issues) {
    const type = issue.type
    if (!groups.has(type)) {
      groups.set(type, [])
    }
    groups.get(type)!.push(issue)  // Non-null assertion
  }
  return groups
}
```

While this particular case is safe due to the `has` check preceding it, the pattern is fragile and TypeScript allows the non-null assertion to bypass type checking.

**Impact:** Low risk in current code, but makes refactoring error-prone.

**Recommendation:** Use safer patterns like:
```typescript
const arr = groups.get(type) ?? []
arr.push(issue)
groups.set(type, arr)
```
Or use the map/reduce pattern for grouping.