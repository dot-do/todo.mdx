---
id: todo-1n31
title: "Tool configuration inheritance (org→repo→project→issue)"
state: closed
priority: 2
type: task
labels: ["config"]
createdAt: "2025-12-21T14:59:39.943Z"
updatedAt: "2025-12-21T16:10:52.714Z"
closedAt: "2025-12-21T16:10:52.714Z"
source: "beads"
dependsOn: ["todo-qd32", "todo-76xz"]
---

# Tool configuration inheritance (org→repo→project→issue)

Implement tool configuration inheritance:

`worker/src/tools/config.ts`

```typescript
interface ToolConfig {
  enabled?: string[]        // ['GitHub', 'Slack']
  disabled?: string[]       // ['Twitter']
  includeDefaults?: boolean // default: true
  requiredApps?: string[]   // Agent won't start without these
}

function resolveToolConfig(hierarchy: ToolConfig[]): ResolvedTools {
  // Merge configs: org → repo → project → issue → assignment
  // enabled accumulates, disabled overrides, requiredApps accumulates
}
```

Add toolConfig json field to:
- installations collection (org level)
- repos collection
- issues collection (extends existing)

### Related Issues

**Depends on:**
- [todo-qd32](./todo-qd32.md)
- [todo-76xz](./todo-76xz.md)