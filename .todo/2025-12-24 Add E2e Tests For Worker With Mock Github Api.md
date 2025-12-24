---
id: todo-8fe7
title: "Add E2E tests for worker with mock GitHub API"
state: open
priority: 3
type: task
labels: ["testing", "worker"]
createdAt: "2025-12-24T11:06:14.914Z"
updatedAt: "2025-12-24T11:06:14.914Z"
source: "beads"
dependsOn: ["todo-dvxh"]
---

# Add E2E tests for worker with mock GitHub API

Worker has unit tests but needs E2E testing that exercises the full webhook → sync → beads flow with mocked GitHub API responses.

### Related Issues

**Depends on:**
- [todo-dvxh](./todo-dvxh.md)