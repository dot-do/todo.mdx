---
id: todo-6vck
title: "Remove duplicate installation handlers - webhooks/handlers.ts vs index.ts"
state: closed
priority: 0
type: bug
labels: ["critical", "webhooks"]
createdAt: "2025-12-22T00:23:41.451Z"
updatedAt: "2025-12-22T08:50:22.737Z"
closedAt: "2025-12-22T08:50:22.737Z"
source: "beads"
---

# Remove duplicate installation handlers - webhooks/handlers.ts vs index.ts

Two separate handleInstallation implementations exist: one in webhooks/handlers.ts using Drizzle, one in index.ts using Payload. They have different behavior - only one triggers BeadsSyncWorkflow.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
