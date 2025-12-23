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
- **todo-qd32**
- **todo-76xz**

**Blocks:**
- **todo-d06d**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
