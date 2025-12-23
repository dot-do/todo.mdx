---
id: todo-r933
title: "Replace custom parser with @mdxld/markdown fromMarkdown()"
state: closed
priority: 1
type: task
labels: ["mdxld", "phase-1"]
createdAt: "2025-12-23T13:44:03.238Z"
updatedAt: "2025-12-23T13:55:48.221Z"
closedAt: "2025-12-23T13:55:48.221Z"
source: "beads"
blocks: ["todo-q1ol"]
---

# Replace custom parser with @mdxld/markdown fromMarkdown()

Replace the custom parseFrontmatter() in src/parser.ts with fromMarkdown() from @mdxld/markdown. This provides proper YAML parsing and bi-directional conversion support. Update parseTodoFile() to use the mdxld API while maintaining the same TodoIssue interface.

### Related Issues

**Blocks:**
- [todo-q1ol](./todo-q1ol.md)