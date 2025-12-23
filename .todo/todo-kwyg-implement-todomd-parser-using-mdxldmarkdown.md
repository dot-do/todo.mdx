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
---

# Implement .todo/*.md parser using @mdxld/markdown

Create src/parser.ts:
- Use @mdxld/markdown.fromMarkdown() to parse .todo files
- Extract frontmatter metadata (id, title, status, priority, etc.)
- Convert to Issue objects

Handle YAML frontmatter + markdown body.

### Related Issues

**Depends on:**
- **todo-bf0d**

**Blocks:**
- **todo-oc5o**
- **todo-v5px**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
