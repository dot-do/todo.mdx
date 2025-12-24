---
id: todo-znxc
title: "Incomplete implementation: handleIssueEvent and handleCommentEvent have TODO stubs"
state: open
priority: 1
type: task
labels: ["code-review", "incomplete", "worker"]
createdAt: "2025-12-24T11:15:28.387Z"
updatedAt: "2025-12-24T11:15:28.387Z"
source: "beads"
---

# Incomplete implementation: handleIssueEvent and handleCommentEvent have TODO stubs

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/index.ts:127-144`

**Problem:** The main worker webhook handlers for issues and comments are incomplete stubs with TODO comments.

**Code:**
```typescript
async function handleIssueEvent(action: string, payload: any, store: ReturnType<typeof db>): Promise<void> {
  const { issue, repository } = payload
  const repoFullName = repository.full_name

  console.log(`Issue ${action}: ${repoFullName}#${issue.number}`)

  // TODO: Integrate with sync orchestrator
  // This requires beads access which may need additional bindings
}

async function handleCommentEvent(action: string, payload: any, store: ReturnType<typeof db>): Promise<void> {
  const { issue, comment, repository } = payload
  const repoFullName = repository.full_name

  console.log(`Comment ${action} on ${repoFullName}#${issue.number}`)

  // TODO: Sync comments to beads
}
```

**Impact:** 
- Issue webhooks are received but not processed - GitHub changes don't sync to beads
- Comment sync is completely non-functional
- The worker logs events but performs no actual synchronization

**Recommended Fix:** Implement these handlers using the SyncOrchestrator:
1. Create an orchestrator with proper beadsOps and mappingOps wired to the db.td store
2. Call `orchestrator.processWebhookEvent()` with the parsed event