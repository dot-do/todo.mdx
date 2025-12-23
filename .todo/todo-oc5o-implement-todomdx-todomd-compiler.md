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
- **todo-j4h0**
- **todo-kwyg**

**Blocks:**
- **todo-8yxh**
- **todo-mjme**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
