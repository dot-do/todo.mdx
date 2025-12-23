---
id: todo-hkjk
title: "Implement .todo/*.md generator using @mdxld/markdown"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-23T10:10:35.240Z"
updatedAt: "2025-12-23T10:23:49.181Z"
closedAt: "2025-12-23T10:23:49.181Z"
source: "beads"
dependsOn: ["todo-bf0d"]
blocks: ["todo-v5px"]
---

# Implement .todo/*.md generator using @mdxld/markdown

Create src/generator.ts:
- Use @mdxld/markdown.toMarkdown() to generate .todo files
- Load optional templates from .mdx/issue.mdx
- Generate filename from pattern: {id}-{title}.md

One-way: beads → .todo/*.md

### Related Issues

**Depends on:**
- [todo-bf0d](./todo-bf0d.md)

**Blocks:**
- [todo-v5px](./todo-v5px.md)