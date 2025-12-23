---
id: todo-c5ta
title: "OpenAiAgentsAgent implementation"
state: closed
priority: 3
type: task
labels: ["agents", "openai"]
createdAt: "2025-12-21T18:48:14.404Z"
updatedAt: "2025-12-21T22:10:48.027Z"
closedAt: "2025-12-21T22:10:48.027Z"
source: "beads"
dependsOn: ["todo-ygfz", "todo-jlxj"]
---

# OpenAiAgentsAgent implementation

Implement OpenAI Agents SDK agent:

`worker/src/agents/impl/openai-agents.ts`

Uses agents + handoffs + guardrails pattern:
- Agent loop with automatic tool execution
- Built-in tracing for debugging
- Zod-powered validation

```typescript
class OpenAiAgentsAgent extends Agent {
  async do(task: string, options?: DoOptions): Promise<DoResult> {
    // Use OpenAI Agents SDK
    // Stream events via onEvent callback
  }
}
```

### Related Issues

**Depends on:**
- [todo-ygfz](./todo-ygfz.md)
- [todo-jlxj](./todo-jlxj.md)