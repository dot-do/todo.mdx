---
id: todo-h2i6
title: "Missing test coverage: src/patterns.ts and src/presets.ts have no tests"
state: open
priority: 2
type: chore
labels: ["code-review", "test-coverage", "tests"]
createdAt: "2025-12-24T11:15:14.584Z"
updatedAt: "2025-12-24T11:15:14.584Z"
source: "beads"
---

# Missing test coverage: src/patterns.ts and src/presets.ts have no tests

**Problem:** Two source files in src/ have no corresponding test files:

- `/Users/nathanclevenger/projects/todo.mdx/src/patterns.ts` - No tests
- `/Users/nathanclevenger/projects/todo.mdx/src/presets.ts` - No tests

**Impact:** Any logic in these modules is untested, potentially leading to:
- Undetected bugs
- Regressions during refactoring
- Unclear expected behavior

**Recommendation:** Create test files:
- `tests/patterns.test.ts`
- `tests/presets.test.ts`

Or verify if these modules are covered indirectly through other tests (e.g., template tests).