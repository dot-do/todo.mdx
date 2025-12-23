---
id: todo-168d
title: "Re-export beads-workflows types from agents.mdx"
state: closed
priority: 2
type: task
labels: ["beads-workflows", "refactor", "types"]
createdAt: "2025-12-22T08:40:51.005Z"
updatedAt: "2025-12-22T08:57:57.234Z"
closedAt: "2025-12-22T08:57:57.234Z"
source: "beads"
dependsOn: ["todo-5y61"]
---

# Re-export beads-workflows types from agents.mdx

Consolidate type definitions by re-exporting from beads-workflows.

Current state (agents.mdx/src/types.ts:21-50):
- Defines Issue, IssueFilter types that overlap with beads-workflows
- Creates potential type mismatches

Target state:
- Re-export Issue, IssueStatus, IssueType, Priority from beads-workflows
- Keep agents.mdx-specific types (Claude, PR, etc.)
- Ensure type compatibility across packages

### Related Issues

**Depends on:**
- [todo-5y61](./todo-5y61.md)