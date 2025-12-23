---
id: todo-e1g
title: "Sandbox stdio-ws.ts WebSocket server"
state: closed
priority: 1
type: feature
labels: []
createdAt: "2025-12-20T22:59:29.488Z"
updatedAt: "2025-12-20T23:30:57.319Z"
closedAt: "2025-12-20T23:30:57.319Z"
source: "beads"
---

# Sandbox stdio-ws.ts WebSocket server

Implement the Bun WebSocket server that runs inside the sandbox container and bridges WebSocket messages to child process stdio.

**NOTE:** This server handles BOTH CLI and browser clients using the same protocol.

## Key implementation
- Listen on `0.0.0.0:8080`
- Accept `?cmd=` and `?arg=` query params to specify command
- On WS open: spawn process with `Bun.spawn([cmd, ...args], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })`
- Pump stdout/stderr to WS as binary with stream ID prefix
- Write incoming binary WS messages to child stdin
- Handle JSON control messages (resize, signal)
- Send `{ type: 'exit', code }` on process exit

## Connection Sources
1. **Bun CLI** (`sbx-stdio`) - direct from user terminal
2. **Browser** (xterm.js via Worker) - from dashboard

Both use same binary protocol, demux by stream ID.

## Files
- `sandbox/stdio-ws.ts` - main server
- Uses wire protocol from shared `packages/sandbox-stdio/`

## Relation to existing work
Replaces/evolves the approach in `todo-wm0` which used `sandbox.execStream()`. 
This approach runs a dedicated WS server, giving more control over the protocol.

### Related Issues

**Depends on:**
- **todo-42j**
- **todo-nsd**

**Blocks:**
- **todo-2qq7**
- **todo-7ct**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
