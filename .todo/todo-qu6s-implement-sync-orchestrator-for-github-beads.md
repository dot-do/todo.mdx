---
id: todo-qu6s
title: "Implement sync orchestrator for GitHub ↔ Beads"
state: open
priority: 2
type: task
labels: ["github-app", "phase-2"]
createdAt: "2025-12-23T13:37:18.026Z"
updatedAt: "2025-12-23T13:37:18.026Z"
source: "beads"
---

# Implement sync orchestrator for GitHub ↔ Beads

Orchestrate bidirectional sync between GitHub and beads with conflict resolution.

## Sync Directions
1. **Webhook-driven (GitHub → Beads)**: Real-time via webhook events
2. **Poll-driven (Beads → GitHub)**: On CLI command or scheduled

## Conflict Resolution
```typescript
type ConflictStrategy = 'github-wins' | 'beads-wins' | 'newest-wins'

interface SyncResult {
  created: string[]
  updated: string[]
  conflicts: Array<{
    beadsId: string
    githubNumber: number
    resolution: 'github' | 'beads' | 'manual'
  }>
}
```

## Algorithm
1. Load IssueMapping for installation
2. For each change:
   - If no mapping exists → create in target
   - If mapping exists → compare timestamps
   - Apply conflict strategy
3. Update SyncState cursor
4. Handle rate limits with backoff

## Webhook Processing
```typescript
async function processWebhookEvent(
  event: string,
  payload: any,
  installation: Installation
): Promise<void> {
  switch (event) {
    case 'issues.opened':
      await createBeadsIssue(payload.issue, installation)
      break
    case 'issues.edited':
      await updateBeadsIssue(payload.issue, installation)
      break
    // ...
  }
}
```

### Related Issues

**Depends on:**
- **todo-4ygu**
- **todo-aifu**
- **todo-44c0**
- **todo-sz2t**
- **todo-v5yv**

**Blocks:**
- **todo-ghw6**

### Timeline

- **Created:** 12/23/2025
- **Updated:** 12/23/2025
