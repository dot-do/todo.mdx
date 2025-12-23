---
id: todo-s33
title: "Add unit tests for packages (todo.mdx, roadmap.mdx)"
state: closed
priority: 1
type: task
labels: ["packages", "testing"]
createdAt: "2025-12-20T20:02:54.572Z"
updatedAt: "2025-12-21T13:30:40.643Z"
closedAt: "2025-12-21T13:30:40.643Z"
source: "beads"
---

# Add unit tests for packages (todo.mdx, roadmap.mdx)

Only 3 test files exist (all in agents.mdx). No tests for parsers, compilers, or renderers. High risk of regressions, hard to refactor safely. Add vitest tests targeting 80% coverage for core functionality.