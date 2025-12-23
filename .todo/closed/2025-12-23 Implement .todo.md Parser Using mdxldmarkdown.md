---
id: todo-kwyg
title: "Implement .todo/*.md parser using @mdxld/markdown"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-23T10:10:24.578Z"
updatedAt: "2025-12-23T10:23:43.909Z"
closedAt: "2025-12-23T10:23:43.909Z"
source: "beads"
dependsOn: ["todo-bf0d"]
blocks: ["todo-oc5o", "todo-v5px"]
---

# Implement .todo/*.md parser using @mdxld/markdown

Create src/parser.ts:
- Use @mdxld/markdown.fromMarkdown() to parse .todo files
- Extract frontmatter metadata (id, title, status, priority, etc.)
- Convert to Issue objects

Handle YAML frontmatter + markdown body.

### Related Issues

**Depends on:**
- [todo-bf0d](./todo-bf0d.md)

**Blocks:**
- [todo-oc5o](./todo-oc5o.md)
- [todo-v5px](./todo-v5px.md)