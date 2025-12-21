---
id: todo-kxl
title: "Core todo.mdx: Render beads issues as .todo/*.mdx files"
state: open
priority: 0
type: epic
labels: [core, todo.mdx]
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
- **todo-0u4**: Implement loadGitHubIssues() data source
- **todo-25c**: Add issue-specific MDX components (Subtasks, RelatedIssues, Timeline)
- **todo-az6**: Implement file watcher for .todo/*.md bidirectional sync
- **todo-c80**: Implement outputs: frontmatter routing for multi-file generation
- **todo-dok**: Fix CLI to properly load issues and generate .todo files
- **todo-luy**: Add issue-level MDX template support (.mdx/issue.mdx)
- **todo-si1**: Add todo.mdx API client for Payload/Worker data source

### Timeline

- **Created:** 12/20/2025

