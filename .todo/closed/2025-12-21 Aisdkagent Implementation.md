---
id: todo-nvxq
title: "AiSdkAgent implementation"
state: closed
priority: 1
type: task
labels: ["agents", "ai-sdk"]
createdAt: "2025-12-21T18:47:27.728Z"
updatedAt: "2025-12-21T19:18:19.842Z"
closedAt: "2025-12-21T19:18:19.842Z"
source: "beads"
dependsOn: ["todo-ygfz", "todo-jlxj"]
blocks: ["todo-1kwc"]
---

# AiSdkAgent implementation

Implement the AI SDK (Vercel) agent:

`worker/src/agents/impl/ai-sdk.ts`

Uses `generateText()` from AI SDK v6:
- do() with tool loop via maxSteps
- ask() simple text generation
- onStepFinish callback for streaming events
- Integrates with Tool Registry for tool definitions

```typescript
class AiSdkAgent extends Agent {
  async do(task: string, options?: DoOptions): Promise<DoResult> {
    const result = await generateText({
      model: this.getModel(),
      system: this.def.instructions,
      prompt: task,
      tools: this.getTools(),
      maxSteps: options?.maxSteps ?? 10,
      onStepFinish: (step) => options?.onEvent?.(...)
    })
    return this.toDoResult(result)
  }
}
```

### Related Issues

**Depends on:**
- [todo-ygfz](./todo-ygfz.md)
- [todo-jlxj](./todo-jlxj.md)

**Blocks:**
- [todo-1kwc](./todo-1kwc.md)