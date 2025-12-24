---
id: todo-vjpw
title: "CLI init command writes to .beads/TODO.mdx without checking if .beads exists"
state: open
priority: 2
type: bug
labels: ["cli", "code-review", "error-handling", "src"]
createdAt: "2025-12-24T11:15:03.595Z"
updatedAt: "2025-12-24T11:15:03.595Z"
source: "beads"
---

# CLI init command writes to .beads/TODO.mdx without checking if .beads exists

**File:** src/cli.ts:222-235

The init command tries to write `.beads/TODO.mdx` without first creating the `.beads` directory:

```typescript
// Create TODO.mdx template if it doesn't exist
const todoMdxPath = '.beads/TODO.mdx'
try {
  await fs.access(todoMdxPath)
  log('→', `${todoMdxPath} already exists, skipping`)
} catch {
  const template = `# TODO...`
  await fs.writeFile(todoMdxPath, template, 'utf-8')  // Will fail if .beads/ doesn't exist
  log('✓', `Created ${todoMdxPath}`)
}
```

**Impact:** If a user runs `todo.mdx init` before `bd init`, the command will fail with ENOENT error.

**Recommendation:** Either:
1. Create `.beads/` directory before writing the file
2. Check if `.beads/` exists and skip with a message if not
3. Document that `bd init` should be run first