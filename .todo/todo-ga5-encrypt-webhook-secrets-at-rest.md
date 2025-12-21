---
id: todo-ga5
title: "Encrypt webhook secrets at rest"
state: open
priority: 0
type: bug
labels: [apps, critical, security]
---

# Encrypt webhook secrets at rest

In apps/admin/src/collections/LinearIntegrations.ts:136-140, webhookSecret uses hidden:true which only hides from UI but doesn't encrypt data at rest. Database compromise would expose all webhook secrets. Use Payload's encrypt option or move to Workers secrets.

### Timeline

- **Created:** 12/20/2025

