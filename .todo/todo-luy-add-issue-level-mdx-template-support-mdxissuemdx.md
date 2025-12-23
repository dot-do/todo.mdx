---
id: todo-luy
title: "Add issue-level MDX template support (.mdx/issue.mdx)"
state: closed
priority: 1
type: feature
labels: ["core", "todo.mdx"]
createdAt: "2025-12-20T20:09:19.483Z"
updatedAt: "2025-12-20T20:17:49.687Z"
closedAt: "2025-12-20T20:17:49.687Z"
source: "beads"
---

# Add issue-level MDX template support (.mdx/issue.mdx)

Create template system for individual issue files, similar to how todo.mdx renders TODO.md.

Currently generateTodoFiles() creates static .todo/*.md files with frontmatter+body. Need to:
- Support .mdx/issue.mdx as a template for individual issues
- Allow per-type templates: .mdx/issue-bug.mdx, .mdx/issue-feature.mdx
- Call hydrateTemplate() for each issue file
- Pass issue data as template context

Location: packages/todo.mdx/src/compiler.ts

### Related Issues

**Depends on:**
- **todo-kxl**

**Blocks:**
- **todo-25c**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
