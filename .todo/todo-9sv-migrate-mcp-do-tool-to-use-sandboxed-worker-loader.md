---
id: todo-9sv
title: "Migrate MCP `do` tool to use sandboxed worker loader"
state: in_progress
priority: 1
type: task
labels: [mcp, sandbox, security]
---

# Migrate MCP `do` tool to use sandboxed worker loader

The MCP `do` tool currently uses `new Function()` for code execution, which is essentially eval with no isolation. The workflow execution system uses the proper sandboxed worker loader with CapnWeb capability security.

**Current (insecure)**:
```javascript
const fn = new Function('return (async () => { ' + wrappedCode + ' })()')
const result = await fn()
```

**Target (sandboxed)**:
Use `executeSandboxedWorkflow()` from `worker/src/sandbox/loader.ts` which provides:
- Dynamic worker loader (`env.LOADER.get()`)
- CapnWeb RPC for capability-controlled API access  
- `SandboxOutboundProxy` blocking unauthorized network access
- Proper module isolation

**Files**:
- `worker/src/mcp/index.ts` - MCP `do` tool implementation (lines 871-937)
- `worker/src/sandbox/loader.ts` - Sandbox loader to use

### Related Issues

**Blocks:**
- **todo-i28**: Add sandbox capability grants for MCP `do` tool context

### Timeline

- **Created:** 12/20/2025

