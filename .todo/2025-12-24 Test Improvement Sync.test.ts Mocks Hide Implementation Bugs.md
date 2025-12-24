---
id: todo-jmd8
title: "Test improvement: sync.test.ts mocks hide implementation bugs"
state: open
priority: 2
type: task
labels: ["code-review", "test-coverage", "tests"]
createdAt: "2025-12-24T11:15:30.566Z"
updatedAt: "2025-12-24T11:15:30.566Z"
source: "beads"
---

# Test improvement: sync.test.ts mocks hide implementation bugs

**Location:** /Users/nathanclevenger/projects/todo.mdx/tests/sync.test.ts:9-34

**Problem:** The sync tests mock nearly all dependencies:

```typescript
vi.mock('beads-workflows', () => ({
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  closeIssue: vi.fn(),
  readIssuesFromJsonl: vi.fn(),
  findBeadsDir: vi.fn(),
}))

vi.mock('../src/beads.js', () => ({
  loadBeadsIssues: vi.fn(),
  hasBeadsDirectory: vi.fn(),
}))

vi.mock('../src/parser.js', () => ({
  loadTodoFiles: vi.fn(),
}))

vi.mock('../src/generator.js', () => ({
  writeTodoFiles: vi.fn(),
}))
```

**Issues:**
1. Tests verify that mocks are called correctly but not that real implementations work
2. Integration bugs between modules won't be caught
3. Changes to beads-workflows API could break production without failing tests

**Recommendation:** Add integration tests that use real implementations (with temp directories) alongside the existing unit tests with mocks. Consider using `vi.spyOn` instead of full mocks where possible to preserve real behavior.