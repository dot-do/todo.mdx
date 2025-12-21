---
id: todo-dok
title: "Fix CLI to properly load issues and generate .todo files"
state: closed
priority: 1
type: bug
labels: [cli, core, todo.mdx]
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

**Blocks:**
- **todo-az6**: Implement file watcher for .todo/*.md bidirectional sync

### Timeline

- **Created:** 12/20/2025

