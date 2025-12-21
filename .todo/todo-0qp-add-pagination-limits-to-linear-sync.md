---
id: todo-0qp
title: "Add pagination limits to Linear sync"
state: open
priority: 2
type: bug
labels: [bug, worker]
---

# Add pagination limits to Linear sync

In src/integrations/linear.ts:517-522, while(hasNextPage) with no limit could cause infinite loop on large workspaces. Add max page count (e.g., 100 pages).

### Timeline

- **Created:** 12/20/2025

