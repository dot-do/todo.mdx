---
id: todo-5bq
title: "Fix WorkOS auth silent fallback to no auth"
state: open
priority: 1
type: bug
labels: [apps, security]
---

# Fix WorkOS auth silent fallback to no auth

In apps/todo.mdx.do/middleware.ts:6-25, if WorkOS env vars are missing, middleware silently disables all authentication. Could accidentally deploy unprotected app to production. Should throw error in production if WorkOS is not configured.

### Timeline

- **Created:** 12/20/2025

