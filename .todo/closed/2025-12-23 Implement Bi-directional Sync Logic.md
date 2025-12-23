---
id: todo-v5px
title: "Implement bi-directional sync logic"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-23T10:10:40.578Z"
updatedAt: "2025-12-23T10:32:08.968Z"
closedAt: "2025-12-23T10:32:08.968Z"
source: "beads"
dependsOn: ["todo-j4h0", "todo-kwyg", "todo-hkjk"]
blocks: ["todo-4oij", "todo-8yxh", "todo-mjme"]
---

# Implement bi-directional sync logic

Create src/sync.ts:
- Use @mdxld/markdown.diff() to detect changes
- .todo/*.md changes → bd update via beads-workflows
- beads changes → regenerate .todo/*.md
- Conflict resolution strategy (beads wins by default)

Use beads-workflows.createIssue/updateIssue for mutations.

### Related Issues

**Depends on:**
- [todo-j4h0](./todo-j4h0.md)
- [todo-kwyg](./todo-kwyg.md)
- [todo-hkjk](./todo-hkjk.md)

**Blocks:**
- [todo-4oij](./todo-4oij.md)
- [todo-8yxh](./todo-8yxh.md)
- [todo-mjme](./todo-mjme.md)