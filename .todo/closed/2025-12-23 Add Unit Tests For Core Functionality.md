---
id: todo-mjme
title: "Add unit tests for core functionality"
state: closed
priority: 2
type: task
labels: []
createdAt: "2025-12-23T10:10:56.614Z"
updatedAt: "2025-12-23T10:42:36.852Z"
closedAt: "2025-12-23T10:42:36.852Z"
source: "beads"
dependsOn: ["todo-oc5o", "todo-v5px"]
---

# Add unit tests for core functionality

Create tests for:
- Parser: .todo/*.md → Issue objects
- Generator: Issue → .todo/*.md
- Compiler: TODO.mdx → TODO.md
- Sync: diff detection and conflict resolution

Use vitest.

### Related Issues

**Depends on:**
- [todo-oc5o](./todo-oc5o.md)
- [todo-v5px](./todo-v5px.md)