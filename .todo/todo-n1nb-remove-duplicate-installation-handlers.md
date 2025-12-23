---
id: todo-n1nb
title: "Remove duplicate installation handlers"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-22T00:25:00.419Z"
updatedAt: "2025-12-22T00:35:03.432Z"
closedAt: "2025-12-22T00:35:03.432Z"
source: "beads"
---

# Remove duplicate installation handlers

Two handleInstallation implementations: webhooks/handlers.ts (Drizzle) vs index.ts (Payload). Different behavior - only one triggers BeadsSyncWorkflow.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
