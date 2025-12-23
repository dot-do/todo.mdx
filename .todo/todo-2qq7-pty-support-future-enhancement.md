---
id: todo-2qq7
title: "PTY support (future enhancement)"
state: closed
priority: 4
type: feature
labels: []
createdAt: "2025-12-20T22:59:29.988Z"
updatedAt: "2025-12-23T10:08:49.124Z"
closedAt: "2025-12-23T10:08:49.124Z"
source: "beads"
---

# PTY support (future enhancement)

Upgrade from pipe mode to PTY mode for full terminal support.

**Why needed:**
- Pipe mode works for line-based/stdin-driven programs
- Full-screen TUIs (vim, top, htop) need PTY
- Proper Ctrl+C semantics require PTY
- Terminal resizing needs PTY to propagate SIGWINCH

**Approach options:**
1. Use node-pty in the sandbox to create PTY
2. Use ttyd/wetty and adapt CLI to their protocol
3. Custom PTY-to-WS bridge

**Wire protocol changes:**
- Resize messages become meaningful
- Signal handling more precise

**Status:** Future enhancement, not blocking initial implementation

### Related Issues

**Depends on:**
- **todo-e1g**
- **todo-nsd**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
