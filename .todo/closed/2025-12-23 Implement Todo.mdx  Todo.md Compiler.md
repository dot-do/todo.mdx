---
id: todo-oc5o
title: "Implement TODO.mdx → TODO.md compiler"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-23T10:10:29.914Z"
updatedAt: "2025-12-23T10:32:03.704Z"
closedAt: "2025-12-23T10:32:03.704Z"
source: "beads"
dependsOn: ["todo-j4h0", "todo-kwyg"]
blocks: ["todo-8yxh", "todo-mjme"]
---

# Implement TODO.mdx → TODO.md compiler

Create src/compiler.ts:
- Load TODO.mdx template
- Merge issues from beads and .todo/*.md
- Hydrate template components (<Issues.Open />, <Stats />, etc.)
- Output TODO.md

Support frontmatter config for customization.

### Related Issues

**Depends on:**
- [todo-j4h0](./todo-j4h0.md)
- [todo-kwyg](./todo-kwyg.md)

**Blocks:**
- [todo-8yxh](./todo-8yxh.md)
- [todo-mjme](./todo-mjme.md)