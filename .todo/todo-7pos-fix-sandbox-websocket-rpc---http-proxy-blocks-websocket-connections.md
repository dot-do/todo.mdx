---
id: todo-7pos
title: "Fix sandbox WebSocket RPC - HTTP proxy blocks WebSocket connections"
state: closed
priority: 0
type: bug
labels: ["critical", "sandbox"]
createdAt: "2025-12-22T00:23:30.704Z"
updatedAt: "2025-12-22T08:43:25.005Z"
closedAt: "2025-12-22T08:43:25.005Z"
source: "beads"
---

# Fix sandbox WebSocket RPC - HTTP proxy blocks WebSocket connections

The sandbox client code references WebSocket RPC (ws://rpc.sandbox/) but SandboxOutboundProxy.fetch() only handles HTTP requests and blocks WebSocket connections. Sandbox API calls fail at runtime.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
