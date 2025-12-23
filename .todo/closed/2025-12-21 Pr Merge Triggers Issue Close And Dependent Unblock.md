---
id: todo-1q18
title: "PR merge triggers issue close and dependent unblock"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-21T18:41:32.201Z"
updatedAt: "2025-12-21T19:07:12.880Z"
closedAt: "2025-12-21T19:07:12.880Z"
source: "beads"
dependsOn: ["todo-d502", "todo-addd"]
---

# PR merge triggers issue close and dependent unblock

When PR merges:
1. Close the linked issue in beads
2. Sync close to GitHub Issues
3. Check for newly unblocked dependents
4. Trigger DevelopWorkflow for each unblocked issue

This closes the autonomy loop.

### Related Issues

**Depends on:**
- [todo-d502](./todo-d502.md)
- [todo-addd](./todo-addd.md)