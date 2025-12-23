---
id: todo-0sts
title: "StatefulDO base class with RPC persistence"
state: closed
priority: 1
type: task
labels: ["do", "xstate"]
createdAt: "2025-12-21T14:59:06.991Z"
updatedAt: "2025-12-21T15:17:23.705Z"
closedAt: "2025-12-21T15:17:23.705Z"
source: "beads"
dependsOn: ["todo-qd32", "todo-p4ze", "todo-q4i1"]
blocks: ["todo-d06d"]
---

# StatefulDO base class with RPC persistence

Create base class for DOs that persist state via RPC:

`worker/src/do/base.ts`

Features:
- Get RPC stub to main worker via `this.env.WORKER.get(PersistenceRPC)`
- persistToD1() with steep logarithmic backoff (10 retries, up to ~100s delay)
- registerDO() for first-time creation
- onTransition() called on every XState transition

```typescript
abstract class StatefulDO {
  protected abstract doType: string
  protected abstract ref: string
  protected machineState: any
  
  private get rpc(): PersistenceRPC { ... }
  protected async persistToD1(maxRetries = 10): Promise<void> { ... }
  protected onTransition(newState: any): void { ... }
}
```

### Related Issues

**Depends on:**
- [todo-qd32](./todo-qd32.md)
- [todo-p4ze](./todo-p4ze.md)
- [todo-q4i1](./todo-q4i1.md)

**Blocks:**
- [todo-d06d](./todo-d06d.md)