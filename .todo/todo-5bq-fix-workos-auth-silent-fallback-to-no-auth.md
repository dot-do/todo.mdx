---
id: todo-5bq
title: "Fix WorkOS auth silent fallback to no auth"
state: closed
priority: 1
type: bug
labels: ["apps", "security"]
createdAt: "2025-12-20T20:02:54.842Z"
updatedAt: "2025-12-21T13:30:45.924Z"
closedAt: "2025-12-21T13:30:45.924Z"
source: "beads"
---

# Fix WorkOS auth silent fallback to no auth

In apps/todo.mdx.do/middleware.ts:6-25, if WorkOS env vars are missing, middleware silently disables all authentication. Could accidentally deploy unprotected app to production. Should throw error in production if WorkOS is not configured.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
