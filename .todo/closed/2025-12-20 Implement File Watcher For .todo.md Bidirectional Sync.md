---
id: todo-az6
title: "Implement file watcher for .todo/*.md bidirectional sync"
state: closed
priority: 2
type: feature
labels: ["core", "todo.mdx"]
createdAt: "2025-12-20T20:09:19.857Z"
updatedAt: "2025-12-20T23:10:24.672Z"
closedAt: "2025-12-20T23:10:24.672Z"
source: "beads"
dependsOn: ["todo-kxl", "todo-dok"]
---

# Implement file watcher for .todo/*.md bidirectional sync

Watch .todo/*.md files for changes and sync back to beads/GitHub.

Need to implement:
- chokidar or fs.watch for file changes
- Parse changed file frontmatter + body
- Detect which fields changed
- Sync changes back to beads via bd update
- Handle file deletion (close issue?)
- Conflict resolution when both sides change

This enables editing issues in your editor and having them sync.

Location: packages/todo.mdx/src/watcher.ts (new file)

### Related Issues

**Depends on:**
- [todo-kxl](./todo-kxl.md)
- [todo-dok](./todo-dok.md)