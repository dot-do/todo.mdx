---
id: todo-4ds6
title: "Add EOF signaling for stdin in stdio-ws"
state: closed
priority: 2
type: feature
labels: ["protocol", "sandbox"]
createdAt: "2025-12-21T22:45:25.420Z"
updatedAt: "2025-12-21T22:53:50.072Z"
closedAt: "2025-12-21T22:53:50.072Z"
source: "beads"
---

# Add EOF signaling for stdin in stdio-ws

Currently there's no way to signal EOF to stdin over WebSocket. Tests use workarounds like `head -n1` instead of proper EOF handling.

Need to add a control message type for EOF that closes the stdin pipe.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
