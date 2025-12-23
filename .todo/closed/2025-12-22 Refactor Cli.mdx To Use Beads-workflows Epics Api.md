---
id: todo-c21b
title: "Refactor cli.mdx to use beads-workflows epics API"
state: closed
priority: 2
type: task
labels: ["beads-workflows", "refactor"]
createdAt: "2025-12-22T08:40:45.680Z"
updatedAt: "2025-12-22T08:57:51.923Z"
closedAt: "2025-12-22T08:57:51.923Z"
source: "beads"
dependsOn: ["todo-5y61"]
---

# Refactor cli.mdx to use beads-workflows epics API

Replace manual epic progress calculation in `packages/cli.mdx/src/loader.ts` with beads-workflows SDK.

Current state (loader.ts:24-71):
- Manually parses issues.jsonl
- Manually calculates epic progress by filtering children
- Duplicates logic that beads-workflows provides

Target state:
- Use `createEpicsApi()` from beads-workflows
- Use `epics.progress(id)` for progress calculation
- Remove duplicate progress logic

### Related Issues

**Depends on:**
- [todo-5y61](./todo-5y61.md)