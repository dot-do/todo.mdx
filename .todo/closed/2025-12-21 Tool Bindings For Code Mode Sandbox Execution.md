---
id: todo-xi84
title: "Tool bindings for Code Mode sandbox execution"
state: closed
priority: 1
type: task
labels: ["code-mode", "sandbox"]
createdAt: "2025-12-21T14:59:34.498Z"
updatedAt: "2025-12-21T15:18:39.510Z"
closedAt: "2025-12-21T15:18:39.510Z"
source: "beads"
dependsOn: ["todo-qd32", "todo-76xz"]
blocks: ["todo-d06d"]
---

# Tool bindings for Code Mode sandbox execution

Create bindings for Code Mode execution:

`worker/src/tools/bindings.ts`

```typescript
export function createToolBindings(
  connections: Connection[],
  registry: ToolRegistry
): Record<string, Record<string, Function>>
```

Creates env object with all connected tools:
- env.github.createPullRequest(...)
- env.slack.postMessage(...)
- env.browser.fetchPage(...)

Routes calls through appropriate provider (native preferred, then Composio).

`worker/src/codegen/typedefs.ts`

Generates TypeScript .d.ts from available connections for agent context:
```typescript
declare const github: {
  createBranch(params: { repo: string; ref: string }): Promise<Branch>
  ...
}
```

### Related Issues

**Depends on:**
- [todo-qd32](./todo-qd32.md)
- [todo-76xz](./todo-76xz.md)

**Blocks:**
- [todo-d06d](./todo-d06d.md)