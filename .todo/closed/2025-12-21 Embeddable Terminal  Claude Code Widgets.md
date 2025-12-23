---
id: todo-veny
title: "Embeddable Terminal & Claude Code Widgets"
state: closed
priority: 1
type: epic
labels: []
createdAt: "2025-12-21T11:56:47.541Z"
updatedAt: "2025-12-21T12:08:25.808Z"
closedAt: "2025-12-21T12:08:25.808Z"
source: "beads"
blocks: ["todo-1bqa", "todo-dd6j", "todo-hoft", "todo-oik4", "todo-v9ow", "todo-veao"]
---

# Embeddable Terminal & Claude Code Widgets

Add iframe-embeddable widget pages for terminal and Claude Code sessions with cookie-based OAuth authentication.

## URL Structure

**Widget Pages (HTML):**
- `/terminal` - Generic terminal widget
- `/code/:org/:repo` - Claude Code for repo (default branch)
- `/code/:org/:repo/:ref` - Claude Code for specific branch/commit

**API Endpoints (JSON/WS/SSE):**
- `POST /api/terminal/start` - Create session
- `GET /api/terminal/:id` - WebSocket upgrade or status
- `GET /api/terminal/:id/events` - SSE stream
- `DELETE /api/terminal/:id` - Terminate session
- `POST /api/code/:org/:repo/start` - Start Claude Code session

## Auth Flow
- Widget pages check `__Host-SESSION` cookie
- If missing → redirect to `/api/auth/login?return=<current-url>`
- After OAuth → cookie set, redirect back to widget

### Related Issues

**Blocks:**
- [todo-1bqa](./todo-1bqa.md)
- [todo-dd6j](./todo-dd6j.md)
- [todo-hoft](./todo-hoft.md)
- [todo-oik4](./todo-oik4.md)
- [todo-v9ow](./todo-v9ow.md)
- [todo-veao](./todo-veao.md)