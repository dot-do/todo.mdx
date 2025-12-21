---
id: todo-g7a
title: "Extract shared YAML parser utility"
state: open
priority: 1
type: task
labels: [code-quality, packages]
---

# Extract shared YAML parser utility

Same YAML parser implementation exists in 4+ files with slight variations: packages/todo.mdx/src/compiler.ts, packages/todo.mdx/src/parser.ts, packages/roadmap.mdx/src/compiler.ts, packages/cli.mdx/src/compiler.ts. Extract to shared utility package.

### Timeline

- **Created:** 12/20/2025

