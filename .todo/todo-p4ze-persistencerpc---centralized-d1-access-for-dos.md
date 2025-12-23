---
id: todo-p4ze
title: "PersistenceRPC - centralized D1 access for DOs"
state: closed
priority: 1
type: task
labels: ["foundation", "rpc"]
createdAt: "2025-12-21T14:59:01.527Z"
updatedAt: "2025-12-21T15:12:22.612Z"
closedAt: "2025-12-21T15:12:22.612Z"
source: "beads"
---

# PersistenceRPC - centralized D1 access for DOs

Create RPC entrypoint for DOs to persist state to D1:

`worker/src/rpc/persistence.ts`

```typescript
export class PersistenceRPC extends WorkerEntrypoint<Env> {
  async persistDOState(params: {
    doId: string
    type: 'org' | 'repo' | 'project' | 'pr' | 'issue'
    ref: string
    state: any
  }): Promise<{ success: boolean; error?: string }>

  async logToolExecution(params: { ... }): Promise<void>

  async getConnections(userId: string, apps?: string[]): Promise<Connection[]>
}
```

Update wrangler.jsonc to add service binding:
```jsonc
"services": [{
  "binding": "WORKER",
  "service": "todo-mdx-worker",
  "entrypoint": "PersistenceRPC"
}]
```

DOs never touch D1 directly - all writes go through this RPC.

### Related Issues

**Depends on:**
- **todo-qd32**

**Blocks:**
- **todo-0sts**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
