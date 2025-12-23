---
id: todo-dd6j
title: "Create /terminal widget HTML page"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T11:57:16.950Z"
updatedAt: "2025-12-21T12:08:19.065Z"
closedAt: "2025-12-21T12:08:19.065Z"
source: "beads"
---

# Create /terminal widget HTML page

Create the embeddable terminal widget page at `/terminal`.

## File: `worker/public/terminal.html`

Features:
- Check session cookie, redirect to login if needed
- Accept `?session=<id>` query param to connect to existing session
- Accept `?repo=<org/repo>&task=<task>` to auto-start new session
- Full-screen xterm.js terminal
- Status bar showing connection state
- Minimal UI optimized for iframe embedding

## Route in worker:
Add route handler to serve this page at `/terminal`

### Related Issues

**Depends on:**
- **todo-veny**
- **todo-1bqa**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
