---
id: todo-i6vs
title: "PRDO integration with approval gates"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T18:43:18.621Z"
updatedAt: "2025-12-21T20:02:00.222Z"
closedAt: "2025-12-21T20:02:00.222Z"
source: "beads"
dependsOn: ["todo-3auj", "todo-6i9r", "todo-o9pp"]
---

# PRDO integration with approval gates

Before PRDO auto-merges, check approval gate config:

1. Load approval config for org/repo
2. Evaluate PR against triggers (labels, files, risk)
3. If human approval required:
   - Transition to 'awaiting_human_approval' state
   - Use step.waitForEvent() for human review
4. If auto-merge allowed:
   - Proceed to merge after AI approvals

### Related Issues

**Depends on:**
- [todo-3auj](./todo-3auj.md)
- [todo-6i9r](./todo-6i9r.md)
- [todo-o9pp](./todo-o9pp.md)