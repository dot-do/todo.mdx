---
id: todo-c80
title: "Implement outputs: frontmatter routing for multi-file generation"
state: closed
priority: 1
type: feature
labels: ["core", "todo.mdx"]
createdAt: "2025-12-20T20:09:19.660Z"
updatedAt: "2025-12-20T20:17:49.877Z"
closedAt: "2025-12-20T20:17:49.877Z"
source: "beads"
dependsOn: ["todo-kxl"]
---

# Implement outputs: frontmatter routing for multi-file generation

Parse and respect the outputs: array in template frontmatter.

Current template says:
```yaml
outputs:
  - TODO.md
  - .todo/*.md
```

But compile() only generates single output file. Need to:
- Parse outputs array from frontmatter
- Route to appropriate generators (TODO.md vs .todo/*.md)
- Support glob patterns in outputs
- Call generateTodoFiles() automatically when .todo/*.md specified

Location: packages/todo.mdx/src/compiler.ts, compile() function

### Related Issues

**Depends on:**
- [todo-kxl](./todo-kxl.md)