---
id: todo-76xz
title: "Tool types, registry, and naming utilities"
state: closed
priority: 1
type: task
labels: ["foundation"]
createdAt: "2025-12-21T14:58:34.266Z"
updatedAt: "2025-12-21T15:07:03.421Z"
closedAt: "2025-12-21T15:07:03.421Z"
source: "beads"
---

# Tool types, registry, and naming utilities

Create the foundation for the tool system:

- `worker/src/tools/types.ts` - Integration, Tool, Connection types
- `worker/src/tools/registry.ts` - ToolRegistry class that manages all integrations
- `worker/src/tools/naming.ts` - toBindingName (PascalCase→camelCase), toStorageName utilities

Key types:
```typescript
interface Integration {
  name: string  // 'GitHub' (PascalCase for storage)
  tools: Tool[]
}

interface Tool {
  name: string              // 'createPullRequest'
  fullName: string          // 'github.createPullRequest' (camelCase for bindings)
  schema: z.ZodSchema
  execute: (params: any, connection: Connection) => Promise<any>
}
```

### Related Issues

**Depends on:**
- **todo-qd32**

**Blocks:**
- **todo-1n31**
- **todo-1wm2**
- **todo-aykh**
- **todo-bglm**
- **todo-jsfq**
- **todo-xi84**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
