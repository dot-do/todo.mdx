---
id: todo-wz8f
title: "Missing error handling for invalid date strings in parser"
state: open
priority: 2
type: bug
labels: ["code-review", "parser", "src", "validation"]
createdAt: "2025-12-24T11:14:52.956Z"
updatedAt: "2025-12-24T11:14:52.956Z"
source: "beads"
---

# Missing error handling for invalid date strings in parser

**File:** src/parser.ts:159-162

The parser directly assigns date strings from frontmatter without validation:

```typescript
const issue: TodoIssue = {
  // ...
  createdAt: frontmatter.createdAt as string | undefined,
  updatedAt: frontmatter.updatedAt as string | undefined,
  closedAt: frontmatter.closedAt as string | undefined,
  // ...
}
```

These values are later used in date comparisons in sync.ts and compiler.ts:

```typescript
// sync.ts:171-172
const beadsTime = beadsIssue.updatedAt ? new Date(beadsIssue.updatedAt).getTime() : 0
const fileTime = fileIssue.updatedAt ? new Date(fileIssue.updatedAt).getTime() : 0
```

**Impact:** If a malformed date string like "not-a-date" is in frontmatter, `new Date("not-a-date").getTime()` returns `NaN`, which will cause unexpected behavior in comparisons.

**Recommendation:** Add date validation in the parser that either:
1. Validates ISO date format and rejects invalid dates
2. Returns undefined for invalid dates with a warning