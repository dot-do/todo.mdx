---
id: todo-ga5
title: "Encrypt webhook secrets at rest"
state: closed
priority: 0
type: bug
labels: ["apps", "critical", "security"]
createdAt: "2025-12-20T20:02:19.981Z"
updatedAt: "2025-12-20T23:07:13.443Z"
closedAt: "2025-12-20T23:07:13.443Z"
source: "beads"
---

# Encrypt webhook secrets at rest

In apps/admin/src/collections/LinearIntegrations.ts:136-140, webhookSecret uses hidden:true which only hides from UI but doesn't encrypt data at rest. Database compromise would expose all webhook secrets. Use Payload's encrypt option or move to Workers secrets.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
