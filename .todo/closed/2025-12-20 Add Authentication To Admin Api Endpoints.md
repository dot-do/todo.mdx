---
id: todo-ui7
title: "Add authentication to admin API endpoints"
state: closed
priority: 0
type: bug
labels: ["critical", "security", "worker"]
createdAt: "2025-12-20T20:02:19.819Z"
updatedAt: "2025-12-20T23:07:13.208Z"
closedAt: "2025-12-20T23:07:13.208Z"
source: "beads"
---

# Add authentication to admin API endpoints

Unauthenticated admin endpoints at src/index.ts:576-594 expose GitHub installation IDs, repo metadata, and sensitive configuration. Endpoints /api/installations and /api/installations/:id/repos need authMiddleware.