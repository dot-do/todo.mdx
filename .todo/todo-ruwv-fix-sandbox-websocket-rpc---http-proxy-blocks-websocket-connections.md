---
id: todo-ruwv
title: "Fix sandbox WebSocket RPC - HTTP proxy blocks WebSocket connections"
state: closed
priority: 1
type: bug
labels: []
createdAt: "2025-12-22T00:24:49.733Z"
updatedAt: "2025-12-22T06:50:14.481Z"
closedAt: "2025-12-22T06:50:14.481Z"
source: "beads"
---

# Fix sandbox WebSocket RPC - HTTP proxy blocks WebSocket connections

Sandbox client references ws://rpc.sandbox/ but SandboxOutboundProxy.fetch() only handles HTTP and blocks WebSocket. Sandbox API calls fail at runtime.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/22/2025
- **Closed:** 12/22/2025
