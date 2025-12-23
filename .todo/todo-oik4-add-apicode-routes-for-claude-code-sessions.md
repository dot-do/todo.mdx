---
id: todo-oik4
title: "Add /api/code routes for Claude Code sessions"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T11:57:17.084Z"
updatedAt: "2025-12-21T12:02:04.435Z"
closedAt: "2025-12-21T12:02:04.435Z"
source: "beads"
---

# Add /api/code routes for Claude Code sessions

Add API routes for Claude Code session management.

## File: `worker/src/api/code.ts`

Routes:
- `POST /api/code/:org/:repo/start` - Start Claude Code session
  - Body: `{ task?: string, ref?: string }`
  - Returns: `{ sessionId, wsUrl }`
  - Auto-lookup installation ID from repo

- `GET /api/code/:org/:repo/sessions` - List active sessions for repo
- `DELETE /api/code/:org/:repo/sessions/:id` - Terminate session

## Integration:
- Use existing ClaudeSandbox Durable Object
- Lookup repo → installation mapping via Payload
- Create terminal session with repo context

### Related Issues

**Depends on:**
- **todo-veny**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
