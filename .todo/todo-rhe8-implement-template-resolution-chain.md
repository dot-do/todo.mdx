---
id: todo-rhe8
title: "Implement template resolution chain"
state: open
priority: 1
type: task
labels: ["phase-3", "templates"]
createdAt: "2025-12-23T13:45:30.399Z"
updatedAt: "2025-12-23T13:45:30.399Z"
source: "beads"
---

# Implement template resolution chain

Create src/templates.ts with template resolution logic. Check: .mdx/[Issue].mdx → .mdx/presets/*.mdx → config preset → built-in. Add resolveTemplate(type, config) that returns template content. Support TODO.mdx and [Issue].mdx template types.

### Related Issues

**Blocks:**
- **todo-jxi2**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
