---
id: todo-g7a
title: "Extract shared YAML parser utility"
state: closed
priority: 1
type: task
labels: ["code-quality", "packages"]
createdAt: "2025-12-20T20:02:54.655Z"
updatedAt: "2025-12-21T21:50:40.894Z"
closedAt: "2025-12-21T21:50:40.894Z"
source: "beads"
---

# Extract shared YAML parser utility

Same YAML parser implementation exists in 4+ files with slight variations: packages/todo.mdx/src/compiler.ts, packages/todo.mdx/src/parser.ts, packages/roadmap.mdx/src/compiler.ts, packages/cli.mdx/src/compiler.ts. Extract to shared utility package.