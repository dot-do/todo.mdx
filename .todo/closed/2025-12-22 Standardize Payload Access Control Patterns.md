---
id: todo-kry1
title: "Standardize Payload access control patterns"
state: closed
priority: 1
type: chore
labels: ["admin", "refactor", "security"]
createdAt: "2025-12-22T08:05:37.217Z"
updatedAt: "2025-12-22T08:13:03.450Z"
closedAt: "2025-12-22T08:13:03.450Z"
source: "beads"
---

# Standardize Payload access control patterns

5 different access control patterns across collections:
- Some use isInternalRequest (correct)
- Some missing the check (SyncEvents, DurableObjects, LinearIntegrations)
- Inconsistent admin checks

Create apps/admin/src/access/patterns.ts with:
- adminOnly, authenticated, ownerOrAdmin, repoAccess helpers
- Update all collections to use consistent patterns