---
id: todo-vqau
title: "ModelDefaults collection + model resolution"
state: closed
priority: 2
type: task
labels: ["models"]
createdAt: "2025-12-21T18:47:45.414Z"
updatedAt: "2025-12-21T19:18:06.217Z"
closedAt: "2025-12-21T19:18:06.217Z"
source: "beads"
---

# ModelDefaults collection + model resolution

Create ModelDefaults for best/fast/cheap/overall mapping:

`apps/admin/src/collections/ModelDefaults.ts`

Fields:
- useCase: select [best, fast, cheap, overall]
- taskType: select [coding, research, browser, general]
- model: relationship to models
- org: relationship to installations (null = global)

`worker/src/agents/models.ts`

```typescript
async function resolveModel(
  agentDef: AgentDef,
  context: { orgId?: string; taskType?: string }
): Promise<{ provider: string; model: string }>
```

Resolution: explicit model → org defaults → global defaults

### Related Issues

**Depends on:**
- **todo-ygfz**
- **todo-t8ts**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
