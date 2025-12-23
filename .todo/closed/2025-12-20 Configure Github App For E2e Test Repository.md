---
id: todo-x7l1
title: "Configure GitHub App for E2E test repository"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T04:47:58.292Z"
updatedAt: "2025-12-21T05:34:40.287Z"
closedAt: "2025-12-21T05:34:40.287Z"
source: "beads"
dependsOn: ["todo-8dmr"]
---

# Configure GitHub App for E2E test repository

Ensure GitHub App is properly installed and configured for the test repository.

## Requirements
- GitHub App installed in `dot-do/test.mdx` repo
- Environment variables configured:
  - `GITHUB_APP_ID`
  - `GITHUB_PRIVATE_KEY` (base64 encoded)
  - `GITHUB_INSTALLATION_ID`
  - `GITHUB_WEBHOOK_SECRET` (must match production worker)

## Verify
- Webhook delivery to production worker
- App can create/update/close issues
- App can read/write to branches
- Push events trigger webhook calls

### Related Issues

**Depends on:**
- [todo-8dmr](./todo-8dmr.md)