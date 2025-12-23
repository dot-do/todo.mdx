---
id: todo-0qp
title: "Add pagination limits to Linear sync"
state: closed
priority: 2
type: bug
labels: ["bug", "worker"]
createdAt: "2025-12-20T20:03:28.749Z"
updatedAt: "2025-12-20T23:30:59.686Z"
closedAt: "2025-12-20T23:30:59.686Z"
source: "beads"
---

# Add pagination limits to Linear sync

In src/integrations/linear.ts:517-522, while(hasNextPage) with no limit could cause infinite loop on large workspaces. Add max page count (e.g., 100 pages).

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
