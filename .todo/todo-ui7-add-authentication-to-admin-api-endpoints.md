---
id: todo-ui7
title: "Add authentication to admin API endpoints"
state: open
priority: 0
type: bug
labels: [critical, security, worker]
---

# Add authentication to admin API endpoints

Unauthenticated admin endpoints at src/index.ts:576-594 expose GitHub installation IDs, repo metadata, and sensitive configuration. Endpoints /api/installations and /api/installations/:id/repos need authMiddleware.

### Timeline

- **Created:** 12/20/2025

