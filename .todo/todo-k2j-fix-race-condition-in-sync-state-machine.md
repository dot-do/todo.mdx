---
id: todo-k2j
title: "Fix race condition in sync state machine"
state: open
priority: 2
type: bug
labels: [bug, worker]
---

# Fix race condition in sync state machine

In src/do/repo.ts:353-358, state is checked after send which might process events twice or skip them. Use XState's proper actor invocation pattern.

### Timeline

- **Created:** 12/20/2025

