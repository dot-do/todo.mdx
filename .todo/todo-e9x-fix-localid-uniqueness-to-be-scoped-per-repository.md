---
id: todo-e9x
title: "Fix localId uniqueness to be scoped per repository"
state: open
priority: 2
type: bug
labels: [apps, bug]
---

# Fix localId uniqueness to be scoped per repository

In apps/admin/src/collections/Issues.ts:47-53, localId should be unique per repository, not globally. Different repos could have conflicting IDs. Add compound index or scoped validation (repo + localId).

### Timeline

- **Created:** 12/20/2025

