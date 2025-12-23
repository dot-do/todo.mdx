---
id: todo-e9x
title: "Fix localId uniqueness to be scoped per repository"
state: closed
priority: 2
type: bug
labels: ["apps", "bug"]
createdAt: "2025-12-20T20:03:28.556Z"
updatedAt: "2025-12-23T10:08:49.115Z"
closedAt: "2025-12-23T10:08:49.115Z"
source: "beads"
---

# Fix localId uniqueness to be scoped per repository

In apps/admin/src/collections/Issues.ts:47-53, localId should be unique per repository, not globally. Different repos could have conflicting IDs. Add compound index or scoped validation (repo + localId).