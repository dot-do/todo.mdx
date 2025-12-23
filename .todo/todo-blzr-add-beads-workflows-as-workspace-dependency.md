---
id: todo-blzr
title: "Add beads-workflows as workspace dependency"
state: closed
priority: 0
type: task
labels: ["beads-workflows", "infra"]
createdAt: "2025-12-22T08:40:56.336Z"
updatedAt: "2025-12-22T09:45:05.860Z"
closedAt: "2025-12-22T09:45:05.860Z"
source: "beads"
---

# Add beads-workflows as workspace dependency

Configure the monorepo to use beads-workflows submodule as a workspace package.

Tasks:
- Update pnpm-workspace.yaml to include packages/beads-workflows
- Add "beads-workflows": "workspace:*" to dependent packages
- Ensure proper TypeScript paths/references
- Run pnpm install to link packages

### Timeline

- **Created:** 12/22/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
