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
- **todo-ioid**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
