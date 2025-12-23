---
id: todo-tpef
title: "PRDO dispatches review sessions to ClaudeSandbox"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:42:25.771Z"
updatedAt: "2025-12-21T19:49:53.513Z"
closedAt: "2025-12-21T19:49:53.513Z"
source: "beads"
dependsOn: ["todo-o9pp", "todo-tnwk", "todo-gavy"]
blocks: ["todo-osnn"]
---

# PRDO dispatches review sessions to ClaudeSandbox

When PRDO enters 'reviewing' state, dispatch a Claude session:

1. Load reviewer persona config
2. Build review prompt with PR context
3. Call ClaudeSandbox with reviewer's PAT
4. Claude clones repo, reviews code, submits GitHub review
5. Callback to PRDO with session result

### Related Issues

**Depends on:**
- [todo-o9pp](./todo-o9pp.md)
- [todo-tnwk](./todo-tnwk.md)
- [todo-gavy](./todo-gavy.md)

**Blocks:**
- [todo-osnn](./todo-osnn.md)