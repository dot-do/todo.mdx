---
id: todo-84v7
title: "Fix Cloudflare provider in-memory storage bug"
state: closed
priority: 1
type: bug
labels: []
assignee: "claude"
createdAt: "2025-12-22T00:16:33.718Z"
updatedAt: "2025-12-22T00:21:19.356Z"
closedAt: "2025-12-22T00:21:19.356Z"
source: "beads"
---

# Fix Cloudflare provider in-memory storage bug

CloudflareBrowserProvider uses Map for session storage which doesn't persist across worker instances. Sessions are lost immediately.

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
