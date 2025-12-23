---
id: todo-0vok
title: "Add beads-workflows as workspace dependency"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-22T08:41:11.015Z"
updatedAt: "2025-12-22T09:45:05.859Z"
closedAt: "2025-12-22T09:45:05.859Z"
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
