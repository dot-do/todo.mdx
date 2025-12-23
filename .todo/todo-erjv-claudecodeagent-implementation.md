---
id: todo-erjv
title: "ClaudeCodeAgent implementation"
state: closed
priority: 2
type: task
labels: ["agents", "sandbox"]
createdAt: "2025-12-21T18:48:02.727Z"
updatedAt: "2025-12-21T21:59:21.749Z"
closedAt: "2025-12-21T21:59:21.749Z"
source: "beads"
---

# ClaudeCodeAgent implementation

Implement Claude Code sandbox agent:

`worker/src/agents/impl/claude-code.ts`

Launches full Claude Code sandbox for complex tasks:
- do() spawns sandbox, streams events back
- ask() uses Claude Agent SDK v2 for quick queries
- Integrates with existing sandbox infrastructure

This is for tier='sandbox' agents like Full-Stack Fiona.

### Related Issues

**Depends on:**
- **todo-ygfz**
- **todo-jlxj**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
