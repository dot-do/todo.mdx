---
id: todo-25c
title: "Add issue-specific MDX components (Subtasks, RelatedIssues, Timeline)"
state: closed
priority: 1
type: feature
labels: ["core", "todo.mdx"]
createdAt: "2025-12-20T20:09:19.575Z"
updatedAt: "2025-12-20T20:23:19.893Z"
closedAt: "2025-12-20T20:23:19.893Z"
source: "beads"
dependsOn: ["todo-kxl", "todo-luy"]
---

# Add issue-specific MDX components (Subtasks, RelatedIssues, Timeline)

Create component system for rendering within individual issue files.

New components needed:
- <Subtasks /> - child issues for epics
- <RelatedIssues /> - linked/blocking issues
- <Timeline /> - creation/update history
- <Discussion /> - comments from GitHub/Linear
- <Progress /> - completion metrics for epics

These should work like existing <Issues.Ready /> but scoped to single issue context.

Location: packages/todo.mdx/src/compiler.ts, add to hydrateTemplate()

### Related Issues

**Depends on:**
- [todo-kxl](./todo-kxl.md)
- [todo-luy](./todo-luy.md)