---
id: todo-dvxh
title: "Complete GitHub sync orchestrator integration in worker"
state: in_progress
priority: 1
type: task
labels: ["github-sync", "worker"]
createdAt: "2025-12-24T11:05:48.364Z"
updatedAt: "2025-12-24T11:11:36.172Z"
source: "beads"
blocks: ["todo-8fe7", "todo-wq9p"]
---

# Complete GitHub sync orchestrator integration in worker

The worker/index.ts has TODO comments for:
1. Integrate handleIssueEvent with sync orchestrator (line 127)
2. Implement handleCommentEvent to sync comments to beads (line 137)

The sync orchestrator exists in worker/github-sync/sync-orchestrator.ts but isn't wired up to the webhook handlers.

### Related Issues

**Blocks:**
- [todo-8fe7](./todo-8fe7.md)
- [todo-wq9p](./todo-wq9p.md)