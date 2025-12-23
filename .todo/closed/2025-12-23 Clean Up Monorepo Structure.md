---
id: todo-671j
title: "Clean up monorepo structure"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-23T10:10:03.243Z"
updatedAt: "2025-12-23T10:15:55.811Z"
closedAt: "2025-12-23T10:15:55.811Z"
source: "beads"
blocks: ["todo-ioid"]
---

# Clean up monorepo structure

Remove all monorepo artifacts:
- packages/ directory (all sub-packages)
- apps/ directory
- worker/ directory  
- tests/ package
- turbo.json, pnpm-workspace.yaml
- .changeset/

Keep:
- .beads/ (issue tracking)
- .github/ (workflows)
- src/ (new single package source)
- package.json (simplified for single package)
- tsconfig.json
- CLAUDE.md

### Related Issues

**Blocks:**
- [todo-ioid](./todo-ioid.md)