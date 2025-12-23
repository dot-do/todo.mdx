---
id: todo-rhe8
title: "Implement template resolution chain"
state: closed
priority: 1
type: task
labels: ["phase-3", "templates"]
createdAt: "2025-12-23T13:45:30.399Z"
updatedAt: "2025-12-23T14:14:05.918Z"
closedAt: "2025-12-23T14:14:05.918Z"
source: "beads"
blocks: ["todo-jxi2"]
---

# Implement template resolution chain

Create src/templates.ts with template resolution logic. Check: .mdx/[Issue].mdx → .mdx/presets/*.mdx → config preset → built-in. Add resolveTemplate(type, config) that returns template content. Support TODO.mdx and [Issue].mdx template types.

### Related Issues

**Blocks:**
- [todo-jxi2](./todo-jxi2.md)