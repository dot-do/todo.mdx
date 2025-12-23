---
id: todo-6a9
title: "Create claude.mdx CLI package"
state: closed
priority: 1
type: feature
labels: []
createdAt: "2025-12-20T15:25:32.233Z"
updatedAt: "2025-12-20T17:31:24.535Z"
closedAt: "2025-12-20T17:31:24.535Z"
source: "beads"
---

# Create claude.mdx CLI package

Bun CLI that orchestrates AI-assisted development:
- Wraps roadmap.mdx and todo.mdx
- Dispatches Claude Code sessions to work on TODOs
- Uses beads for issue tracking
- Picks 'ready' issues and launches claude code with context
- Can run in daemon mode watching for new issues
- Integrates with todo.mdx SDK for online/offline

Commands:
- claude.mdx work [issue-id] - Start session for specific issue
- claude.mdx next - Pick next ready issue and start session  
- claude.mdx daemon - Watch mode, auto-dispatch sessions
- claude.mdx status - Show active sessions and progress

### Related Issues

**Depends on:**
- **todo-4fh**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
