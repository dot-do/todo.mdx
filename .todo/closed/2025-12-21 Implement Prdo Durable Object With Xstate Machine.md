---
id: todo-tnwk
title: "Implement PRDO Durable Object with XState machine"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:42:15.047Z"
updatedAt: "2025-12-21T19:49:53.512Z"
closedAt: "2025-12-21T19:49:53.512Z"
source: "beads"
dependsOn: ["todo-o9pp"]
blocks: ["todo-8w8a", "todo-tpef"]
---

# Implement PRDO Durable Object with XState machine

Create PRDO (Pull Request Durable Object) with XState state machine.

States: pending → reviewing → checkingApproval → approved → merged
Alternative: reviewing → fixing → reviewing (for changes requested)
Terminal: merged, closed, error

Context tracks:
- Current reviewer index
- Review outcomes
- Session IDs
- Retry counts

See notes/plans/2025-12-20-prdo-code-review-sdlc-design.md

### Related Issues

**Depends on:**
- [todo-o9pp](./todo-o9pp.md)

**Blocks:**
- [todo-8w8a](./todo-8w8a.md)
- [todo-tpef](./todo-tpef.md)