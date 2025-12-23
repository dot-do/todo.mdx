---
id: todo-qm7
title: "oauth.do authentication integration"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-20T22:59:29.732Z"
updatedAt: "2025-12-20T23:30:57.431Z"
closedAt: "2025-12-20T23:30:57.431Z"
source: "beads"
---

# oauth.do authentication integration

Integrate oauth.do for authenticating WebSocket connections in the Worker.

**Approach:**
```typescript
import { ensureLoggedIn } from 'oauth.do/node';
```

**Implementation notes:**
- For CLI clients: token passed via `?token=` query param or Authorization header
- Worker validates token before calling `sandbox.wsConnect()`
- Consider: how does oauth.do work with WebSocket upgrade requests?
- May need to validate token before upgrade, then proceed

**Files:**
- `worker/src/sandbox/auth.ts` or integrate with existing auth module
- Update worker handler to check auth before proxying

### Related Issues

**Depends on:**
- **todo-nsd**

**Blocks:**
- **todo-mqg**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
