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
- **todo-j4h0**
- **todo-kwyg**
- **todo-hkjk**

**Blocks:**
- **todo-4oij**
- **todo-8yxh**
- **todo-mjme**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
