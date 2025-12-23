---
id: todo-cnqo
title: "Implement applyPattern() for filename generation from issues"
state: closed
priority: 1
type: task
labels: ["patterns", "phase-2"]
createdAt: "2025-12-23T13:44:51.910Z"
updatedAt: "2025-12-23T14:06:07.341Z"
closedAt: "2025-12-23T14:06:07.341Z"
source: "beads"
dependsOn: ["todo-5xpt"]
---

# Implement applyPattern() for filename generation from issues

Add applyPattern(pattern, issue) to src/patterns.ts. Resolve tokens from TodoIssue, apply transformations based on delimiter context. Handle edge cases: slashes in title, dots, empty values, very long titles (truncate to ~100 chars), filename collisions (append -1, -2 suffix).

### Related Issues

**Depends on:**
- [todo-5xpt](./todo-5xpt.md)