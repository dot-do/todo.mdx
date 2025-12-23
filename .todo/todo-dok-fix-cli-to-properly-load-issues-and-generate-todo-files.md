---
id: todo-dok
title: "Fix CLI to properly load issues and generate .todo files"
state: closed
priority: 1
type: bug
labels: ["cli", "core", "todo.mdx"]
createdAt: "2025-12-20T20:09:19.763Z"
updatedAt: "2025-12-20T20:17:49.518Z"
closedAt: "2025-12-20T20:17:49.518Z"
source: "beads"
dependsOn: ["todo-kxl"]
blocks: ["todo-az6"]
---

# Fix CLI to properly load issues and generate .todo files

The CLI (src/cli.ts) has generateTodoFiles() wired up but doesn't load actual issues.

Current code at line 94:
```typescript
const files = await generateTodoFiles({
  todoDir: path.join(cwd, '.todo'),
  pattern,
})
```

But issues aren't passed! Need to:
- Load issues from beads/files before calling generateTodoFiles
- Pass loaded issues to the function
- Add --source flag to specify data source (beads, github, api)
- Fix watch mode (currently just console.log stub)

Location: packages/todo.mdx/src/cli.ts

### Related Issues

**Depends on:**
- [todo-kxl](./todo-kxl.md)

**Blocks:**
- [todo-az6](./todo-az6.md)