---
id: todo-7t0g
title: "Connections Payload collection"
state: closed
priority: 1
type: task
labels: ["foundation", "payload"]
createdAt: "2025-12-21T14:58:45.141Z"
updatedAt: "2025-12-21T15:12:11.976Z"
closedAt: "2025-12-21T15:12:11.976Z"
source: "beads"
dependsOn: ["todo-qd32"]
blocks: ["todo-h5ie"]
---

# Connections Payload collection

Create new Payload collection to track user app connections:

`apps/admin/src/collections/Connections.ts`

Fields:
- user: relationship to users
- org: relationship to installations (optional, for org-level)
- app: text ('GitHub', 'Slack', etc.)
- provider: select ['native', 'composio']
- externalId: text (composioUserId, installationId, etc.)
- externalRef: json (provider-specific metadata)
- status: select ['active', 'expired', 'revoked']
- scopes: json
- connectedAt: date
- expiresAt: date

Add to payload.config.ts collections array.

### Related Issues

**Depends on:**
- [todo-qd32](./todo-qd32.md)

**Blocks:**
- [todo-h5ie](./todo-h5ie.md)