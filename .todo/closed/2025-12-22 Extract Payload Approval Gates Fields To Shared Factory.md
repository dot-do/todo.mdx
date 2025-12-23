---
id: todo-lbf7
title: "Extract Payload approval gates fields to shared factory"
state: closed
priority: 1
type: chore
labels: ["admin", "dedup", "refactor"]
createdAt: "2025-12-22T08:05:21.170Z"
updatedAt: "2025-12-22T08:09:51.572Z"
closedAt: "2025-12-22T08:09:51.572Z"
source: "beads"
---

# Extract Payload approval gates fields to shared factory

Approval gates field definitions duplicated (~380 lines total):
- apps/admin/src/collections/Installations.ts (lines 119-308)
- apps/admin/src/collections/Repos.ts (lines 191-385)

Create apps/admin/src/fields/approval-gates.ts with createApprovalGatesGroup() factory.