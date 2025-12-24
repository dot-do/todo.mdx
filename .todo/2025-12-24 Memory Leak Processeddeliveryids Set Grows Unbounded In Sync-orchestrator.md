---
id: todo-w5j0
title: "Memory leak: processedDeliveryIds Set grows unbounded in sync-orchestrator"
state: open
priority: 2
type: bug
labels: ["code-review", "memory-leak", "worker"]
createdAt: "2025-12-24T11:15:06.840Z"
updatedAt: "2025-12-24T11:15:06.840Z"
source: "beads"
---

# Memory leak: processedDeliveryIds Set grows unbounded in sync-orchestrator

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/sync-orchestrator.ts:85`

**Problem:** The `processedDeliveryIds` Set is used for webhook deduplication but grows indefinitely. In a long-running worker instance, this could lead to memory exhaustion.

**Code:**
```typescript
export function createSyncOrchestrator(options: SyncOrchestratorOptions): SyncOrchestrator {
  // ...
  // Track processed webhook delivery IDs to prevent duplicates
  const processedDeliveryIds = new Set<string>()
  // ...
  
  async function processWebhookEvent(event: WebhookEvent): Promise<SyncResult> {
    // ...
    if (processedDeliveryIds.has(event.deliveryId)) {
      return result // Skip duplicate
    }
    processedDeliveryIds.add(event.deliveryId)  // Never cleaned up
    // ...
  }
}
```

**Impact:** Each orchestrator instance accumulates delivery IDs without bounds. In Cloudflare Workers this is less critical since workers are short-lived, but if used in a long-running server context, this becomes a memory leak.

**Recommended Fix:**
1. Use a bounded LRU cache instead of a Set
2. Or implement time-based expiration (e.g., expire entries after 1 hour)
3. Or rely on external storage (Durable Objects) for deduplication