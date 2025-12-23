---
id: todo-tia9
title: "Wire updateGitHubIssue() in onBeadsPush()"
state: closed
priority: 1
type: task
labels: ["mvp", "phase-1", "sync"]
createdAt: "2025-12-21T00:37:22.817Z"
updatedAt: "2025-12-21T00:40:37.535Z"
closedAt: "2025-12-21T00:40:37.535Z"
source: "beads"
---

# Wire updateGitHubIssue() in onBeadsPush()

In `worker/src/do/repo.ts`, modify `onBeadsPush()` to call `updateGitHubIssue()` for issues that have a `github_number` (already synced). Currently only calls `createGitHubIssue()` for new issues.

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
