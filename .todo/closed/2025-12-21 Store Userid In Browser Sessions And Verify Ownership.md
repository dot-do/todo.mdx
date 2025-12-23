---
id: todo-mhds
title: "Store userId in browser sessions and verify ownership"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-22T00:16:28.330Z"
updatedAt: "2025-12-22T00:25:37.627Z"
closedAt: "2025-12-22T00:25:37.627Z"
source: "beads"
---

# Store userId in browser sessions and verify ownership

Sessions stored in KV don't include userId. Any user can access any session by knowing/guessing the session ID.