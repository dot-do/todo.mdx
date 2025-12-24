---
id: todo-v18a
title: "Type mismatch: Installation entity interfaces differ between entities.ts and index.ts"
state: open
priority: 1
type: bug
labels: ["code-review", "type-safety", "worker"]
createdAt: "2025-12-24T11:15:33.699Z"
updatedAt: "2025-12-24T11:15:33.699Z"
source: "beads"
---

# Type mismatch: Installation entity interfaces differ between entities.ts and index.ts

**File:** `/Users/nathanclevenger/projects/todo.mdx/worker/github-sync/entities.ts:23-34` and `/Users/nathanclevenger/projects/todo.mdx/worker/index.ts:98-111`

**Problem:** The `Installation` interface in entities.ts differs from what's being stored in the webhook handler in index.ts.

**entities.ts Installation:**
```typescript
export interface Installation {
  $type: 'Installation'
  $id: string
  githubInstallationId: number
  owner: string
  repo: string
  accessToken: string
  tokenExpiresAt: string
  conventions?: GitHubConventions
  createdAt: string
  updatedAt: string
}
```

**index.ts handleInstallationCreated stores:**
```typescript
await store.Installation.create({
  installationId,        // Different name: installationId vs githubInstallationId
  accountLogin: account.login,  // Different: accountLogin vs owner
  accountId: account.id,        // Not in interface
  accountType: account.type,    // Not in interface
  // Missing: owner, repo, accessToken, tokenExpiresAt
})
```

**Impact:** 
- Type safety is broken
- The stored data doesn't match the expected interface
- Code using the Installation entity will fail at runtime

**Recommended Fix:** Align the interface and storage code, or create separate types for the webhook storage vs sync orchestrator usage.