---
id: todo-jlxj
title: "Agent base class, types, and AgentDef interface"
state: closed
priority: 1
type: task
labels: ["agents", "foundation"]
createdAt: "2025-12-21T18:47:16.340Z"
updatedAt: "2025-12-21T19:08:38.225Z"
closedAt: "2025-12-21T19:08:38.225Z"
source: "beads"
---

# Agent base class, types, and AgentDef interface

Create the foundation for the agent system:

`worker/src/agents/base.ts`

```typescript
abstract class Agent extends RpcTarget {
  abstract def: AgentDef
  do(task: string, options?: DoOptions): Promise<DoResult>
  ask(question: string, options?: AskOptions): Promise<AskResult>
}
```

Types: AgentDef, DoOptions, AskOptions, DoResult, AskResult, AgentEvent

Key fields on AgentDef:
- id, name, description
- tools: string[]
- tier: 'light' | 'worker' | 'sandbox'
- model: 'best' | 'fast' | 'cheap' | 'overall' | string
- framework: 'ai-sdk' | 'claude-agent-sdk' | 'openai-agents' | 'claude-code'
- instructions?: string

### Related Issues

**Depends on:**
- **todo-ygfz**

**Blocks:**
- **todo-1kwc**
- **todo-b11q**
- **todo-c5ta**
- **todo-erjv**
- **todo-nvxq**
- **todo-sccq**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
