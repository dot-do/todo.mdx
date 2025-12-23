---
id: todo-mqg
title: "Worker WebSocket proxy handler"
state: closed
priority: 1
type: feature
labels: []
createdAt: "2025-12-20T22:59:29.647Z"
updatedAt: "2025-12-20T23:28:42.988Z"
closedAt: "2025-12-20T23:28:42.988Z"
source: "beads"
dependsOn: ["todo-42j", "todo-qm7", "todo-nsd"]
---

# Worker WebSocket proxy handler

Implement the Worker handler that proxies WebSocket connections into the sandbox.

**Implementation:**
- Check for `Upgrade: websocket` header
- Extract `sandbox` ID from query params (default: 'default')
- Authenticate using oauth.do
- Call `sandbox.wsConnect(request, 8080)` to proxy into sandbox port

**Key code:**
```typescript
import { getSandbox } from '@cloudflare/sandbox';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const url = new URL(request.url);
      const sandboxId = url.searchParams.get('sandbox') ?? 'default';
      // TODO: oauth.do auth check
      const sandbox = getSandbox(env.Sandbox, sandboxId);
      return await sandbox.wsConnect(request, 8080);
    }
    return new Response('ok\n');
  }
};
```

**Files:**
- `worker/src/sandbox/index.ts` or integrate into existing worker

### Related Issues

**Depends on:**
- [todo-42j](./todo-42j.md)
- [todo-qm7](./todo-qm7.md)
- [todo-nsd](./todo-nsd.md)