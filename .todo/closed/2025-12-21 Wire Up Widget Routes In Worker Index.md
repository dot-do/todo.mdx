---
id: todo-hoft
title: "Wire up widget routes in worker index"
state: closed
priority: 2
type: task
labels: []
createdAt: "2025-12-21T11:57:17.227Z"
updatedAt: "2025-12-21T12:08:19.141Z"
closedAt: "2025-12-21T12:08:19.141Z"
source: "beads"
dependsOn: ["todo-veny"]
---

# Wire up widget routes in worker index

Add route handlers in worker/src/index.ts to serve the widget HTML pages.

## Routes to add:
- `GET /terminal` → serve terminal.html (with auth check)
- `GET /code/:org/:repo` → serve code.html (with auth check)
- `GET /code/:org/:repo/:ref` → serve code.html (with auth check)

## Auth check:
- Check for session cookie
- If missing, redirect to `/api/auth/login?return=<current-url>`
- If valid, serve HTML page

## Static assets:
- Ensure `/assets/*` serves from worker/public/assets/

### Related Issues

**Depends on:**
- [todo-veny](./todo-veny.md)