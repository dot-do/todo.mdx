---
id: todo-nsd
title: "Stdio Mirror over WebSockets for Cloudflare Sandbox"
state: closed
priority: 1
type: epic
labels: []
createdAt: "2025-12-20T22:59:29.315Z"
updatedAt: "2025-12-20T23:30:17.090Z"
closedAt: "2025-12-20T23:30:17.090Z"
source: "beads"
---

# Stdio Mirror over WebSockets for Cloudflare Sandbox

Implement a stdio mirroring system over WebSockets that enables CLI clients to interact with processes running inside Cloudflare Sandbox containers.

**Architecture:**
- Sandbox container runs a Bun WebSocket server on port 8080
- Worker proxies WebSocket connections via `sandbox.wsConnect(request, 8080)`
- CLI client mirrors local stdin/stdout/stderr to the WebSocket

**Wire Protocol:**
- Client → Server: Binary (stdin bytes), Text JSON (resize/signal control)
- Server → Client: Binary with 1-byte header (0x01=stdout, 0x02=stderr), Text JSON (exit)

**Auth:** Uses oauth.do (`import { ensureLoggedIn } from 'oauth.do/node'`)

## Shared Infrastructure with xterm.js/Web IDE

This architecture shares components with the browser-based terminal work:
- **Sandbox server** (`stdio-ws.ts`) serves both CLI and browser clients
- **Worker proxy** handles both Bun CLI and xterm.js WebSocket connections
- **Wire protocol** should be unified (binary is more efficient, but both can demux)

### Related Issues (Browser-side, closed):
- `todo-5zv` - xterm.js + React component
- `todo-wm0` - WebSocket endpoint for terminal session management  
- `todo-42f` - Sandbox SDK integration for Claude Code

### Related Issues (Open, can share):
- `todo-wko` - Terminal session persistence with Durable Objects
- `todo-1u3` - Shared terminal sessions (user + Claude)
- `todo-0ot` - tmux-based multi-pane terminal

The new tickets focus on the **CLI client** (`sbx-stdio`) while reusing the shared backend.

### Related Issues

**Depends on:**
- **todo-wm0**
- **todo-42f**
- **todo-5zv**

**Blocks:**
- **todo-1u3**
- **todo-2qq7**
- **todo-42j**
- **todo-7ct**
- **todo-7s0**
- **todo-e1g**
- **todo-mqg**
- **todo-qm7**
- **todo-r1i**
- **todo-wko**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
