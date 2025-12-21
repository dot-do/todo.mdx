---
id: todo-luy
title: "Add issue-level MDX template support (.mdx/issue.mdx)"
state: closed
priority: 1
type: feature
labels: [core, todo.mdx]
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

**Blocks:**
- **todo-25c**: Add issue-specific MDX components (Subtasks, RelatedIssues, Timeline)

### Timeline

- **Created:** 12/20/2025

