---
id: todo-6mi5
title: "Type safety: WebhookEvent payload is typed as 'any'"
state: open
priority: 3
type: task
labels: ["code-review", "type-safety", "worker"]
createdAt: "2025-12-24T11:15:12.376Z"
updatedAt: "2025-12-24T11:15:12.376Z"
source: "beads"
---

# Type safety: WebhookEvent payload is typed as 'any'

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/webhook.ts:8-14`

**Problem:** The `WebhookEvent` interface uses `any` for the payload type, losing type safety throughout the webhook handling code.

**Code:**
```typescript
export interface WebhookEvent {
  event: string // e.g., 'issues', 'installation'
  action: string // e.g., 'opened', 'edited', 'closed'
  deliveryId: string // X-GitHub-Delivery header
  payload: any // Parsed JSON payload - NO TYPE SAFETY
}
```

**Impact:** 
- Typos in payload property access won't be caught at compile time
- IDE autocomplete doesn't work for payload properties
- Runtime errors from accessing wrong properties

**Recommended Fix:** Create discriminated union types for different webhook event types:
```typescript
interface IssuesWebhookEvent {
  event: 'issues'
  action: 'opened' | 'edited' | 'closed' | 'reopened' | 'labeled' | 'unlabeled' | 'assigned'
  deliveryId: string
  payload: { issue: GitHubIssue; repository: Repository }
}

interface InstallationWebhookEvent {
  event: 'installation'
  action: 'created' | 'deleted'
  deliveryId: string
  payload: { installation: Installation; account: Account }
}

type WebhookEvent = IssuesWebhookEvent | InstallationWebhookEvent | ...
```