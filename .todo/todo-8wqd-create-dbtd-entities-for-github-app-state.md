---
id: todo-8wqd
title: "Create db.td entities for GitHub App state"
state: closed
priority: 1
type: task
labels: ["db.td", "foundation", "github-app"]
createdAt: "2025-12-23T13:36:56.545Z"
updatedAt: "2025-12-23T13:45:27.210Z"
closedAt: "2025-12-23T13:45:27.210Z"
source: "beads"
---

# Create db.td entities for GitHub App state

Define db.td entity schemas for tracking GitHub App installations, sync state, and issue mappings.

## Entities

### Installation
```typescript
{
  $type: 'Installation',
  githubInstallationId: number,
  owner: string,
  repo: string,
  accessToken: string,
  tokenExpiresAt: string,  // ISO timestamp
  conventions: GitHubConventions,  // Per-repo config
  createdAt: string,
  updatedAt: string
}
```

### SyncState
```typescript
{
  $type: 'SyncState',
  installationId: string,  // ref to Installation
  lastSyncAt: string,
  lastGitHubEventId?: string,  // Webhook cursor
  lastBeadsCommit?: string,  // Git commit hash
  syncStatus: 'idle' | 'syncing' | 'error',
  errorMessage?: string,
  errorCount: number
}
```

### IssueMapping
```typescript
{
  $type: 'IssueMapping',
  installationId: string,
  beadsId: string,
  githubNumber: number,
  githubUrl: string,
  lastSyncedAt: string,
  beadsUpdatedAt: string,
  githubUpdatedAt: string
}
```

## Location
Create in new package or as part of github-app worker.

### Related Issues

**Depends on:**
- **todo-v5yv**

**Blocks:**
- **todo-sz2t**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
- **Closed:** 12/23/2025
