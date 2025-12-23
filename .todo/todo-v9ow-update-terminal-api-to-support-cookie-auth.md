---
id: todo-v9ow
title: "Update terminal API to support cookie auth"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T11:57:17.150Z"
updatedAt: "2025-12-21T12:02:04.396Z"
closedAt: "2025-12-21T12:02:04.396Z"
source: "beads"
---

# Update terminal API to support cookie auth

Update the terminal API routes to support both cookie-based and token-based auth.

## File: `worker/src/api/terminal.ts`

Changes:
- Add SSE endpoint `GET /api/terminal/:id/events`
- Support cookie auth in addition to bearer token
- For WebSocket: accept token from query param `?token=<session-token>`
- Add terminate endpoint `POST /api/terminal/:id/terminate`

## Auth flow for WebSocket:
1. Widget page calls `GET /api/auth/token` to get session token
2. Passes token as `?token=<token>` in WebSocket URL
3. Terminal API validates token before upgrade

### Related Issues

**Depends on:**
- **todo-veny**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
