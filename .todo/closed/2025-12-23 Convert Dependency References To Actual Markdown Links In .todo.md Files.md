---
id: todo-y47g
title: "Convert dependency references to actual markdown links in .todo/*.md files"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-23T13:23:54.022Z"
updatedAt: "2025-12-23T13:27:24.181Z"
closedAt: "2025-12-23T13:27:24.181Z"
source: "beads"
---

# Convert dependency references to actual markdown links in .todo/*.md files

The generator outputs dependency references as bold text like `**todo-xyz**` but they should be actual markdown links like `[todo-xyz](./todo-xyz-slug.md)`. Update generateBody() in src/generator.ts to generate proper markdown links for dependsOn, blocks, and children references.