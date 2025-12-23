---
id: todo-b11q
title: "ClaudeAgentSdkAgent implementation"
state: closed
priority: 2
type: task
labels: ["agents", "claude-sdk"]
createdAt: "2025-12-21T18:48:08.565Z"
updatedAt: "2025-12-21T22:05:26.564Z"
closedAt: "2025-12-21T22:05:26.564Z"
source: "beads"
---

# ClaudeAgentSdkAgent implementation

Implement Claude Agent SDK v2 agent:

`worker/src/agents/impl/claude-agent.ts`

Uses session-based send/receive pattern:
- createSession() / resumeSession()
- session.send() / session.receive()
- Multi-turn conversations with tool use

```typescript
class ClaudeAgentSdkAgent extends Agent {
  async do(task: string, options?: DoOptions): Promise<DoResult> {
    await using session = unstable_v2_createSession({
      model: this.def.model
    })
    await session.send(task)
    for await (const msg of session.receive()) {
      options?.onEvent?.(this.toEvent(msg))
    }
  }
}
```

### Related Issues

**Depends on:**
- **todo-ygfz**
- **todo-jlxj**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
