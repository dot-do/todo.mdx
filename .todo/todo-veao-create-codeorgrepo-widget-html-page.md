---
id: todo-veao
title: "Create /code/:org/:repo widget HTML page"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T11:57:17.015Z"
updatedAt: "2025-12-21T12:08:19.104Z"
closedAt: "2025-12-21T12:08:19.104Z"
source: "beads"
---

# Create /code/:org/:repo widget HTML page

Create the Claude Code widget page at `/code/:org/:repo(/:ref)?`.

## File: `worker/public/code.html`

Features:
- Check session cookie, redirect to login if needed
- Parse org/repo/ref from URL path
- Auto-lookup installation ID for the repo
- Auto-start Claude Code session
- Full-screen xterm.js terminal
- Header showing repo name and branch
- Status bar with connection state

## Routes in worker:
- `/code/:org/:repo` - default branch
- `/code/:org/:repo/:ref` - specific branch/tag/commit

### Related Issues

**Depends on:**
- **todo-veny**
- **todo-1bqa**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
