---
id: todo-i28
title: "Add sandbox capability grants for MCP `do` tool context"
state: closed
priority: 2
type: task
labels: ["mcp", "sandbox", "security"]
createdAt: "2025-12-20T18:35:09.110Z"
updatedAt: "2025-12-20T23:31:28.796Z"
closedAt: "2025-12-20T23:31:28.796Z"
source: "beads"
---

# Add sandbox capability grants for MCP `do` tool context

When migrating the MCP `do` tool to use the sandbox loader, we need to ensure the sandboxed code has access to the pre-loaded data (repos, issues, milestones, projects) that the current implementation provides.

The sandbox client code in `loader.ts` provides APIs like `issues.list()`, `milestones.get()`, etc. but the `do` tool currently injects these as raw arrays.

**Options**:
1. Inject data as module globals in the sandbox (like current approach)
2. Pre-fetch and expose via the CapnWeb RPC client
3. Lazy-load through RPC calls when accessed

Need to decide which approach maintains the `do` tool's simplicity while gaining sandbox security.

**Related files**:
- `worker/src/sandbox/loader.ts` - SANDBOX_CLIENT_CODE (lines 261-303)
- `worker/src/sandbox/server.ts` - CapnWeb RPC handlers

### Related Issues

**Depends on:**
- **todo-9sv**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
