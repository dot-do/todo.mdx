---
id: todo-a8oq
title: "Test code smell: cli.test.ts uses require() inside tests"
state: open
priority: 3
type: chore
labels: ["code-quality", "code-review", "tests"]
createdAt: "2025-12-24T11:15:41.496Z"
updatedAt: "2025-12-24T11:15:41.496Z"
source: "beads"
---

# Test code smell: cli.test.ts uses require() inside tests

**Location:** /Users/nathanclevenger/projects/todo.mdx/tests/cli.test.ts:68-80

**Problem:** Tests use CommonJS `require()` inside test functions in an ESM project:

```typescript
it('should show help when no command given', () => {
  const { parseArgs } = require('node:util')
  // ...
})
```

**Issues:**
1. **Inconsistent module style** - The test file uses ESM imports at the top but CJS inside tests
2. **Unnecessary runtime overhead** - Each test re-requires the same module
3. **Code smell** - Suggests the tests were written ad-hoc rather than following project conventions

**Recommendation:** Import `parseArgs` once at the top of the file using ESM:
```typescript
import { parseArgs } from 'node:util'
```

Then use it in all tests without re-importing.