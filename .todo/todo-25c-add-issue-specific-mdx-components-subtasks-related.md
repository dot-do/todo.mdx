---
id: todo-25c
title: "Add issue-specific MDX components (Subtasks, RelatedIssues, Timeline)"
state: closed
priority: 1
type: feature
labels: [core, todo.mdx]
---

# Add issue-specific MDX components (Subtasks, RelatedIssues, Timeline)

Create component system for rendering within individual issue files.

New components needed:
- `<Subtasks />` - child issues for epics
- `<RelatedIssues />` - linked/blocking issues
- `<Timeline />` - creation/update history
- `<Discussion />` - comments from GitHub/Linear
- `<Progress />` - completion metrics for epics

These should work like existing <Issues.Ready /> but scoped to single issue context.

Location: packages/todo.mdx/src/compiler.ts, add to hydrateTemplate()

### Timeline

- **Created:** 12/20/2025

