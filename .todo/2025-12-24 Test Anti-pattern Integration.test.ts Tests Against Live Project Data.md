---
id: todo-51s3
title: "Test anti-pattern: integration.test.ts tests against live project data"
state: open
priority: 1
type: chore
labels: ["code-review", "test-isolation", "tests"]
createdAt: "2025-12-24T11:15:02.659Z"
updatedAt: "2025-12-24T11:15:02.659Z"
source: "beads"
---

# Test anti-pattern: integration.test.ts tests against live project data

**Location:** /Users/nathanclevenger/projects/todo.mdx/tests/integration.test.ts:6-39

**Problem:** The integration tests use `process.cwd()` to test against actual `.todo` directory files:

```typescript
it('should load files from .todo directory', async () => {
  const todoDir = join(process.cwd(), '.todo')
  const issues = await loadTodoFiles(todoDir)
  expect(issues.length).toBeGreaterThan(0)
  // ...
})
```

And even worse, it references a specific file by name:
```typescript
it('should parse actual file from .todo correctly', async () => {
  const filePath = join(process.cwd(), '.todo', 'closed', '2025-12-20 Web Ide Layout File Tree  Monaco  Terminal.md')
  // ...
})
```

**Issues:**
1. Tests will fail if that specific file is renamed, moved, or deleted
2. Test results depend on unpredictable project state
3. CI environments may have different or no `.todo` content

**Recommendation:** Create isolated test fixtures in temp directories with known content.