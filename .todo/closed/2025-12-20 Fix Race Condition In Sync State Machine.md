---
id: todo-k2j
title: "Fix race condition in sync state machine"
state: closed
priority: 2
type: bug
labels: ["bug", "worker"]
createdAt: "2025-12-20T20:03:28.184Z"
updatedAt: "2025-12-20T23:32:37.154Z"
closedAt: "2025-12-20T23:32:37.154Z"
source: "beads"
---

# Fix race condition in sync state machine

In src/do/repo.ts:353-358, state is checked after send which might process events twice or skip them. Use XState's proper actor invocation pattern.