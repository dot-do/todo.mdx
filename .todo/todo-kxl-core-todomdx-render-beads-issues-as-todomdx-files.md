---
id: todo-kxl
title: "Core todo.mdx: Render beads issues as .todo/*.mdx files"
state: closed
priority: 0
type: epic
labels: ["core", "todo.mdx"]
createdAt: "2025-12-20T20:08:44.507Z"
updatedAt: "2025-12-20T23:10:43.541Z"
closedAt: "2025-12-20T23:10:43.541Z"
source: "beads"
---

# Core todo.mdx: Render beads issues as .todo/*.mdx files

The namesake purpose of this project: render beads issues as individual .todo/[Issue Name].mdx files with MDX component support.

Currently the infrastructure is ~80% there but not connected:
- generateTodoFiles() creates .todo/*.md but only as data containers
- No template-based rendering for individual issues
- No component support within issue files
- outputs: frontmatter not respected
- CLI doesn't properly wire up issue loading

This epic covers completing the core rendering pipeline.

### Related Issues

**Blocks:**
- **todo-0u4**
- **todo-25c**
- **todo-az6**
- **todo-c80**
- **todo-dok**
- **todo-luy**
- **todo-si1**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
