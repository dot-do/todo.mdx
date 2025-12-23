---
id: todo-bglm
title: "Composio SDK client and tool normalization"
state: closed
priority: 2
type: task
labels: ["composio", "tools"]
createdAt: "2025-12-21T14:59:29.043Z"
updatedAt: "2025-12-21T16:10:42.039Z"
closedAt: "2025-12-21T16:10:42.039Z"
source: "beads"
---

# Composio SDK client and tool normalization

Integrate Composio SDK:

- `worker/src/tools/composio/client.ts` - getComposio(), getComposioTools()
- `worker/src/tools/composio/normalize.ts` - convert GITHUB_CREATE_ISSUE → github.createIssue
- `worker/src/tools/composio/execute.ts` - executeComposioTool()

Add COMPOSIO_API_KEY to Env type and wrangler secrets.

```typescript
import { Composio } from '@composio/core'

export function getComposio(env: Env): Composio {
  return new Composio({ apiKey: env.COMPOSIO_API_KEY })
}

// Normalize: GITHUB_CREATE_PULL_REQUEST → github.createPullRequest
function normalizeComposioTool(tool: ComposioTool): Tool { ... }
```

pnpm add @composio/core to worker package.

### Related Issues

**Depends on:**
- **todo-qd32**
- **todo-76xz**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
