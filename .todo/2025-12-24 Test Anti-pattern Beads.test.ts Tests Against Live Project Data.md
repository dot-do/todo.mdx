---
id: todo-gpm0
title: "Test anti-pattern: beads.test.ts tests against live project data"
state: open
priority: 1
type: chore
labels: ["code-review", "test-isolation", "tests"]
createdAt: "2025-12-24T11:14:57.342Z"
updatedAt: "2025-12-24T11:14:57.342Z"
source: "beads"
---

# Test anti-pattern: beads.test.ts tests against live project data

**Location:** /Users/nathanclevenger/projects/todo.mdx/tests/beads.test.ts:11-34

**Problem:** The test `loadBeadsIssues` uses hardcoded absolute path `/Users/nathanclevenger/projects/todo.mdx` and tests against actual live project data. This creates:

1. **Environment coupling** - Test only works on one specific machine
2. **Flaky tests** - Results depend on current state of project's beads database
3. **Non-deterministic behavior** - Test assertions like `expect(issues.length).toBeGreaterThan(0)` may fail in clean environments

**Current code:**
```typescript
it('loads issues from .beads directory when it exists', async () => {
  const issues = await loadBeadsIssues('/Users/nathanclevenger/projects/todo.mdx')
  // ...
})
```

**Recommendation:** Create test fixtures with known data using temp directories:
```typescript
import { tmpdir } from 'node:os'
const testDir = await fs.mkdtemp(join(tmpdir(), 'beads-test-'))
// Create .beads directory with known test data
```